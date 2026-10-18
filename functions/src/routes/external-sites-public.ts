import { readEmbedSession, mutateEmbedSession } from '../services/embed-session';
import { Request, Response } from 'express';
import express from 'express';
import { db } from '../core';
import {
  BUILDER_SESSIONS_COLLECTION,
  BUILDER_DRAFTS_COLLECTION,
  SURFACES_COLLECTION,
  SURFACE_VARIANTS_COLLECTION,
} from '../constants';
import { computePricingSnapshot, checkSurfaceReadiness } from '../../../shared/surfaces';
import {
  validateEmbedContext,
  buildPricingFromContext,
  DEFAULT_BUILDER_PERMISSIONS,
} from '../services/embed-validation';


export function registerExternalSitesPublicRoutes(app: express.Express): void {
app.get('/public/embed/placement/:placementId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { placementId } = req.params;
    const ctx = await validateEmbedContext(placementId, req);
    if (!ctx.valid) {
      const code = ctx.error?.includes('not found') ? 404 : 403;
      res.status(code).json({ error: ctx.error });
      return;
    }

    const permissions = { ...(ctx.profile?.permissions || DEFAULT_BUILDER_PERMISSIONS), allowBuyNow: false };

    res.json({
      placement: ctx.placement,
      host: ctx.host ? { id: ctx.host.id, name: ctx.host.name, storeId: ctx.host.storeId } : null,
      profile: ctx.profile ? { id: ctx.profile.id, name: ctx.profile.name, permissions, theme: ctx.profile.theme || null } : null,
      surface: ctx.surface,
      pricingPolicy: ctx.pricingPolicy ? { id: ctx.pricingPolicy.id, name: ctx.pricingPolicy.name, currency: ctx.pricingPolicy.currency || 'USD' } : null,
      revenueSplit: ctx.revenueSplit ? { id: ctx.revenueSplit.id, affiliatePercent: ctx.revenueSplit.affiliatePercent } : null,
      affiliateUserId: ctx.affiliateUserId || null,
      embedMode: ctx.placement.embedMode,
    });
  } catch (error: any) {
    console.error('[ExternalSites] GET public placement error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/public/embed/surface/:surfaceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const surfaceDoc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!surfaceDoc.exists) { res.status(404).json({ error: 'Surface not found' }); return; }
    const surface = surfaceDoc.data() as any;
    if (surface.status === 'archived' || surface.status === 'blocked') {
      res.status(403).json({ error: 'Surface is not available' }); return;
    }
    const variantsSnap = await db.collection(SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
    const variants = variantsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((v: any) => v.enabled);

    const readiness = checkSurfaceReadiness(surface, variants);
    if (!readiness.ready) {
      res.status(422).json({ error: 'Surface is not ready for external use', readinessErrors: readiness.errors, readinessScore: readiness.score });
      return;
    }

    res.json({ id: surfaceDoc.id, ...surface, variants });
  } catch (error: any) {
    console.error('[ExternalSites] GET public surface error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/public/embed/session', async (req: Request, res: Response): Promise<void> => {
  try {
    const { builderPlacementId, visitorId, embedMode } = req.body;
    if (!builderPlacementId) { res.status(400).json({ error: 'builderPlacementId is required' }); return; }

    const ctx = await validateEmbedContext(builderPlacementId, req, { requireSurface: true, requireReadiness: true });
    if (!ctx.valid) {
      const code = ctx.error?.includes('not found') ? 404 : ctx.error?.includes('not ready') ? 422 : 403;
      res.status(code).json({ error: ctx.error });
      return;
    }

    if (embedMode && embedMode !== ctx.placement.embedMode) {
      res.status(400).json({ error: `Requested mode '${embedMode}' does not match placement mode '${ctx.placement.embedMode}'` });
      return;
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pricingSnapshot = ctx.surface && ctx.pricingPolicy
      ? buildPricingFromContext(ctx.surface, ctx.pricingPolicy, ctx.revenueSplit)
      : null;

    const sessionData = {
      builderPlacementId,
      builderProfileId: ctx.profile?.id || '',
      builderHostId: ctx.host.id,
      affiliateUserId: ctx.affiliateUserId || '',
      surfaceId: ctx.surface?.id || '',
      pricingPolicyId: ctx.pricingPolicy?.id || '',
      revenueSplitId: ctx.revenueSplit?.id || '',
      visitorId: visitorId || '',
      anonToken: require('crypto').randomBytes(16).toString('hex'),
      status: 'active',
      embedMode: ctx.placement.embedMode,
      currentSelections: {},
      previewState: {},
      pricingSnapshot,
      startedAt: now,
      lastSeenAt: now,
      expiresAt,
    };
    const docRef = await db.collection(BUILDER_SESSIONS_COLLECTION).add(sessionData);
    console.log(`[ExternalSites] Session created: ${docRef.id}, placement=${builderPlacementId}, affiliate=${ctx.affiliateUserId || 'none'}`);
    res.json({ id: docRef.id, ...sessionData });
  } catch (error: any) {
    console.error('[ExternalSites] POST public session error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/public/embed/session/:sessionId/draft', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const session = await readEmbedSession(sessionId, req, ['active']);

    const ctx = await validateEmbedContext(session.builderPlacementId, req);
    if (!ctx.valid) { res.status(403).json({ error: ctx.error }); return; }

    const profile = ctx.profile;
    const permissions = profile?.permissions || DEFAULT_BUILDER_PERMISSIONS;
    if (!permissions.allowSaveDraft) {
      res.status(403).json({ error: 'Saving drafts is not allowed by the current profile' }); return;
    }

    const { draftPayload } = req.body;
    const now = new Date().toISOString();
    const draftData = {
      builderSessionId: sessionId,
      builderPlacementId: session.builderPlacementId,
      builderProfileId: session.builderProfileId || '',
      builderHostId: session.builderHostId,
      affiliateUserId: session.affiliateUserId || '',
      surfaceId: session.surfaceId || '',
      draftPayload: draftPayload || {},
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    const docRef = db.collection(BUILDER_DRAFTS_COLLECTION).doc();
    await mutateEmbedSession(sessionId, req, ['active'], { lastSeenAt: now }, tx => tx.create(docRef, draftData));
    res.json({ id: docRef.id, ...draftData });
  } catch (error: any) {
    console.error('[ExternalSites] POST public draft error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/public/embed/session/:sessionId/cart', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const session = await readEmbedSession(sessionId, req, ['active']);

    const ctx = await validateEmbedContext(session.builderPlacementId, req, { requireSurface: true, requireReadiness: true });
    if (!ctx.valid) { res.status(403).json({ error: ctx.error }); return; }

    const { surfaceId, variantId, quantity, designSelections, qrSelections, previewSnapshot } = req.body;
    const effectiveSurfaceId = surfaceId || session.surfaceId;
    if (!effectiveSurfaceId) { res.status(400).json({ error: 'surfaceId is required' }); return; }
    if (!quantity || quantity < 1) { res.status(400).json({ error: 'quantity must be at least 1' }); return; }

    let selectedVariant = null;
    if (variantId) {
      const variantDoc = await db.collection(SURFACE_VARIANTS_COLLECTION).doc(variantId).get();
      if (!variantDoc.exists) { res.status(404).json({ error: 'Variant not found' }); return; }
      selectedVariant = { id: variantDoc.id, ...variantDoc.data() };
      if (!(selectedVariant as any).enabled) { res.status(400).json({ error: 'Selected variant is not available' }); return; }
    }

    const pricingSnapshot = buildPricingFromContext(ctx.surface, ctx.pricingPolicy, ctx.revenueSplit);

    const now = new Date().toISOString();
    const cartItemData = {
      sessionId,
      builderPlacementId: session.builderPlacementId,
      builderHostId: session.builderHostId,
      builderProfileId: session.builderProfileId || '',
      affiliateUserId: ctx.affiliateUserId || '',
      surfaceId: effectiveSurfaceId,
      variantId: variantId || null,
      variant: selectedVariant,
      pricingPolicyId: ctx.pricingPolicy?.id || '',
      revenueSplitId: ctx.revenueSplit?.id || '',
      quantity,
      designSelections: designSelections || {},
      qrSelections: qrSelections || {},
      previewSnapshot: previewSnapshot || null,
      pricingSnapshot,
      status: 'pending',
      createdAt: now,
    };

    const cartRef = db.collection('embedCartItems').doc();
    await mutateEmbedSession(sessionId, req, ['active'], { lastSeenAt: now, status: 'cart_added' }, tx => tx.create(cartRef, cartItemData));

    console.log(`[ExternalSites] Cart item created: ${cartRef.id}, session=${sessionId}, surface=${effectiveSurfaceId}`);
    res.json({ id: cartRef.id, ...cartItemData });
  } catch (error: any) {
    console.error('[ExternalSites] POST session cart error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Legacy surfaces do not have a canonical production-order bridge. Never take payment here.
app.post('/public/embed/session/:sessionId/buy', async (req: Request, res: Response): Promise<void> => {
  try {
    await readEmbedSession(req.params.sessionId, req, ['active', 'cart_added']);
    res.status(410).json({ error: 'Purchases from this legacy embed are unavailable. Choose a published product in the QR Gear store.', storeUrl: '/store' });
  } catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
});

app.post('/public/embed/pricing/compute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { salePrice, productCost, providerCost, platformFeeAmount, shippingCostBurden, discountBurden, affiliatePercent, currency } = req.body;
    if (typeof salePrice !== 'number' || typeof productCost !== 'number') {
      res.status(400).json({ error: 'salePrice and productCost are required as numbers' }); return;
    }
    const snapshot = computePricingSnapshot({
      salePrice,
      productCost,
      providerCost,
      platformFeeAmount,
      shippingCostBurden,
      discountBurden,
      affiliatePercent,
      currency,
    });
    res.json(snapshot);
  } catch (error: any) {
    console.error('[ExternalSites] POST pricing compute error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});


}
