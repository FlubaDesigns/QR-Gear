"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ TIER MANAGEMENT ============
    app.put('/admin/catalogs/:catalogId/tiers', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const { blankTiers, tierConfig } = req.body;
            const docRef = core_1.db.collection('catalogs').doc(catalogId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Catalog not found' });
                return;
            }
            const updates = { updatedAt: new Date().toISOString() };
            if (blankTiers !== undefined)
                updates.blankTiers = blankTiers;
            if (tierConfig !== undefined)
                updates.tierConfig = tierConfig;
            await docRef.update(updates);
            console.log(`[Catalogs] Updated tiers for catalog ${catalogId}`);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/catalogs/:catalogId/blank-tier', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const { blankId, tier } = req.body;
            if (!blankId) {
                res.status(400).json({ error: 'blankId is required' });
                return;
            }
            const validTiers = ['good', 'better', 'best', null];
            if (!validTiers.includes(tier)) {
                res.status(400).json({ error: 'tier must be good, better, best, or null' });
                return;
            }
            const docRef = core_1.db.collection('catalogs').doc(catalogId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Catalog not found' });
                return;
            }
            const blankTiers = doc.data()?.blankTiers || {};
            if (tier === null) {
                delete blankTiers[String(blankId)];
            }
            else {
                blankTiers[String(blankId)] = tier;
            }
            await docRef.update({ blankTiers, updatedAt: new Date().toISOString() });
            console.log(`[Catalogs] Set blank ${blankId} tier to ${tier || 'none'} in catalog ${catalogId}`);
            res.json({ success: true, blankTiers });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/catalogs/:catalogId/tier-config', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const { tierConfig } = req.body;
            if (!tierConfig || typeof tierConfig !== 'object') {
                res.status(400).json({ error: 'tierConfig object is required' });
                return;
            }
            const docRef = core_1.db.collection('catalogs').doc(catalogId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Catalog not found' });
                return;
            }
            await docRef.update({ tierConfig, updatedAt: new Date().toISOString() });
            console.log(`[Catalogs] Updated tier config for catalog ${catalogId}`);
            res.json({ success: true, tierConfig });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/catalogs/:catalogId/blank-description', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const { blankId, description } = req.body;
            if (!blankId) {
                res.status(400).json({ error: 'blankId is required' });
                return;
            }
            const docRef = core_1.db.collection('catalogs').doc(catalogId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Catalog not found' });
                return;
            }
            const blankDescriptions = doc.data()?.blankDescriptions || {};
            if (description === null || description === '') {
                delete blankDescriptions[String(blankId)];
            }
            else {
                blankDescriptions[String(blankId)] = description;
            }
            await docRef.update({ blankDescriptions, updatedAt: new Date().toISOString() });
            console.log(`[Catalogs] Updated description for blank ${blankId} in catalog ${catalogId}`);
            res.json({ success: true, blankDescriptions });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/tier-products', async (req, res) => {
        try {
            const section = req.query.section || 'member';
            const validSections = ['member', 'public', 'external', 'marketplace', 'platform'];
            if (!validSections.includes(section)) {
                res.status(400).json({ error: `Invalid section` });
                return;
            }
            const assignDoc = await core_1.db.collection('systemSettings').doc('catalog-assignments').get();
            const catalogId = assignDoc.exists ? assignDoc.data()?.[section] : null;
            if (!catalogId) {
                res.json({ hasTiers: false, catalog: null, tiers: {} });
                return;
            }
            const catDoc = await core_1.db.collection('catalogs').doc(catalogId).get();
            if (!catDoc.exists) {
                res.json({ hasTiers: false, catalog: null, tiers: {} });
                return;
            }
            const catData = catDoc.data();
            const blankTiers = catData.blankTiers || {};
            const tierConfig = catData.tierConfig || {};
            const blankDescriptions = catData.blankDescriptions || {};
            const hasTiers = Object.keys(blankTiers).length > 0;
            if (!hasTiers) {
                res.json({ hasTiers: false, catalogId, catalogName: catData.name, tiers: {}, tierConfig });
                return;
            }
            const printifyBlanks = (catData.blankIds || []).filter((id) => !String(id).startsWith('pf:'));
            const printfulBlanks = (catData.blankIds || []).filter((id) => String(id).startsWith('pf:'));
            const printfulNumericIds = printfulBlanks.map((id) => parseInt(String(id).replace('pf:', '')));
            const productLookup = new Map();
            if (printifyBlanks.length > 0) {
                const bpSnapshot = await core_1.db.collection("printify_blueprints").get();
                bpSnapshot.docs.forEach(doc => {
                    const d = doc.data();
                    const bpId = d.id || parseInt(doc.id);
                    if (!isNaN(bpId))
                        productLookup.set(String(bpId), { ...d, _source: 'printify' });
                });
            }
            if (printfulBlanks.length > 0) {
                const pfSnapshot = await core_1.db.collection("printful_products").get();
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
            let providersByBlueprint = new Map();
            if (printifyBlanks.length > 0) {
                const ppSnapshot = await core_1.db.collection("printifyPrintProviders").get();
                ppSnapshot.docs.forEach(doc => {
                    const d = doc.data();
                    const prov = { blueprintId: d.blueprintId, providerId: d.providerId, minCost: d.minCost || 0, maxCost: d.maxCost || 0, availableColors: d.availableColors || [], availableSizes: d.availableSizes || [] };
                    const existing = providersByBlueprint.get(prov.blueprintId);
                    if (!existing || (prov.availableColors || []).length > (existing.availableColors || []).length) {
                        providersByBlueprint.set(prov.blueprintId, prov);
                    }
                });
            }
            const pricingDoc = await core_1.db.collection('testSettings').doc('pricing').get();
            const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
            const markupPercent = pricingSettings?.markupPercent ?? 25;
            const markupFixed = pricingSettings?.markupFixed ?? 0;
            const categoryTierMap = {};
            for (const blankId of (catData.blankIds || [])) {
                const blankKey = String(blankId);
                const tier = blankTiers[blankKey];
                if (!tier || !['good', 'better', 'best'].includes(tier))
                    continue;
                const bp = productLookup.get(blankKey);
                if (!bp)
                    continue;
                const category = (0, core_1.cfCategorizeProduct)(bp.title);
                if (!categoryTierMap[category])
                    categoryTierMap[category] = {};
                if (!categoryTierMap[category][tier])
                    categoryTierMap[category][tier] = [];
                let cost = 0;
                if (bp._source === 'printify') {
                    const numId = parseInt(blankKey);
                    const prov = providersByBlueprint.get(numId);
                    cost = prov?.minCost ? prov.minCost / 100 : 0;
                }
                else {
                    cost = bp.minPrice || 0;
                }
                const retailPrice = Math.ceil((cost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
                const memberEarnings = Math.round((retailPrice - cost) * 25) / 100;
                const numericId = blankKey.startsWith('pf:') ? parseInt(blankKey.replace('pf:', '')) : parseInt(blankKey);
                let availableColors = [];
                let availableSizes = [];
                if (bp._source === 'printify') {
                    const numId = parseInt(blankKey);
                    const prov = providersByBlueprint.get(numId);
                    availableColors = (prov?.availableColors || []).map((c) => ({ name: c.name || c, hex: c.hex || '' }));
                    availableSizes = (prov?.availableSizes || []).map((s) => typeof s === 'string' ? s : s.title || String(s));
                }
                const rawRichDesc = bp.richDescription || bp.description || '';
                const originalDescription = rawRichDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                const adminDescription = blankDescriptions[blankKey] || '';
                const description = adminDescription || originalDescription || `${bp.title}${bp.brand ? ' by ' + bp.brand : ''}. Premium quality print-on-demand ${category.toLowerCase()}.`;
                const provider = bp._source === 'printful' ? 'printful' : 'printify';
                categoryTierMap[category][tier].push({
                    blueprintId: numericId,
                    canonicalBlankKey: blankKey,
                    provider,
                    title: bp.title,
                    description,
                    providerDescription: originalDescription,
                    adminCatalogDescription: adminDescription || null,
                    effectiveDescription: description,
                    originalDescription,
                    adminDescription,
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
            const defaultNames = {
                good: { displayName: 'Good', description: 'Premium quality products', tagline: 'Great value, great quality' },
                better: { displayName: 'Better', description: 'Enhanced premium products', tagline: 'Step up your game' },
                best: { displayName: 'Best', description: 'Boutique-level products', tagline: 'The finest available' },
            };
            const tiers = {};
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
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/catalog-for-section/:section', async (req, res) => {
        try {
            const { section } = req.params;
            const validSections = ['member', 'public', 'external', 'marketplace', 'platform'];
            if (!validSections.includes(section)) {
                res.status(400).json({ error: `Invalid section. Must be one of: ${validSections.join(', ')}` });
                return;
            }
            const assignDoc = await core_1.db.collection('systemSettings').doc('catalog-assignments').get();
            const catalogId = assignDoc.exists ? assignDoc.data()?.[section] : null;
            if (!catalogId) {
                res.json({ catalog: null, blanks: [], message: `No catalog assigned to "${section}"` });
                return;
            }
            const catDoc = await core_1.db.collection('catalogs').doc(catalogId).get();
            if (!catDoc.exists) {
                res.json({ catalog: null, blanks: [], message: `Assigned catalog not found` });
                return;
            }
            const catData = catDoc.data() || {};
            const catalog = { id: catDoc.id, ...catData };
            res.json({ catalog, blanks: catData.blankIds || [] });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/catalog-health', middleware_1.requireAdmin, async (req, res) => {
        try {
            const [productsSnap, allowedDoc, catalogsSnap, assignDoc] = await Promise.all([
                core_1.db.collection('products').get(),
                core_1.db.collection('storeAllowedProducts').doc('member-products').get(),
                core_1.db.collection('catalogs').get(),
                core_1.db.collection('systemSettings').doc('catalog-assignments').get(),
            ]);
            const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const enabledProducts = allProducts.filter((p) => p.isEnabled !== false);
            const allowedProducts = allowedDoc.exists ? (allowedDoc.data()?.products || []) : [];
            const providers = [...new Set(allProducts.map((p) => p.provider || 'unknown'))];
            const catalogs = catalogsSnap.docs.map(d => {
                const data = d.data();
                return { id: d.id, name: data.name, blankCount: (data.blankIds || []).length };
            });
            const assignments = assignDoc.exists ? assignDoc.data() : {};
            const sections = ['member', 'public', 'external', 'marketplace', 'platform'];
            const sectionStatus = {};
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
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=tiers.js.map