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
import { createCanonicalOrder } from '../services/order-service';
import {
  validateEmbedContext,
  buildPricingFromContext,
  DEFAULT_BUILDER_PERMISSIONS,
} from '../services/embed-validation';
import Stripe from 'stripe';


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

    const permissions = ctx.profile?.permissions || DEFAULT_BUILDER_PERMISSIONS;

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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
      anonToken: Math.random().toString(36).substring(2) + Date.now().toString(36),
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/public/embed/session/:sessionId/draft', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const sessionDoc = await db.collection(BUILDER_SESSIONS_COLLECTION).doc(sessionId).get();
    if (!sessionDoc.exists) { res.status(404).json({ error: 'Session not found' }); return; }
    const session = sessionDoc.data() as any;
    if (session.status !== 'active') { res.status(403).json({ error: 'Session is not active' }); return; }

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
    const docRef = await db.collection(BUILDER_DRAFTS_COLLECTION).add(draftData);
    await db.collection(BUILDER_SESSIONS_COLLECTION).doc(sessionId).update({ lastSeenAt: now });
    res.json({ id: docRef.id, ...draftData });
  } catch (error: any) {
    console.error('[ExternalSites] POST public draft error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/public/embed/session/:sessionId/cart', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const sessionDoc = await db.collection(BUILDER_SESSIONS_COLLECTION).doc(sessionId).get();
    if (!sessionDoc.exists) { res.status(404).json({ error: 'Session not found' }); return; }
    const session = sessionDoc.data() as any;
    if (session.status !== 'active') { res.status(403).json({ error: 'Session is not active' }); return; }

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

    const cartRef = await db.collection('embedCartItems').add(cartItemData);
    await db.collection(BUILDER_SESSIONS_COLLECTION).doc(sessionId).update({
      lastSeenAt: now,
      status: 'cart_added',
    });

    console.log(`[ExternalSites] Cart item created: ${cartRef.id}, session=${sessionId}, surface=${effectiveSurfaceId}`);
    res.json({ id: cartRef.id, ...cartItemData });
  } catch (error: any) {
    console.error('[ExternalSites] POST session cart error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/public/embed/session/:sessionId/buy', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const sessionDoc = await db.collection(BUILDER_SESSIONS_COLLECTION).doc(sessionId).get();
    if (!sessionDoc.exists) { res.status(404).json({ error: 'Session not found' }); return; }
    const session = sessionDoc.data() as any;
    if (session.status !== 'active' && session.status !== 'cart_added') {
      res.status(403).json({ error: 'Session is not in a buyable state' }); return;
    }

    const ctx = await validateEmbedContext(session.builderPlacementId, req, { requireSurface: true, requireReadiness: true });
    if (!ctx.valid) { res.status(403).json({ error: ctx.error }); return; }

    const profile = ctx.profile;
    const permissions = profile?.permissions || DEFAULT_BUILDER_PERMISSIONS;
    if (!permissions.allowBuyNow) {
      res.status(403).json({ error: 'Direct purchase is not allowed by the current profile' }); return;
    }

    if (!ctx.affiliateUserId) {
      res.status(422).json({ error: 'Cannot process purchase: no affiliate user resolved for this placement. Check placement, host, or profile affiliate configuration.' }); return;
    }

    const { surfaceId, variantId, quantity, designSelections, qrSelections, previewSnapshot, successUrl, cancelUrl } = req.body;
    const effectiveSurfaceId = surfaceId || session.surfaceId;
    if (!effectiveSurfaceId) { res.status(400).json({ error: 'surfaceId is required' }); return; }

    const pricingSnapshot = buildPricingFromContext(ctx.surface, ctx.pricingPolicy, ctx.revenueSplit);
    const unitPrice = pricingSnapshot.displaySalePrice;
    const qty = quantity || 1;

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: 'Payment not configured' }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });

    const productTitle = ctx.surface?.title || 'QR Gear Product';
    const productImage = ctx.surface?.images?.[0] || null;
    const baseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: pricingSnapshot.currency.toLowerCase(),
          product_data: {
            name: productTitle,
            images: productImage ? [productImage] : [],
          },
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: qty,
      }],
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE'],
      },
      success_url: successUrl || `${baseUrl}/embed/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/embed/cancel`,
      metadata: {
        source: 'external_embed',
        embedSessionId: sessionId,
        builderPlacementId: session.builderPlacementId,
        builderHostId: session.builderHostId,
        affiliateUserId: ctx.affiliateUserId || '',
        surfaceId: effectiveSurfaceId,
        variantId: variantId || '',
        pricingPolicyId: ctx.pricingPolicy?.id || '',
        revenueSplitId: ctx.revenueSplit?.id || '',
      },
      customer_creation: 'if_required',
    });

    const now = new Date().toISOString();

    const { orderItemId } = await createCanonicalOrder({
      source: 'external_embed',
      stripeSessionId: checkoutSession.id,
      buyerEmail: '',
      buyerName: '',
      shippingAddress: null,
      totalAmount: unitPrice * qty,
      pricingSnapshot,
      cartItems: [{ quantity: qty }],
      embedContext: {
        builderHostId: session.builderHostId,
        builderPlacementId: session.builderPlacementId,
        builderProfileId: session.builderProfileId || '',
        affiliateUserId: ctx.affiliateUserId || '',
        surfaceId: effectiveSurfaceId,
        variantId: variantId || '',
        pricingPolicyId: ctx.pricingPolicy?.id || '',
        revenueSplitId: ctx.revenueSplit?.id || '',
        designSelections: designSelections || {},
        qrSelections: qrSelections || {},
        previewSnapshot: previewSnapshot || null,
      },
    });

    await db.collection(BUILDER_SESSIONS_COLLECTION).doc(sessionId).update({
      lastSeenAt: now,
      status: 'checkout_started',
      stripeCheckoutSessionId: checkoutSession.id,
    });

    console.log(`[ExternalSites] Buy checkout created: stripe=${checkoutSession.id}, session=${sessionId}, affiliate=${ctx.affiliateUserId || 'none'}, amount=$${unitPrice * qty}`);
    res.json({
      checkoutUrl: checkoutSession.url,
      stripeSessionId: checkoutSession.id,
      pricingSnapshot,
      total: unitPrice * qty,
    });
  } catch (error: any) {
    console.error('[ExternalSites] POST session buy error:', error);
    res.status(500).json({ error: error.message });
  }
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
    res.status(500).json({ error: error.message });
  }
});


}
