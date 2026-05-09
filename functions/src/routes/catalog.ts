import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
import { printfulClient } from '../services/printful';
  import { printifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE } from '../services/printify';
  import { generateSignedUrl, addSignedUrlsToAssets, downloadAndStoreImage } from '../services/storage-helpers';
  import { calculateAuthoritativePrice, getAuthoritativePrice } from '../services/pricing';
  import { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS } from '../services/mockup-generator';
  import type { MockupRequest, MockupResult } from '../services/mockup-generator';
  import { getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulStoreId, PRINTFUL_API_BASE } from '../services/printful';
  import type { PrintfulMockupTask, PrintfulVariant } from '../services/printful';
  import { getResendClient, QR_GEAR_FROM_EMAIL } from '../services/email';
  import { cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE, getCanvas, getQRCode } from '../services/composite-image';

import { isValidMasterCatalogDocId } from '../../../shared/qrgCodes';

class CatalogBlankResolverError extends Error {
  readonly statusCode = 400;
  readonly failedBlankId?: string;
  constructor(message: string, failedBlankId?: string) {
    super(message);
    this.name = 'CatalogBlankResolverError';
    this.failedBlankId = failedBlankId;
  }
}

/**
 * Resolves any blank ID input to its canonical master_catalog doc ID (qrg_STNNN).
 *
 * Accepted input forms:
 *   qrg_STNNN   — canonical QRG doc ID (verified against master_catalog)
 *   pending_*   — migration pending; returns null (caller decides whether to allow)
 *   py_NNN      — Printify blueprint ID prefix
 *   pf_NNN      — Printful product ID prefix (underscore form)
 *   pf:NNN      — Printful product ID prefix (colon form)
 *   NNN         — plain numeric (tried as Printify blueprint ID first)
 *
 * Returns:
 *   string  — canonical qrg_STNNN doc ID
 *   null    — intentional pending/migration ID (soft allow)
 *
 * Throws CatalogBlankResolverError (HTTP 400):
 *   — input cannot be resolved to any master_catalog record, or is structurally invalid
 *
 * Never invents a QRG ID. Only returns what exists in Firestore.
 */
