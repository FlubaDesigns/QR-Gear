import { Request, Response } from 'express';
import express from 'express';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import {
  BUILDER_HOSTS_COLLECTION,
  BUILDER_PROFILES_COLLECTION,
  BUILDER_PLACEMENTS_COLLECTION,
  BUILDER_SESSIONS_COLLECTION,
  BUILDER_DRAFTS_COLLECTION,
  PRICING_POLICIES_COLLECTION,
  REVENUE_SPLITS_COLLECTION,
  EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION,
  AFFILIATE_PAYOUT_LEDGER_COLLECTION,
  SURFACES_COLLECTION,
  SURFACE_VARIANTS_COLLECTION,
  EMBED_MODES,
  BUILDER_HOST_STATUSES,
  BUILDER_PROFILE_STATUSES,
  BUILDER_PLACEMENT_STATUSES,
  PAYOUT_STATUSES,
} from '../constants';
import { computePricingSnapshot, checkSurfaceReadiness } from '../../../shared/surfaces';
import type { PricingSnapshot } from '../../../shared/surfaces';
import Stripe from 'stripe';

interface BuilderPermissionScope {
  allowHeaderText: boolean;
  allowHeaderImage: boolean;
  allowFooterText: boolean;
  allowFooterImage: boolean;
  allowCenterGraphic: boolean;
  allowQrModeSwitch: boolean;
  allowUpload: boolean;
  allowAssetLibrary: boolean;
  allowProductChange: boolean;
  allowVariantChange: boolean;
  allowSaveDraft: boolean;
  allowBuyNow: boolean;
}

const DEFAULT_BUILDER_PERMISSIONS: BuilderPermissionScope = {
  allowHeaderText: true,
  allowHeaderImage: false,
  allowFooterText: true,
  allowFooterImage: false,
  allowCenterGraphic: true,
  allowQrModeSwitch: false,
  allowUpload: false,
  allowAssetLibrary: true,
  allowProductChange: false,
  allowVariantChange: true,
  allowSaveDraft: false,
  allowBuyNow: true,
};

function extractRequestDomain(req: Request): string | null {
  const origin = req.headers.origin;
  if (origin) {
    try { return new URL(origin).hostname; } catch { /* ignore */ }
  }
  const referer = req.headers.referer;
  if (referer) {
    try { return new URL(referer).hostname; } catch { /* ignore */ }
  }
  const supplied = req.query.domain as string || req.body?.domain;
  if (supplied && typeof supplied === 'string') return supplied;
  return null;
}

function isDomainAllowed(requestDomain: string | null, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  if (!requestDomain) return false;
  const norm = requestDomain.toLowerCase().replace(/^www\./, '');
  return allowedDomains.some(d => {
    const allowed = d.toLowerCase().replace(/^www\./, '');
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(2);
      return norm === suffix || norm.endsWith('.' + suffix);
    }
    return norm === allowed;
  });
}

interface EmbedValidationResult {
  valid: boolean;
  error?: string;
  placement?: any;
  host?: any;
  profile?: any;
  surface?: any;
  variants?: any[];
  pricingPolicy?: any;
  revenueSplit?: any;
  affiliateUserId?: string;
}

