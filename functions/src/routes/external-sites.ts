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
  EMBED_MODES,
  BUILDER_HOST_STATUSES,
  BUILDER_PROFILE_STATUSES,
  BUILDER_PLACEMENT_STATUSES,
  PAYOUT_STATUSES,
} from '../constants';
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

import { registerExternalSitesPublicRoutes } from './external-sites-public';

export function register(app: express.Express): void {
  registerExternalSitesPublicRoutes(app);
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

}