async function resolveCatalogBlankId(inputId: string): Promise<string | null> {
  const id = String(inputId ?? '').trim();
  if (!id) throw new CatalogBlankResolverError('blankId must be a non-empty string');

  if (isValidMasterCatalogDocId(id)) {
    const doc = await db.collection('master_catalog').doc(id).get();
    if (doc.exists) return id;
    throw new CatalogBlankResolverError(`QRG blank "${id}" not found in master_catalog. Verify the blank has been synced.`, id);
  }

  if (id.startsWith('pending_')) return null;

  let numericId: number | null = null;
  const candidates: string[] = [id];

  if (id.startsWith('py_')) {
    const n = parseInt(id.slice(3), 10);
    if (!isNaN(n)) { numericId = n; candidates.push(String(n)); }
  } else if (id.startsWith('pf_')) {
    const n = parseInt(id.slice(3), 10);
    if (!isNaN(n)) { numericId = n; candidates.push(`pf:${n}`, String(n)); }
  } else if (id.startsWith('pf:')) {
    const n = parseInt(id.slice(3), 10);
    if (!isNaN(n)) { numericId = n; candidates.push(`pf_${n}`, String(n)); }
  } else {
    const n = parseInt(id, 10);
    if (!isNaN(n) && String(n) === id) {
      numericId = n;
      candidates.push(`py_${n}`, `pf_${n}`, `pf:${n}`);
    }
  }

  for (const candidate of candidates) {
    const doc = await db.collection('master_catalog').doc(candidate).get();
    if (doc.exists) {
      const docId = doc.id;
      if (isValidMasterCatalogDocId(docId)) return docId;
      if (docId.startsWith('pending_')) return null;
      break;
    }
  }

  if (numericId !== null) {
    const pyQ = await db.collection('master_catalog')
      .where('printifyBlueprintId', '==', numericId).limit(1).get();
    if (!pyQ.empty) {
      const docId = pyQ.docs[0].id;
      if (isValidMasterCatalogDocId(docId)) return docId;
      if (docId.startsWith('pending_')) return null;
    }

    const pfQ = await db.collection('master_catalog')
      .where('printfulProductId', '==', numericId).limit(1).get();
    if (!pfQ.empty) {
      const docId = pfQ.docs[0].id;
      if (isValidMasterCatalogDocId(docId)) return docId;
      if (docId.startsWith('pending_')) return null;
    }
  }

  throw new CatalogBlankResolverError(
    `Cannot resolve "${id}" to a QRG master_catalog record. ` +
    `Provider IDs (py_/pf_/pf:) are lookup references only — the blank must exist in master_catalog with a qrg_STNNN identity.`,
    id
  );
}

  export function register(app: express.Express): void {

  // ── Helper: seed blanks + metadata into the "Primary" catalog ────────────
  async function seedIntoPrimary(
    excludeCatalogId: string,
    blankIds: string[],
    metaMaps: Record<string, Record<string, any>>
  ): Promise<void> {
    try {
      const snap = await db.collection('catalogs').where('name', '==', 'Primary').limit(1).get();
      if (snap.empty) return;
      const primaryRef = snap.docs[0].ref;
      const primaryId = snap.docs[0].id;
      if (primaryId === excludeCatalogId) return;
      const primaryData = snap.docs[0].data();
      const existing = (primaryData.blankIds || []).map(String);
      const merged = [...new Set([...existing, ...blankIds.map(String)])];
      const updates: any = { blankIds: merged, updatedAt: new Date().toISOString() };
      const metaFields = ['blankTiers', 'blankDescriptions', 'blankTitles', 'blankMakers', 'blankModels', 'blankProviders', 'blankImages', 'blankPrimaryImages'];
      for (const field of metaFields) {
        const srcMap: Record<string, any> = metaMaps[field] || {};
        const targetMap: Record<string, any> = { ...(primaryData[field] || {}) };
        for (const blankId of blankIds.map(String)) {
          if (!(blankId in targetMap) && blankId in srcMap) targetMap[blankId] = srcMap[blankId];
        }
        updates[field] = targetMap;
      }
      await primaryRef.update(updates);
      console.log(`[Catalogs] Seeded ${blankIds.length} blanks into Primary catalog (${primaryId})`);
    } catch (err: any) {
      console.warn(`[Catalogs] seedIntoPrimary failed (non-fatal): ${err.message}`);
    }
  }

  // ============ CATALOG MANAGEMENT SYSTEM ============

app.get('/admin/catalogs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('catalogs').orderBy('createdAt', 'desc').get();
    const catalogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ catalogs });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/catalogs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string') { res.status(400).json({ error: 'name is required' }); return; }
    const doc = await db.collection('catalogs').add({
      name: name.trim(),
      description: (description || '').trim(),
      blankIds: [],
      blankTiers: {},
      tierConfig: {},
      blankDescriptions: {},
      blankTitles: {},
      blankMakers: {},
      blankModels: {},
      blankProviders: {},
      blankImages: {},
      blankPrimaryImages: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`[Catalogs] Created catalog "${name}" with id ${doc.id}`);
    res.json({ id: doc.id, name: name.trim(), description: (description || '').trim(), blankIds: [], createdAt: new Date().toISOString() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/catalogs/:catalogId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const updates: any = { updatedAt: new Date().toISOString() };
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
    if (Array.isArray(req.body.blankIds)) {
      // Resolve all IDs to canonical qrg_STNNN before persisting
      const resolvedIds: string[] = [];
      for (const rawId of req.body.blankIds) {
        const canonical = await resolveCatalogBlankId(String(rawId));
        if (canonical !== null) resolvedIds.push(canonical);
      }
      updates.blankIds = resolvedIds;
    }
    await db.collection('catalogs').doc(catalogId).update(updates);
    console.log(`[Catalogs] Updated catalog ${catalogId}`);
    res.json({ success: true, catalogId });
  } catch (error: any) {
    if (error instanceof CatalogBlankResolverError) { res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId }); return; }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/catalogs/:catalogId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const assignDoc = await db.collection('systemSettings').doc('catalog-assignments').get();
    if (assignDoc.exists) {
      const data = assignDoc.data() || {};
      const sections = ['member', 'public', 'external', 'marketplace', 'platform'];
      for (const section of sections) {
        if (data[section] === catalogId) {
          res.status(400).json({ error: `Cannot delete: catalog is assigned to "${section}" section. Unassign it first.` });
          return;
        }
      }
    }
    await db.collection('catalogs').doc(catalogId).delete();
    console.log(`[Catalogs] Deleted catalog ${catalogId}`);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/catalogs/:catalogId/blanks', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankIds, blankSnapshots } = req.body;
    if (!Array.isArray(blankIds)) { res.status(400).json({ error: 'blankIds must be an array' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const catalog = doc.data()!;

    // Resolve all inputs to canonical qrg_STNNN identities before persisting.
    // Also build a rawId → canonicalId map so blankSnapshots keys are re-keyed correctly.
    const resolvedIds: string[] = [];
    const rawToCanonical = new Map<string, string>();
    for (const rawId of blankIds) {
      const canonical = await resolveCatalogBlankId(String(rawId));
      if (canonical !== null) {
        resolvedIds.push(canonical);
        rawToCanonical.set(String(rawId), canonical);
      }
      // null = pending migration ID → silently skip (not persisted)
    }

    const existing = (catalog.blankIds || []).map(String);
    const merged = [...new Set([...existing, ...resolvedIds])];
    const updates: any = { blankIds: merged, updatedAt: new Date().toISOString() };
    if (blankSnapshots && typeof blankSnapshots === 'object') {
      const snapshotFieldMap = [
        { field: 'blankTitles', key: 'title' },
        { field: 'blankMakers', key: 'maker' },
        { field: 'blankModels', key: 'model' },
        { field: 'blankProviders', key: 'providers' },
        { field: 'blankImages', key: 'images' },
        { field: 'blankPrimaryImages', key: 'primaryImageUrl' },
      ];
      for (const { field, key } of snapshotFieldMap) {
        const existingMap = { ...(catalog[field] || {}) };
        for (const [rawBlankId, snap] of Object.entries(blankSnapshots as Record<string, any>)) {
          // Only write under the canonical key — skip entirely if not resolvable or pending
          const canonicalKey = rawToCanonical.get(String(rawBlankId));
          if (!canonicalKey) continue;
          if (!(canonicalKey in existingMap) && snap[key] != null) existingMap[canonicalKey] = snap[key];
        }
        updates[field] = existingMap;
      }
    }
    await docRef.update(updates);
    seedIntoPrimary(catalogId, resolvedIds, updates);
    console.log(`[Catalogs] Added ${resolvedIds.length} blanks to catalog ${catalogId}. Total: ${merged.length}`);
    res.json({ success: true, count: merged.length });
  } catch (error: any) {
    if (error instanceof CatalogBlankResolverError) { res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId }); return; }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/catalogs/:catalogId/blanks', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankIds } = req.body;
    if (!Array.isArray(blankIds)) { res.status(400).json({ error: 'blankIds must be an array' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const catalog = doc.data()!;

    // Build the set of keys to remove: always include the raw input key (handles
    // legacy stored IDs), plus the resolved canonical key when resolvable.
    // Unresolvable IDs (not found in master_catalog) return 400.
    const removeSet = new Set<string>();
    for (const rawId of blankIds) {
      const raw = String(rawId);
      removeSet.add(raw);
      const canonical = await resolveCatalogBlankId(raw);
      if (canonical) removeSet.add(canonical);
    }

    const existing: string[] = catalog.blankIds || [];
    const remaining = existing.filter(id => !removeSet.has(String(id)));
    const removedCount = existing.length - remaining.length;
    const blankTiers = { ...(catalog.blankTiers || {}) };
    const blankDescriptions = { ...(catalog.blankDescriptions || {}) };
    const blankTitles = { ...(catalog.blankTitles || {}) };
    const blankMakers = { ...(catalog.blankMakers || {}) };
    const blankModels = { ...(catalog.blankModels || {}) };
    const blankProviders = { ...(catalog.blankProviders || {}) };
    const blankImages = { ...(catalog.blankImages || {}) };
    const blankPrimaryImages = { ...(catalog.blankPrimaryImages || {}) };
    removeSet.forEach((key) => {
      delete blankTiers[key];
      delete blankDescriptions[key];
      delete blankTitles[key];
      delete blankMakers[key];
      delete blankModels[key];
      delete blankProviders[key];
      delete blankImages[key];
      delete blankPrimaryImages[key];
    });
    await docRef.update({ blankIds: remaining, blankTiers, blankDescriptions, blankTitles, blankMakers, blankModels, blankProviders, blankImages, blankPrimaryImages, updatedAt: new Date().toISOString() });
    if (removedCount === 0) {
      console.warn(`[Catalogs] WARNING: Delete for [${blankIds.join(', ')}] in catalog ${catalogId} matched nothing. Existing keys: [${existing.slice(0, 20).join(', ')}]`);
    } else {
      console.log(`[Catalogs] Removed ${removedCount} blanks from catalog ${catalogId}. Remaining: ${remaining.length}`);
    }
    res.json({ success: true, removed: removedCount, total: remaining.length });
  } catch (error: any) {
    if (error instanceof CatalogBlankResolverError) { res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId }); return; }
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/catalogs/:catalogId/duplicate', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const srcDoc = await db.collection('catalogs').doc(catalogId).get();
    if (!srcDoc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const src = srcDoc.data()!;
    const newName = req.body.name || `${src.name} (Copy)`;
    const newCatalog: any = {
      name: newName,
      description: src.description || '',
      blankIds: src.blankIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (src.blankTiers) newCatalog.blankTiers = src.blankTiers;
    if (src.tierConfig) newCatalog.tierConfig = src.tierConfig;
    if (src.blankDescriptions) newCatalog.blankDescriptions = src.blankDescriptions;
    if (src.blankTitles) newCatalog.blankTitles = src.blankTitles;
    if (src.blankMakers) newCatalog.blankMakers = src.blankMakers;
    if (src.blankModels) newCatalog.blankModels = src.blankModels;
    if (src.blankProviders) newCatalog.blankProviders = src.blankProviders;
    if (src.blankImages) newCatalog.blankImages = src.blankImages;
    if (src.blankPrimaryImages) newCatalog.blankPrimaryImages = src.blankPrimaryImages;
    const doc = await db.collection('catalogs').add(newCatalog);
    console.log(`[Catalogs] Duplicated catalog "${src.name}" → "${newName}" (${doc.id}), ${(src.blankIds || []).length} blanks`);
    res.json({ id: doc.id, name: newName, description: src.description || '', blankIds: src.blankIds || [], createdAt: new Date().toISOString() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/catalogs/:catalogId/bulk-copy', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { targetCatalogId, blankIds } = req.body;
    if (!targetCatalogId) { res.status(400).json({ error: 'targetCatalogId is required' }); return; }
    if (!Array.isArray(blankIds) || blankIds.length === 0) { res.status(400).json({ error: 'blankIds must be a non-empty array' }); return; }
    const srcDoc = await db.collection('catalogs').doc(catalogId).get();
    if (!srcDoc.exists) { res.status(404).json({ error: 'Source catalog not found' }); return; }
    const targetRef = db.collection('catalogs').doc(targetCatalogId);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) { res.status(404).json({ error: 'Target catalog not found' }); return; }
    const src = srcDoc.data()!;
    const target = targetDoc.data()!;

    // Resolve all inputs to canonical qrg_STNNN identities before persisting
    const resolvedIds: string[] = [];
    for (const rawId of blankIds) {
      const canonical = await resolveCatalogBlankId(String(rawId));
      if (canonical !== null) resolvedIds.push(canonical);
    }

    const existing = (target.blankIds || []).map(String);
    const merged = [...new Set([...existing, ...resolvedIds])];
    const updates: any = { blankIds: merged, updatedAt: new Date().toISOString() };
    const metaFields = ['blankTiers', 'blankDescriptions', 'blankTitles', 'blankMakers', 'blankModels', 'blankProviders', 'blankImages', 'blankPrimaryImages'];
    for (const field of metaFields) {
      const srcMap: Record<string, any> = src[field] || {};
      const targetMap: Record<string, any> = { ...(target[field] || {}) };
      for (const blankId of resolvedIds) {
        if (!(blankId in targetMap) && blankId in srcMap) {
          targetMap[blankId] = srcMap[blankId];
        }
      }
      updates[field] = targetMap;
    }
    await targetRef.update(updates);
    seedIntoPrimary(targetCatalogId, resolvedIds, updates);
    const added = merged.length - existing.length;
    console.log(`[Catalogs] Bulk copied ${resolvedIds.length} blanks from ${catalogId} to ${targetCatalogId}. ${added} new, ${merged.length} total`);
    res.json({ success: true, added, total: merged.length });
  } catch (error: any) {
    if (error instanceof CatalogBlankResolverError) { res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId }); return; }
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog-defaults', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('systemSettings').doc('catalog-defaults').get();
    const data = doc.exists ? doc.data() : {};
    res.json({ defaultCatalogId: data?.defaultCatalogId || null });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/catalog-defaults', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { defaultCatalogId } = req.body;
    if (defaultCatalogId) {
      const catDoc = await db.collection('catalogs').doc(defaultCatalogId).get();
      if (!catDoc.exists) { res.status(400).json({ error: 'Catalog not found' }); return; }
    }
    await db.collection('systemSettings').doc('catalog-defaults').set(
      { defaultCatalogId: defaultCatalogId || null, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log(`[Catalogs] Set default catalog: ${defaultCatalogId || 'none'}`);
    res.json({ success: true, defaultCatalogId: defaultCatalogId || null });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/catalogs/:catalogId/blank-images', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankId, images } = req.body;
    if (!blankId || !Array.isArray(images)) { res.status(400).json({ error: 'blankId and images[] required' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const canonicalId = await resolveCatalogBlankId(String(blankId));
    if (canonicalId === null) { res.status(400).json({ error: `Blank "${blankId}" is pending classification` }); return; }
    const blankImages = { ...(doc.data()?.blankImages || {}) };
    if (images.length > 0) {
      blankImages[canonicalId] = images.map(String);
    } else {
      // Empty array = restore master — remove override entry
      delete blankImages[canonicalId];
    }
    await docRef.update({ blankImages, updatedAt: new Date().toISOString() });
    console.log(`[Catalogs] Updated images for blank ${canonicalId} in catalog ${catalogId}: ${images.length} images`);
    res.json({ success: true, blankId: canonicalId, imageCount: images.length });
  } catch (error: any) {
    if (error instanceof CatalogBlankResolverError) { res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId }); return; }
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/catalogs/:catalogId/blank-tier', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankId, tier } = req.body;
    if (!blankId) { res.status(400).json({ error: 'blankId is required' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const canonicalId = await resolveCatalogBlankId(String(blankId));
    if (canonicalId === null) { res.status(400).json({ error: `Blank "${blankId}" is pending classification and cannot be tier-assigned yet` }); return; }
    const blankTiers = { ...(doc.data()?.blankTiers || {}) };
    if (tier) {
      blankTiers[canonicalId] = tier;
    } else {
      delete blankTiers[canonicalId];
    }
    await docRef.update({ blankTiers, updatedAt: new Date().toISOString() });
    res.json({ success: true, blankTiers });
  } catch (error: any) {
    if (error instanceof CatalogBlankResolverError) { res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId }); return; }
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/catalogs/:catalogId/blank-description', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankId, description } = req.body;
    if (!blankId) { res.status(400).json({ error: 'blankId is required' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const canonicalId = await resolveCatalogBlankId(String(blankId));
    if (canonicalId === null) { res.status(400).json({ error: `Blank "${blankId}" is pending classification` }); return; }
    const blankDescriptions = { ...(doc.data()?.blankDescriptions || {}) };
    if (description) {
      blankDescriptions[canonicalId] = description;
    } else {
      delete blankDescriptions[canonicalId];
    }
    await docRef.update({ blankDescriptions, updatedAt: new Date().toISOString() });
    res.json({ success: true, blankDescriptions });
  } catch (error: any) {
    if (error instanceof CatalogBlankResolverError) { res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId }); return; }
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/catalogs/:catalogId/blank-title', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankId, title } = req.body;
    if (!blankId) { res.status(400).json({ error: 'blankId is required' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const canonicalId = await resolveCatalogBlankId(String(blankId));
    if (canonicalId === null) { res.status(400).json({ error: `Blank "${blankId}" is pending classification` }); return; }
    const blankTitles = { ...(doc.data()?.blankTitles || {}) };
    if (title) {
      blankTitles[canonicalId] = title;
    } else {
      delete blankTitles[canonicalId];
    }
    await docRef.update({ blankTitles, updatedAt: new Date().toISOString() });
    res.json({ success: true, blankTitles });
  } catch (error: any) {
    if (error instanceof CatalogBlankResolverError) { res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId }); return; }
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog-assignments', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('systemSettings').doc('catalog-assignments').get();
    const data = doc.exists ? doc.data() : {};
    res.json({
      member: data?.member || null,
      public: data?.public || null,
      external: data?.external || null,
      marketplace: data?.marketplace || null,
      platform: data?.platform || null,
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/catalog-assignments', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { member, public: pub, external, marketplace, platform } = req.body;
    const updates: any = { updatedAt: new Date().toISOString() };
    if (member !== undefined) updates.member = member;
    if (pub !== undefined) updates.public = pub;
    if (external !== undefined) updates.external = external;
    if (marketplace !== undefined) updates.marketplace = marketplace;
    if (platform !== undefined) updates.platform = platform;
    await db.collection('systemSettings').doc('catalog-assignments').set(updates, { merge: true });
    console.log(`[Catalogs] Updated section assignments:`, updates);
    res.json({ success: true, assignments: updates });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /admin/catalogs/migrate-blank-ids
// Finding-A remediation: scans every catalog for legacy provider-prefixed blankIds
// (py_NNN, pf_NNN, pf:NNN, plain numeric) and resolves them to canonical qrg_STNNN.
// Also remaps all overlay maps (blankTiers, blankDescriptions, blankTitles, etc.) to
// use the new key. Unresolvable IDs are dropped and reported. Idempotent — safe to re-run.
app.post('/admin/catalogs/migrate-blank-ids', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const OVERLAY_MAPS = ['blankTiers', 'blankDescriptions', 'blankTitles', 'blankMakers', 'blankModels', 'blankProviders', 'blankImages', 'blankPrimaryImages'];
    const QRG_RE = /^qrg_[1-6][1-9][0-9]{3}$/;

    const snap = await db.collection('catalogs').get();
    const report: any[] = [];

    for (const docSnap of snap.docs) {
      const catalogId = docSnap.id;
      const data = docSnap.data();
      const blankIds: string[] = (data.blankIds || []).map(String);

      const legacyIds = blankIds.filter(id => !QRG_RE.test(id) && !id.startsWith('pending_'));
      if (legacyIds.length === 0) {
        report.push({ catalogId, name: data.name, status: 'clean' });
        continue;
      }

      const resolvedIds: string[] = [];
      const dropped: string[] = [];
      const remap = new Map<string, string | null>(); // oldKey → newKey (null = drop)

      for (const rawId of blankIds) {
        const id = String(rawId);
        if (QRG_RE.test(id) || id.startsWith('pending_')) {
          resolvedIds.push(id);
          continue;
        }
        try {
          const canonical = await resolveCatalogBlankId(id);
          if (canonical === null) { resolvedIds.push(id); continue; } // pending — keep
          remap.set(id, canonical);
          resolvedIds.push(canonical);
        } catch {
          remap.set(id, null);
          dropped.push(id);
        }
      }

      const newBlankIds = [...new Set(resolvedIds)]; // deduplicate

      const updates: any = { blankIds: newBlankIds, updatedAt: new Date().toISOString() };
      for (const mapField of OVERLAY_MAPS) {
        const oldMap: Record<string, any> = data[mapField] || {};
        if (Object.keys(oldMap).length === 0) continue;
        const newMap: Record<string, any> = {};
        for (const [k, v] of Object.entries(oldMap)) {
          const newKey = remap.has(k) ? remap.get(k) : k;
          if (newKey !== null && newKey !== undefined) newMap[newKey] = v;
        }
        updates[mapField] = newMap;
      }

      await docSnap.ref.update(updates);
      console.log(`[CatalogMigration] Migrated catalog "${data.name}" (${catalogId}): ${remap.size} remapped, ${dropped.length} dropped`);
      report.push({ catalogId, name: data.name, status: 'migrated', remapped: remap.size, dropped: dropped.length, droppedIds: dropped });
    }

    const migrated = report.filter(r => r.status === 'migrated').length;
    const clean = report.filter(r => r.status === 'clean').length;
    console.log(`[CatalogMigration] Done: ${snap.size} catalogs scanned, ${migrated} migrated, ${clean} already clean`);
    res.json({ success: true, catalogsScanned: snap.size, migrated, clean, report });
  } catch (error: any) {
    console.error('[CatalogMigration] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


  }
  