async function validateEmbedContext(
  placementId: string,
  req: Request,
  opts: { requireSurface?: boolean; requireReadiness?: boolean } = {}
): Promise<EmbedValidationResult> {
  const placementDoc = await db.collection(BUILDER_PLACEMENTS_COLLECTION).doc(placementId).get();
  if (!placementDoc.exists) return { valid: false, error: 'Placement not found' };
  const placement = { id: placementDoc.id, ...placementDoc.data() } as any;
  if (placement.status !== 'active') return { valid: false, error: 'Placement is not active' };

  const hostDoc = await db.collection(BUILDER_HOSTS_COLLECTION).doc(placement.builderHostId).get();
  if (!hostDoc.exists) return { valid: false, error: 'Host not found' };
  const host = { id: hostDoc.id, ...hostDoc.data() } as any;
  if (host.status !== 'active') return { valid: false, error: 'Host is not active' };

  const requestDomain = extractRequestDomain(req);
  if (!isDomainAllowed(requestDomain, host.allowedDomains || [])) {
    return { valid: false, error: `Domain '${requestDomain || 'unknown'}' is not allowed for this host` };
  }

  let profile: any = null;
  const profileId = placement.builderProfileId || host.defaultBuilderProfileId;
  if (profileId) {
    const profileDoc = await db.collection(BUILDER_PROFILES_COLLECTION).doc(profileId).get();
    if (profileDoc.exists) {
      profile = { id: profileDoc.id, ...profileDoc.data() };
      if (profile.status !== 'active') return { valid: false, error: 'Profile is not active' };
    }
  }

  let surface: any = null;
  let variants: any[] = [];
  if (placement.surfaceId) {
    const surfaceDoc = await db.collection(SURFACES_COLLECTION).doc(placement.surfaceId).get();
    if (surfaceDoc.exists) {
      surface = { id: surfaceDoc.id, ...surfaceDoc.data() };
      if (surface.status === 'archived' || surface.status === 'blocked') {
        return { valid: false, error: 'Surface is not available' };
      }
    }
  }
  if (opts.requireSurface && !surface) return { valid: false, error: 'Placement has no surface configured' };

  if (surface && opts.requireReadiness) {
    const variantsSnap = await db.collection(SURFACE_VARIANTS_COLLECTION)
      .where('surfaceId', '==', surface.id).get();
    variants = variantsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const readiness = checkSurfaceReadiness(surface, variants);
    if (!readiness.ready) {
      return { valid: false, error: `Surface not ready: ${readiness.errors.join(', ')}` };
    }
  }

  let pricingPolicy: any = null;
  const policyId = placement.pricingPolicyId || host.defaultPricingPolicyId;
  if (policyId) {
    const policyDoc = await db.collection(PRICING_POLICIES_COLLECTION).doc(policyId).get();
    if (policyDoc.exists) pricingPolicy = { id: policyDoc.id, ...policyDoc.data() };
  }

  let revenueSplit: any = null;
  const splitId = placement.revenueSplitId || host.defaultRevenueSplitId;
  if (splitId) {
    const splitDoc = await db.collection(REVENUE_SPLITS_COLLECTION).doc(splitId).get();
    if (splitDoc.exists) revenueSplit = { id: splitDoc.id, ...splitDoc.data() };
  }

  let affiliateUserId = '';
  if (placement.affiliateUserId) {
    affiliateUserId = placement.affiliateUserId;
  } else if (host.ownerUserId) {
    affiliateUserId = host.ownerUserId;
  }
  if (revenueSplit && revenueSplit.affiliatePercent > 0 && !affiliateUserId) {
    if (revenueSplit.requireAffiliate !== false) {
      return { valid: false, error: 'Revenue sharing is enabled but no affiliate user could be resolved' };
    }
  }

  return { valid: true, placement, host, profile, surface, variants, pricingPolicy, revenueSplit, affiliateUserId };
}

function buildPricingFromContext(surface: any, pricingPolicy: any, revenueSplit: any): PricingSnapshot {
  const salePrice = surface?.retailPrice || 0;
  const productCost = surface?.baseCost || 0;
  const affiliatePercent = revenueSplit?.affiliatePercent ?? 25;
  const platformFeeAmount = pricingPolicy?.platformFeeAmount || 0;
  return computePricingSnapshot({
    salePrice, productCost, platformFeeAmount, affiliatePercent,
    currency: pricingPolicy?.currency || 'USD',
  });
}

function getPeriodKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const VALID_HOST_STATUSES = new Set<string>(BUILDER_HOST_STATUSES);
const VALID_PROFILE_STATUSES = new Set<string>(BUILDER_PROFILE_STATUSES);
const VALID_PLACEMENT_STATUSES = new Set<string>(BUILDER_PLACEMENT_STATUSES);
const VALID_EMBED_MODES = new Set<string>(EMBED_MODES);
const VALID_PAYOUT_STATUSES = new Set<string>(PAYOUT_STATUSES);
const VALID_BASE_COST_MODES = new Set<string>(['snapshot', 'live-cost', 'variant-cost']);
const VALID_MARGIN_TYPES = new Set<string>(['fixed', 'percent']);
const VALID_ROUNDING_MODES = new Set<string>(['none', 'round', 'ceil', 'floor']);
const VALID_PRICING_STATUSES = new Set<string>(['active', 'draft', 'archived']);
const VALID_SPLIT_STATUSES = new Set<string>(['active', 'draft', 'archived']);

