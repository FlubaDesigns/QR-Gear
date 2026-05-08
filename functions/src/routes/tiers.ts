import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF, cfCategorizeProduct } from '../core';
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

  export function register(app: express.Express): void {
  // ============ TIER MANAGEMENT ============

app.put('/admin/catalogs/:catalogId/tiers', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankTiers, tierConfig } = req.body;
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const updates: any = { updatedAt: new Date().toISOString() };
    if (blankTiers !== undefined) updates.blankTiers = blankTiers;
    if (tierConfig !== undefined) updates.tierConfig = tierConfig;
    await docRef.update(updates);
    console.log(`[Catalogs] Updated tiers for catalog ${catalogId}`);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/catalogs/:catalogId/blank-tier', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankId, tier } = req.body;
    if (!blankId) { res.status(400).json({ error: 'blankId is required' }); return; }
    const validTiers = ['good', 'better', 'best', null];
    if (!validTiers.includes(tier)) { res.status(400).json({ error: 'tier must be good, better, best, or null' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const blankTiers = doc.data()?.blankTiers || {};
    if (tier === null) {
      delete blankTiers[String(blankId)];
    } else {
      blankTiers[String(blankId)] = tier;
    }
    await docRef.update({ blankTiers, updatedAt: new Date().toISOString() });
    console.log(`[Catalogs] Set blank ${blankId} tier to ${tier || 'none'} in catalog ${catalogId}`);
    res.json({ success: true, blankTiers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/catalogs/:catalogId/tier-config', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { tierConfig } = req.body;
    if (!tierConfig || typeof tierConfig !== 'object') { res.status(400).json({ error: 'tierConfig object is required' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    await docRef.update({ tierConfig, updatedAt: new Date().toISOString() });
    console.log(`[Catalogs] Updated tier config for catalog ${catalogId}`);
    res.json({ success: true, tierConfig });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/catalogs/:catalogId/blank-description', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankId, description } = req.body;
    if (!blankId) { res.status(400).json({ error: 'blankId is required' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const blankDescriptions = doc.data()?.blankDescriptions || {};
    if (description === null || description === '') {
      delete blankDescriptions[String(blankId)];
    } else {
      blankDescriptions[String(blankId)] = description;
    }
    await docRef.update({ blankDescriptions, updatedAt: new Date().toISOString() });
    console.log(`[Catalogs] Updated description for blank ${blankId} in catalog ${catalogId}`);
    res.json({ success: true, blankDescriptions });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/catalogs/:catalogId/blank-title', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { catalogId } = req.params;
    const { blankId, title } = req.body;
    if (!blankId) { res.status(400).json({ error: 'blankId is required' }); return; }
    const docRef = db.collection('catalogs').doc(catalogId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: 'Catalog not found' }); return; }
    const blankTitles = doc.data()?.blankTitles || {};
    if (title === null || title === '') {
      delete blankTitles[String(blankId)];
    } else {
      blankTitles[String(blankId)] = title;
    }
    await docRef.update({ blankTitles, updatedAt: new Date().toISOString() });
    console.log(`[Catalogs] Updated title for blank ${blankId} in catalog ${catalogId}`);
    res.json({ success: true, blankTitles });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/tier-products', async (req: Request, res: Response): Promise<void> => {
  try {
    const section = (req.query.section as string) || 'member';
    const validSections = ['member', 'public', 'external', 'marketplace', 'platform'];
    if (!validSections.includes(section)) { res.status(400).json({ error: `Invalid section` }); return; }
    const assignDoc = await db.collection('systemSettings').doc('catalog-assignments').get();
    const catalogId = assignDoc.exists ? assignDoc.data()?.[section] : null;
    if (!catalogId) { res.json({ hasTiers: false, catalog: null, tiers: {} }); return; }
    const catDoc = await db.collection('catalogs').doc(catalogId).get();
    if (!catDoc.exists) { res.json({ hasTiers: false, catalog: null, tiers: {} }); return; }
    const catData = catDoc.data()!;
    const blankTiers = catData.blankTiers || {};
    const tierConfig = catData.tierConfig || {};
    const blankDescriptions = catData.blankDescriptions || {};
    const hasTiers = Object.keys(blankTiers).length > 0;
    if (!hasTiers) { res.json({ hasTiers: false, catalogId, catalogName: catData.name, tiers: {}, tierConfig }); return; }

    const printifyBlanks = (catData.blankIds || []).filter((id: string) => !String(id).startsWith('pf:'));
    const printfulBlanks = (catData.blankIds || []).filter((id: string) => String(id).startsWith('pf:'));
    const printfulNumericIds = printfulBlanks.map((id: string) => parseInt(String(id).replace('pf:', '')));

    const productLookup = new Map<string, any>();

    if (printifyBlanks.length > 0) {
      const bpSnapshot = await db.collection("printify_blueprints").get();
      bpSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const bpId = d.id || parseInt(doc.id);
        if (!isNaN(bpId)) productLookup.set(String(bpId), { ...d, _source: 'printify' });
      });
    }

    if (printfulBlanks.length > 0) {
      const pfSnapshot = await db.collection("printful_products").get();
      pfSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const pfId = d.id || parseInt(doc.id);
        if (!isNaN(pfId)) {
          productLookup.set(`pf:${pfId}`, {
            title: d.title || '',
            brand: d.brand || '',
            description: d.description || d.model || '',
            images: d.image ? [d.image] : [],
            primaryImageUrl: d.image || null,
            minPrice: d.minPrice ? parseFloat(d.minPrice) : null,
            _source: 'printful',
          });
        }
      });
    }

    let providersByBlueprint = new Map<number, any>();
    if (printifyBlanks.length > 0) {
      const ppSnapshot = await db.collection("printifyPrintProviders").get();
      ppSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const prov = { blueprintId: d.blueprintId, providerId: d.providerId, minCost: d.minCost || 0, maxCost: d.maxCost || 0, availableColors: d.availableColors || [], availableSizes: d.availableSizes || [] };
        const existing = providersByBlueprint.get(prov.blueprintId);
        if (!existing || (prov.availableColors || []).length > (existing.availableColors || []).length) {
          providersByBlueprint.set(prov.blueprintId, prov);
        }
      });
    }

    const pricingDoc = await db.collection('testSettings').doc('pricing').get();
    const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
    const markupPercent = pricingSettings?.markupPercent ?? 25;
    const markupFixed = pricingSettings?.markupFixed ?? 0;

    const categoryTierMap: Record<string, Record<string, any[]>> = {};
    for (const blankId of (catData.blankIds || [])) {
      const blankKey = String(blankId);
      const tier = blankTiers[blankKey];
      if (!tier || !['good', 'better', 'best'].includes(tier)) continue;
      const bp = productLookup.get(blankKey);
      if (!bp) continue;
      const category = cfCategorizeProduct(bp.title);
      if (!categoryTierMap[category]) categoryTierMap[category] = {};
      if (!categoryTierMap[category][tier]) categoryTierMap[category][tier] = [];

      let cost = 0;
      if (bp._source === 'printify') {
        const numId = parseInt(blankKey);
        const prov = providersByBlueprint.get(numId);
        cost = prov?.minCost ? prov.minCost / 100 : 0;
      } else {
        cost = bp.minPrice || 0;
      }
      const retailPrice = Math.ceil((cost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
      const memberEarnings = Math.round((retailPrice - cost) * 25) / 100;

      const numericId = blankKey.startsWith('pf:') ? parseInt(blankKey.replace('pf:', '')) : parseInt(blankKey);
      let availableColors: any[] = [];
      let availableSizes: string[] = [];
      if (bp._source === 'printify') {
        const numId = parseInt(blankKey);
        const prov = providersByBlueprint.get(numId);
        availableColors = (prov?.availableColors || []).map((c: any) => ({ name: c.name || c, hex: c.hex || '' }));
        availableSizes = (prov?.availableSizes || []).map((s: any) => typeof s === 'string' ? s : s.title || String(s));
      }
      const rawRichDesc = bp.richDescription || bp.description || '';
      const providerDescription = rawRichDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const adminCatalogDescription = blankDescriptions[blankKey] || '';
      const effectiveDescription = adminCatalogDescription || providerDescription || `${bp.title}${bp.brand ? ' by ' + bp.brand : ''}. Premium quality print-on-demand ${category.toLowerCase()}.`;
      const provider = bp._source === 'printful' ? 'printful' : 'printify';
      categoryTierMap[category][tier].push({
        blueprintId: numericId,
        canonicalBlankKey: blankKey,
        provider,
        title: bp.title,
        description: effectiveDescription,
        providerDescription,
        adminCatalogDescription: adminCatalogDescription || null,
        effectiveDescription,
        brand: bp.brand,
        imageUrl: bp.images?.[0] || bp.primaryImageUrl || null,
        cost,
        retailPrice,
        memberEarnings,
        fulfillmentProvider: provider,
        availableColors,
        availableSizes,
        colors: availableColors,
        sizes: availableSizes,
      });
    }

    const defaultNames: Record<string, { displayName: string; description: string; tagline: string }> = {
      good: { displayName: 'Good', description: 'Premium quality products', tagline: 'Great value, great quality' },
      better: { displayName: 'Better', description: 'Enhanced premium products', tagline: 'Step up your game' },
      best: { displayName: 'Best', description: 'Boutique-level products', tagline: 'The finest available' },
    };

    const tiers: Record<string, Record<string, any>> = {};
    for (const [category, tierMap] of Object.entries(categoryTierMap)) {
      tiers[category] = {};
      for (const [tier, products] of Object.entries(tierMap)) {
        const cfg = tierConfig[tier] || {};
        tiers[category][tier] = {
          tier,
          displayName: cfg.displayName || defaultNames[tier]?.displayName || tier,
          description: cfg.description || defaultNames[tier]?.description || '',
          tagline: cfg.tagline || defaultNames[tier]?.tagline || '',
          products,
        };
      }
    }

    res.json({ hasTiers: true, catalogId, catalogName: catData.name, tiers, tierConfig });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/catalog-for-section/:section', async (req: Request, res: Response): Promise<void> => {
  try {
    const { section } = req.params;
    const validSections = ['member', 'public', 'external', 'marketplace', 'platform'];
    if (!validSections.includes(section)) { res.status(400).json({ error: `Invalid section. Must be one of: ${validSections.join(', ')}` }); return; }
    const assignDoc = await db.collection('systemSettings').doc('catalog-assignments').get();
    const catalogId = assignDoc.exists ? assignDoc.data()?.[section] : null;
    if (!catalogId) {
      res.json({ catalog: null, blanks: [], message: `No catalog assigned to "${section}"` });
      return;
    }
    const catDoc = await db.collection('catalogs').doc(catalogId).get();
    if (!catDoc.exists) {
      res.json({ catalog: null, blanks: [], message: `Assigned catalog not found` });
      return;
    }
    const catData = catDoc.data() || {};
    const catalog = { id: catDoc.id, ...catData };
    res.json({ catalog, blanks: catData.blankIds || [] });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog-health', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [productsSnap, allowedDoc, catalogsSnap, assignDoc] = await Promise.all([
      db.collection('products').get(),
      db.collection('storeAllowedProducts').doc('member-products').get(),
      db.collection('catalogs').get(),
      db.collection('systemSettings').doc('catalog-assignments').get(),
    ]);

    const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const enabledProducts = allProducts.filter((p: any) => p.isEnabled !== false);
    const allowedProducts = allowedDoc.exists ? (allowedDoc.data()?.products || []) : [];
    const providers = [...new Set(allProducts.map((p: any) => p.provider || 'unknown'))];

    const catalogs = catalogsSnap.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: data.name, blankCount: (data.blankIds || []).length };
    });

    const assignments = assignDoc.exists ? assignDoc.data() : {};
    const sections = ['member', 'public', 'external', 'marketplace', 'platform'];
    const sectionStatus: Record<string, any> = {};
    for (const s of sections) {
      const catId = assignments?.[s] || null;
      const cat = catId ? catalogs.find(c => c.id === catId) : null;
      sectionStatus[s] = {
        catalogId: catId,
        catalogName: cat?.name || null,
        blankCount: cat?.blankCount || 0,
        status: catId ? (cat ? 'assigned' : 'missing-catalog') : 'unassigned',
      };
    }

    res.json({
      totalProducts: allProducts.length,
      enabledProducts: enabledProducts.length,
      allowedMemberProducts: allowedProducts.length,
      providers,
      catalogs,
      sections: sectionStatus,
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


  }
  