export function register(app: express.Express): void {

// ============ BUILDER HOSTS ============

app.get('/admin/external/hosts', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(BUILDER_HOSTS_COLLECTION).get();
    const hosts = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    hosts.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    res.json(hosts);
  } catch (error: any) {
    console.error('[ExternalSites] GET hosts error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/external/hosts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, ownerUserId, storeId, defaultBuilderProfileId, defaultPricingPolicyId, defaultRevenueSplitId, allowedDomains, contactEmail, contactName, notes, status } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const hostStatus = status && VALID_HOST_STATUSES.has(status) ? status : 'active';
    const now = new Date().toISOString();
    const data = {
      name: name.trim(),
      ownerUserId: ownerUserId || '',
      storeId: storeId || '',
      defaultBuilderProfileId: defaultBuilderProfileId || '',
      defaultPricingPolicyId: defaultPricingPolicyId || '',
      defaultRevenueSplitId: defaultRevenueSplitId || '',
      allowedDomains: Array.isArray(allowedDomains) ? allowedDomains : [],
      contactEmail: contactEmail || '',
      contactName: contactName || '',
      notes: notes || '',
      status: hostStatus,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(BUILDER_HOSTS_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[ExternalSites] POST host error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/external/hosts/:hostId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { hostId } = req.params;
    const doc = await db.collection(BUILDER_HOSTS_COLLECTION).doc(hostId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Host not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = ['name', 'ownerUserId', 'storeId', 'defaultBuilderProfileId', 'defaultPricingPolicyId', 'defaultRevenueSplitId', 'allowedDomains', 'contactEmail', 'contactName', 'notes', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status && !VALID_HOST_STATUSES.has(updates.status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${BUILDER_HOST_STATUSES.join(', ')}` }); return;
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(BUILDER_HOSTS_COLLECTION).doc(hostId).update(updates);
    res.json({ id: hostId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[ExternalSites] PATCH host error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/external/hosts/:hostId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { hostId } = req.params;
    const doc = await db.collection(BUILDER_HOSTS_COLLECTION).doc(hostId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Host not found' }); return; }
    const placementsSnap = await db.collection(BUILDER_PLACEMENTS_COLLECTION).where('builderHostId', '==', hostId).limit(1).get();
    if (!placementsSnap.empty) {
      res.status(400).json({ error: 'Cannot delete host with active placements. Remove placements first.' }); return;
    }
    await db.collection(BUILDER_HOSTS_COLLECTION).doc(hostId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[ExternalSites] DELETE host error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ BUILDER PROFILES ============

app.get('/admin/external/profiles', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(BUILDER_PROFILES_COLLECTION).get();
    const profiles = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    profiles.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    res.json(profiles);
  } catch (error: any) {
    console.error('[ExternalSites] GET profiles error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/external/profiles', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, storeId, surfaceId, allowedProductIds, allowedVariantIds, permissions, defaultTheme, maxUploads, status } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const profileStatus = status && VALID_PROFILE_STATUSES.has(status) ? status : 'draft';
    const mergedPermissions: BuilderPermissionScope = { ...DEFAULT_BUILDER_PERMISSIONS, ...(permissions || {}) };
    const now = new Date().toISOString();
    const data = {
      name: name.trim(),
      storeId: storeId || '',
      surfaceId: surfaceId || '',
      allowedProductIds: Array.isArray(allowedProductIds) ? allowedProductIds : [],
      allowedVariantIds: Array.isArray(allowedVariantIds) ? allowedVariantIds : [],
      permissions: mergedPermissions,
      defaultTheme: defaultTheme || '',
      maxUploads: typeof maxUploads === 'number' ? maxUploads : 5,
      status: profileStatus,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(BUILDER_PROFILES_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[ExternalSites] POST profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/external/profiles/:profileId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params;
    const doc = await db.collection(BUILDER_PROFILES_COLLECTION).doc(profileId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Profile not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = ['name', 'storeId', 'surfaceId', 'allowedProductIds', 'allowedVariantIds', 'permissions', 'defaultTheme', 'maxUploads', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status && !VALID_PROFILE_STATUSES.has(updates.status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${BUILDER_PROFILE_STATUSES.join(', ')}` }); return;
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(BUILDER_PROFILES_COLLECTION).doc(profileId).update(updates);
    res.json({ id: profileId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[ExternalSites] PATCH profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/external/profiles/:profileId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params;
    const doc = await db.collection(BUILDER_PROFILES_COLLECTION).doc(profileId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Profile not found' }); return; }
    const placementsSnap = await db.collection(BUILDER_PLACEMENTS_COLLECTION).where('builderProfileId', '==', profileId).limit(1).get();
    if (!placementsSnap.empty) {
      res.status(400).json({ error: 'Cannot delete profile with active placements.' }); return;
    }
    await db.collection(BUILDER_PROFILES_COLLECTION).doc(profileId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[ExternalSites] DELETE profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ BUILDER PLACEMENTS ============

app.get('/admin/external/placements', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { builderHostId } = req.query;
    let query: any = db.collection(BUILDER_PLACEMENTS_COLLECTION);
    if (builderHostId) query = query.where('builderHostId', '==', builderHostId);
    const snapshot = await query.get();
    const placements = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    placements.sort((a: any, b: any) => (a.placementName || '').localeCompare(b.placementName || ''));
    res.json(placements);
  } catch (error: any) {
    console.error('[ExternalSites] GET placements error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/external/placements', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { builderHostId, builderProfileId, surfaceId, placementName, slug, domainHint, campaignId, pricingPolicyId, revenueSplitId, embedMode, status } = req.body;
    if (!builderHostId) { res.status(400).json({ error: 'builderHostId is required' }); return; }
    if (!placementName || !placementName.trim()) { res.status(400).json({ error: 'placementName is required' }); return; }
    const hostDoc = await db.collection(BUILDER_HOSTS_COLLECTION).doc(builderHostId).get();
    if (!hostDoc.exists) { res.status(404).json({ error: 'Host not found' }); return; }
    const resolvedEmbedMode = embedMode && VALID_EMBED_MODES.has(embedMode) ? embedMode : 'store';
    const placementStatus = status && VALID_PLACEMENT_STATUSES.has(status) ? status : 'active';
    const resolvedSlug = slug || placementName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const now = new Date().toISOString();
    const data = {
      builderHostId,
      builderProfileId: builderProfileId || '',
      surfaceId: surfaceId || '',
      placementName: placementName.trim(),
      slug: resolvedSlug,
      domainHint: domainHint || '',
      campaignId: campaignId || '',
      pricingPolicyId: pricingPolicyId || '',
      revenueSplitId: revenueSplitId || '',
      embedMode: resolvedEmbedMode,
      status: placementStatus,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(BUILDER_PLACEMENTS_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[ExternalSites] POST placement error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/external/placements/:placementId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { placementId } = req.params;
    const doc = await db.collection(BUILDER_PLACEMENTS_COLLECTION).doc(placementId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Placement not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = ['builderProfileId', 'surfaceId', 'placementName', 'slug', 'domainHint', 'campaignId', 'pricingPolicyId', 'revenueSplitId', 'embedMode', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.embedMode && !VALID_EMBED_MODES.has(updates.embedMode)) {
      res.status(400).json({ error: `Invalid embedMode. Must be one of: ${EMBED_MODES.join(', ')}` }); return;
    }
    if (updates.status && !VALID_PLACEMENT_STATUSES.has(updates.status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${BUILDER_PLACEMENT_STATUSES.join(', ')}` }); return;
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(BUILDER_PLACEMENTS_COLLECTION).doc(placementId).update(updates);
    res.json({ id: placementId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[ExternalSites] PATCH placement error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/external/placements/:placementId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { placementId } = req.params;
    const doc = await db.collection(BUILDER_PLACEMENTS_COLLECTION).doc(placementId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Placement not found' }); return; }
    await db.collection(BUILDER_PLACEMENTS_COLLECTION).doc(placementId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[ExternalSites] DELETE placement error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRICING POLICIES ============

app.get('/admin/external/pricing-policies', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(PRICING_POLICIES_COLLECTION).get();
    const policies = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    policies.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    res.json(policies);
  } catch (error: any) {
    console.error('[ExternalSites] GET pricing-policies error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/external/pricing-policies', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, storeId, surfaceId, currency, baseCostMode, baseRetailPrice, platformMarginType, platformMarginValue, affiliateBasis, affiliatePercent, campaignMarkupType, campaignMarkupValue, minPrice, maxPrice, roundingMode, status } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const now = new Date().toISOString();
    const data: Record<string, any> = {
      name: name.trim(),
      storeId: storeId || '',
      surfaceId: surfaceId || '',
      currency: currency || 'USD',
      baseCostMode: baseCostMode && VALID_BASE_COST_MODES.has(baseCostMode) ? baseCostMode : 'snapshot',
      baseRetailPrice: typeof baseRetailPrice === 'number' ? baseRetailPrice : 0,
      platformMarginType: platformMarginType && VALID_MARGIN_TYPES.has(platformMarginType) ? platformMarginType : 'percent',
      platformMarginValue: typeof platformMarginValue === 'number' ? platformMarginValue : 0,
      affiliateBasis: 'gross_profit',
      affiliatePercent: typeof affiliatePercent === 'number' ? affiliatePercent : 25,
      roundingMode: roundingMode && VALID_ROUNDING_MODES.has(roundingMode) ? roundingMode : 'round',
      status: status && VALID_PRICING_STATUSES.has(status) ? status : 'draft',
      createdAt: now,
      updatedAt: now,
    };
    if (campaignMarkupType && VALID_MARGIN_TYPES.has(campaignMarkupType)) {
      data.campaignMarkupType = campaignMarkupType;
      data.campaignMarkupValue = typeof campaignMarkupValue === 'number' ? campaignMarkupValue : 0;
    }
    if (typeof minPrice === 'number') data.minPrice = minPrice;
    if (typeof maxPrice === 'number') data.maxPrice = maxPrice;
    const docRef = await db.collection(PRICING_POLICIES_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[ExternalSites] POST pricing-policy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/external/pricing-policies/:policyId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { policyId } = req.params;
    const doc = await db.collection(PRICING_POLICIES_COLLECTION).doc(policyId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Pricing policy not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = ['name', 'storeId', 'surfaceId', 'currency', 'baseCostMode', 'baseRetailPrice', 'platformMarginType', 'platformMarginValue', 'affiliatePercent', 'campaignMarkupType', 'campaignMarkupValue', 'minPrice', 'maxPrice', 'roundingMode', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status && !VALID_PRICING_STATUSES.has(updates.status)) {
      res.status(400).json({ error: 'Invalid status' }); return;
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(PRICING_POLICIES_COLLECTION).doc(policyId).update(updates);
    res.json({ id: policyId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[ExternalSites] PATCH pricing-policy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/external/pricing-policies/:policyId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { policyId } = req.params;
    const doc = await db.collection(PRICING_POLICIES_COLLECTION).doc(policyId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Pricing policy not found' }); return; }
    await db.collection(PRICING_POLICIES_COLLECTION).doc(policyId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[ExternalSites] DELETE pricing-policy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ REVENUE SPLITS ============

app.get('/admin/external/revenue-splits', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(REVENUE_SPLITS_COLLECTION).get();
    const splits = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    splits.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    res.json(splits);
  } catch (error: any) {
    console.error('[ExternalSites] GET revenue-splits error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/external/revenue-splits', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, storeId, affiliateSharePercent, platformSharePercent, notes, status } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const now = new Date().toISOString();
    const affShare = typeof affiliateSharePercent === 'number' ? affiliateSharePercent : 25;
    const platShare = typeof platformSharePercent === 'number' ? platformSharePercent : 75;
    const data = {
      name: name.trim(),
      storeId: storeId || '',
      affiliateSharePercent: affShare,
      platformSharePercent: platShare,
      notes: notes || '',
      status: status && VALID_SPLIT_STATUSES.has(status) ? status : 'draft',
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(REVENUE_SPLITS_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[ExternalSites] POST revenue-split error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/external/revenue-splits/:splitId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { splitId } = req.params;
    const doc = await db.collection(REVENUE_SPLITS_COLLECTION).doc(splitId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Revenue split not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = ['name', 'storeId', 'affiliateSharePercent', 'platformSharePercent', 'notes', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(REVENUE_SPLITS_COLLECTION).doc(splitId).update(updates);
    res.json({ id: splitId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[ExternalSites] PATCH revenue-split error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/external/revenue-splits/:splitId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { splitId } = req.params;
    const doc = await db.collection(REVENUE_SPLITS_COLLECTION).doc(splitId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Revenue split not found' }); return; }
    await db.collection(REVENUE_SPLITS_COLLECTION).doc(splitId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[ExternalSites] DELETE revenue-split error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ BUILDER SESSIONS (admin read-only) ============

app.get('/admin/external/sessions', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { builderHostId, builderPlacementId, status } = req.query;
    let query: any = db.collection(BUILDER_SESSIONS_COLLECTION);
    if (builderHostId) query = query.where('builderHostId', '==', builderHostId);
    if (builderPlacementId) query = query.where('builderPlacementId', '==', builderPlacementId);
    if (status) query = query.where('status', '==', status);
    const snapshot = await query.get();
    const sessions = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    sessions.sort((a: any, b: any) => (b.startedAt || '').localeCompare(a.startedAt || ''));
    res.json(sessions);
  } catch (error: any) {
    console.error('[ExternalSites] GET sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ BUILDER DRAFTS (admin read-only) ============

app.get('/admin/external/drafts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { builderHostId, builderPlacementId, status } = req.query;
    let query: any = db.collection(BUILDER_DRAFTS_COLLECTION);
    if (builderHostId) query = query.where('builderHostId', '==', builderHostId);
    if (builderPlacementId) query = query.where('builderPlacementId', '==', builderPlacementId);
    if (status) query = query.where('status', '==', status);
    const snapshot = await query.get();
    const drafts = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    drafts.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(drafts);
  } catch (error: any) {
    console.error('[ExternalSites] GET drafts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ EMBEDDED ORDER ATTRIBUTIONS (admin read-only) ============

app.get('/admin/external/attributions', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, affiliateUserId, builderHostId } = req.query;
    let query: any = db.collection(EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION);
    if (orderId) query = query.where('orderId', '==', orderId);
    if (affiliateUserId) query = query.where('affiliateUserId', '==', affiliateUserId);
    if (builderHostId) query = query.where('builderHostId', '==', builderHostId);
    const snapshot = await query.get();
    const attributions = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    attributions.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(attributions);
  } catch (error: any) {
    console.error('[ExternalSites] GET attributions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ AFFILIATE PAYOUT LEDGER ============

app.get('/admin/external/payouts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { affiliateUserId, status, builderHostId } = req.query;
    let query: any = db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION);
    if (affiliateUserId) query = query.where('affiliateUserId', '==', affiliateUserId);
    if (status) query = query.where('status', '==', status);
    if (builderHostId) query = query.where('builderHostId', '==', builderHostId);
    const snapshot = await query.get();
    const entries = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    entries.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(entries);
  } catch (error: any) {
    console.error('[ExternalSites] GET payouts error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/external/payouts/:payoutId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { payoutId } = req.params;
    const doc = await db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION).doc(payoutId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Payout entry not found' }); return; }
    const updates: Record<string, any> = {};
    if (req.body.status !== undefined) {
      if (!VALID_PAYOUT_STATUSES.has(req.body.status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${PAYOUT_STATUSES.join(', ')}` }); return;
      }
      updates.status = req.body.status;
      if (req.body.status === 'paid') updates.paidAt = new Date().toISOString();
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    await db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION).doc(payoutId).update(updates);
    res.json({ id: payoutId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[ExternalSites] PATCH payout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PUBLIC EMBED ENDPOINTS ============

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
    const orderItemId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    const attributionData = {
      orderId: checkoutSession.id,
      orderItemId,
      builderHostId: session.builderHostId,
      builderPlacementId: session.builderPlacementId,
      builderProfileId: session.builderProfileId || '',
      affiliateUserId: ctx.affiliateUserId || '',
      surfaceId: effectiveSurfaceId,
      variantId: variantId || null,
      pricingPolicyId: ctx.pricingPolicy?.id || '',
      revenueSplitId: ctx.revenueSplit?.id || '',
      ...pricingSnapshot,
      quantity: qty,
      designSelections: designSelections || {},
      qrSelections: qrSelections || {},
      previewSnapshot: previewSnapshot || null,
      stripeCheckoutSessionId: checkoutSession.id,
      status: 'pending_payment',
      createdAt: now,
    };
    await db.collection(EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION).add(attributionData);

    if (ctx.affiliateUserId && pricingSnapshot.affiliateAmount > 0) {
      const payoutEntry = {
        affiliateUserId: ctx.affiliateUserId,
        builderHostId: session.builderHostId,
        builderPlacementId: session.builderPlacementId,
        orderId: checkoutSession.id,
        orderItemId,
        affiliateAmount: pricingSnapshot.affiliateAmount * qty,
        currency: pricingSnapshot.currency,
        status: 'pending',
        periodKey: getPeriodKey(),
        createdAt: now,
      };
      await db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION).add(payoutEntry);
    }

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
