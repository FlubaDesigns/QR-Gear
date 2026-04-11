"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASTER_CATALOG_SYNCS_COLLECTION = exports.MASTER_CATALOG_COLLECTION = void 0;
exports.syncMasterCatalog = syncMasterCatalog;
const core_1 = require("../core");
const MASTER_CATALOG_COLLECTION = 'master_catalog';
exports.MASTER_CATALOG_COLLECTION = MASTER_CATALOG_COLLECTION;
const MASTER_CATALOG_SYNCS_COLLECTION = 'master_catalog_syncs';
exports.MASTER_CATALOG_SYNCS_COLLECTION = MASTER_CATALOG_SYNCS_COLLECTION;
const PRINTIFY_BLUEPRINTS_COLLECTION = 'printify_blueprints';
const PRINTIFY_PROVIDERS_COLLECTION = 'printifyPrintProviders';
const PRINTFUL_PRODUCTS_COLLECTION = 'printful_products';
const PRINTFUL_VARIANTS_COLLECTION = 'printful_variants';
const MAPPING_COLLECTION = 'printify_printful_mapping';
function normalizeForMatch(s) {
    return (s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}
function classifyCategory(title) {
    const t = (title || '').toLowerCase();
    if (/christmas|holiday|ornament|halloween|easter|thanksgiving|valentine|xmas/.test(t))
        return 'Holiday & Seasonal';
    if (/\bpet\b|\bdog\b|\bcat\b|puppy|kitten|\banimal\b/.test(t))
        return 'Pet Products';
    if (/notebook|journal|planner|stationery|greeting card|postcard|notepad/.test(t))
        return 'Stationery & Paper';
    if (/acrylic print|acrylic sign|metal print|gallery wrap|art board|canvas wrap|canvas gallery|canvas print|wall art|poster|framed|tapestry|\bbanner\b|\bflag\b|art print/.test(t))
        return 'Wall Art & Posters';
    if (/tote bag|backpack|fanny pack|drawstring bag|duffel|duffle|messenger bag|crossbody|\bpouch\b|shopping bag|laptop bag/.test(t))
        return 'Bags & Accessories';
    if (/phone case|iphone|samsung case|airpod|laptop sleeve|mouse pad|mousepad|tablet case/.test(t))
        return 'Phone Cases & Tech';
    if (/sticker|magnet|decal|\bpatch\b/.test(t))
        return 'Stickers & Magnets';
    if (/mugs?|tumbler|water bottle|wine glass|beer stein|beer mug|\bflask\b|thermos|travel mug|\bpint\b|drinkware|insulated bottle|insulated tumbler|shot glass/.test(t))
        return 'Drinkware';
    if (/snapback|trucker hat|dad hat|baseball cap|bucket hat|\bbeanie\b|\bvisor\b|\bcap\b|\bhat\b/.test(t))
        return 'Hats & Caps';
    if (/hoodie|hoody|sweatshirt|pullover|\bfleece\b|zip.?up|crewneck|crew neck|\bsweater\b/.test(t))
        return 'Sweatshirts & Hoodies';
    if (/swimsuit|bikini|rash guard|windbreaker|biker short|boxer brief|bodycon|legging|yoga|jogger|sweatpant|sport bra|compression|activewear|athletic short/.test(t))
        return 'Activewear & Specialty';
    if (/t-shirt|tshirt|\btee\b|tank top|\bpolo\b|v-neck|\bhenley\b|long sleeve|\bjersey\b|raglan|crop top|camisole|\bblouse\b|\bshirt\b/.test(t))
        return 'T-Shirts & Tops';
    if (/\bpillow\b|blanket|\btowel\b|\bapron\b|\brug\b|doormat|table runner|cushion|coaster|shower curtain|duvet|bedding|\bbath\b|face mask|\bbandana\b|\bsock\b|calendar|\bclock\b|\bcandle\b|keychain|\bwallet\b|serving tray|phone stand/.test(t))
        return 'Home & Living';
    if (/bracelet|necklace|earring|\bring\b|\bwatch\b|sunglasse|\bscarf\b|\bglove\b|\bbelt\b|headband|neck gaiter|hair/.test(t))
        return 'Accessories';
    return 'Other';
}
function isBrandModelMatch(printifyBrand, printifyModel, printfulBrand, printfulModel) {
    if (!printifyBrand || !printifyModel || !printfulBrand || !printfulModel)
        return false;
    const pb = normalizeForMatch(printifyBrand);
    const pm = normalizeForMatch(printifyModel);
    const fb = normalizeForMatch(printfulBrand);
    const fm = normalizeForMatch(printfulModel);
    const brandMatch = pb === fb || pb.includes(fb) || fb.includes(pb);
    const modelMatch = pm === fm || pm.includes(fm) || fm.includes(pm);
    return brandMatch && modelMatch;
}
async function commitBatch(writes) {
    const CHUNK = 400;
    for (let i = 0; i < writes.length; i += CHUNK) {
        const chunk = writes.slice(i, i + CHUNK);
        const batch = core_1.db.batch();
        for (const w of chunk) {
            if (w.merge) {
                batch.set(w.ref, w.data, { merge: true });
            }
            else {
                batch.set(w.ref, w.data);
            }
        }
        await batch.commit();
    }
}
async function syncMasterCatalog(options = {}) {
    console.log('[MasterCatalog] Starting sync...');
    const stats = { created: 0, updated: 0, matched: 0, printifyOnly: 0, printfulOnly: 0 };
    const writes = [];
    const [bpSnap, provSnap, pfSnap, pvSnap, mapSnap, masterSnap] = await Promise.all([
        core_1.db.collection(PRINTIFY_BLUEPRINTS_COLLECTION).get(),
        core_1.db.collection(PRINTIFY_PROVIDERS_COLLECTION).get(),
        core_1.db.collection(PRINTFUL_PRODUCTS_COLLECTION).get(),
        core_1.db.collection(PRINTFUL_VARIANTS_COLLECTION).get(),
        core_1.db.collection(MAPPING_COLLECTION).get(),
        core_1.db.collection(MASTER_CATALOG_COLLECTION).get(),
    ]);
    const printifyBlueprints = bpSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printifyProviders = provSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printfulProducts = pfSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printfulVariants = pvSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const existingMappings = mapSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const existingMaster = new Map();
    for (const doc of masterSnap.docs) {
        existingMaster.set(doc.id, { _docId: doc.id, ...doc.data() });
    }
    console.log(`[MasterCatalog] Loaded: ${printifyBlueprints.length} blueprints, ${printfulProducts.length} Printful products, ${existingMappings.length} mappings`);
    // Build lookup maps
    const mappingByPrintifyId = new Map();
    const mappingByPrintfulId = new Map();
    for (const m of existingMappings) {
        if (m.printifyBlueprintId)
            mappingByPrintifyId.set(Number(m.printifyBlueprintId), m);
        if (m.printfulProductId)
            mappingByPrintfulId.set(Number(m.printfulProductId), m);
    }
    // Build Printful lookup by id
    const printfulById = new Map();
    for (const pf of printfulProducts) {
        printfulById.set(Number(pf.id || pf._docId), pf);
    }
    // Build Printful variant lookup by productId
    const variantsByPrintfulId = new Map();
    for (const v of printfulVariants) {
        const pid = Number(v.productId || v.product_id);
        if (!pid)
            continue;
        if (!variantsByPrintfulId.has(pid))
            variantsByPrintfulId.set(pid, []);
        variantsByPrintfulId.get(pid).push(v);
    }
    // Build best Printify provider per blueprint (prefer USA, then lowest cost)
    const bestProviderByBlueprint = new Map();
    for (const p of printifyProviders) {
        const bid = Number(p.blueprintId);
        const curr = bestProviderByBlueprint.get(bid);
        if (!curr) {
            bestProviderByBlueprint.set(bid, p);
        }
        else {
            const currUSA = curr.isUSA;
            const newUSA = p.isUSA;
            if (!currUSA && newUSA) {
                bestProviderByBlueprint.set(bid, p);
            }
            else if (currUSA === newUSA) {
                const currCost = curr.minCost || 999999;
                const newCost = p.minCost || 999999;
                if (newCost < currCost)
                    bestProviderByBlueprint.set(bid, p);
            }
        }
    }
    const matchedPrintfulIds = new Set();
    // ── Process Printify blueprints ──────────────────────────────────────────────
    for (const bp of printifyBlueprints) {
        const blueprintId = Number(bp.id || bp.blueprintId || bp._docId);
        if (isNaN(blueprintId))
            continue;
        const provider = bestProviderByBlueprint.get(blueprintId);
        const now = new Date().toISOString();
        // Find cross-provider mapping
        let mapping = mappingByPrintifyId.get(blueprintId);
        let printfulProduct = null;
        if (mapping) {
            printfulProduct = printfulById.get(Number(mapping.printfulProductId)) || null;
        }
        else {
            // Try to match by brand + model
            for (const pf of printfulProducts) {
                if (isBrandModelMatch(bp.brand, bp.model, pf.brand, pf.model)) {
                    printfulProduct = pf;
                    break;
                }
            }
            if (printfulProduct) {
                const mappingRef = core_1.db.collection(MAPPING_COLLECTION).doc();
                writes.push({
                    ref: mappingRef,
                    data: {
                        printifyBlueprintId: blueprintId,
                        printifyBrand: bp.brand || null,
                        printifyModel: bp.model || null,
                        printfulProductId: Number(printfulProduct.id || printfulProduct._docId),
                        printfulBrand: printfulProduct.brand || null,
                        printfulModel: printfulProduct.model || null,
                        matchConfidence: 'brand_model',
                        isActive: true,
                        createdAt: now,
                        updatedAt: now,
                    },
                    merge: false,
                });
                stats.matched++;
            }
        }
        if (printfulProduct) {
            matchedPrintfulIds.add(Number(printfulProduct.id || printfulProduct._docId));
        }
        const masterId = `py_${blueprintId}`;
        const existing = existingMaster.get(masterId);
        // ── MERGE RULES ────────────────────────────────────────────────────────────
        // Title: Printful wins if matched, else Printify
        const newTitle = printfulProduct?.title || printfulProduct?.typeName || bp.title || '';
        // Description: Printify only. NEVER overwrite if already set.
        let newDescription;
        const existingDesc = existing?.description;
        if (existingDesc && String(existingDesc).trim()) {
            newDescription = existingDesc; // Already set — preserve it
        }
        else {
            newDescription = bp.description || null; // Seed from Printify
        }
        // Brand: Printful wins if matched
        const newBrand = printfulProduct?.brand || bp.brand || null;
        // Images: combine both, never remove existing
        const pyImages = Array.isArray(bp.images) ? bp.images : (bp.primaryImageUrl ? [bp.primaryImageUrl] : []);
        const pfImages = printfulProduct
            ? (Array.isArray(printfulProduct.images) ? printfulProduct.images : (printfulProduct.image ? [printfulProduct.image] : []))
            : [];
        const combinedImages = Array.from(new Set([...(existing?.images || []), ...pyImages, ...pfImages])).filter(Boolean);
        // Colors: Printful variants first, else Printify provider
        let newColors = [];
        if (printfulProduct) {
            const pfId = Number(printfulProduct.id || printfulProduct._docId);
            const pfVars = variantsByPrintfulId.get(pfId) || [];
            const colorMap = new Map();
            for (const v of pfVars) {
                if (v.color && !colorMap.has(v.color)) {
                    colorMap.set(v.color, v.colorCode || v.color_code || '#888888');
                }
            }
            newColors = Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }));
        }
        if (newColors.length === 0 && Array.isArray(provider?.availableColors)) {
            newColors = provider.availableColors;
        }
        // Sizes: Printful variants first, else Printify provider
        let newSizes = [];
        if (printfulProduct) {
            const pfId = Number(printfulProduct.id || printfulProduct._docId);
            const pfVars = variantsByPrintfulId.get(pfId) || [];
            const sizeSet = new Set();
            for (const v of pfVars) {
                if (v.size)
                    sizeSet.add(v.size);
            }
            newSizes = Array.from(sizeSet);
        }
        if (newSizes.length === 0 && Array.isArray(provider?.availableSizes)) {
            newSizes = provider.availableSizes;
        }
        // Origin country: Printful wins
        const newOriginCountry = printfulProduct?.originCountry || printfulProduct?.origin_country || provider?.country || null;
        // Price: take the higher of the two
        const pyMinCents = provider?.minCost || null;
        const pyMin = pyMinCents !== null ? pyMinCents / 100 : null;
        const pyMaxCents = provider?.maxCost || null;
        const pyMax = pyMaxCents !== null ? pyMaxCents / 100 : null;
        const pfMin = printfulProduct?.minPrice ? parseFloat(String(printfulProduct.minPrice)) : null;
        const pfMax = printfulProduct?.maxPrice ? parseFloat(String(printfulProduct.maxPrice)) : null;
        const newMinPrice = pyMin !== null && pfMin !== null ? Math.max(pyMin, pfMin) : (pyMin ?? pfMin ?? null);
        const newMaxPrice = pyMax !== null && pfMax !== null ? Math.max(pyMax, pfMax) : (pyMax ?? pfMax ?? null);
        // Category — classify from title since source data rarely carries a category field
        const newCategory = bp.category || printfulProduct?.category || classifyCategory(newTitle || bp.title || '');
        const entry = {
            title: newTitle || existing?.title || '',
            description: newDescription,
            brand: newBrand || existing?.brand || null,
            images: combinedImages,
            colors: newColors,
            sizes: newSizes,
            originCountry: newOriginCountry || existing?.originCountry || null,
            category: newCategory || existing?.category || null,
            printifyBlueprintId: blueprintId,
            printfulProductId: printfulProduct ? Number(printfulProduct.id || printfulProduct._docId) : (existing?.printfulProductId || null),
            minPrice: newMinPrice,
            maxPrice: newMaxPrice,
            lastSyncedAt: now,
            updatedAt: now,
        };
        const masterRef = core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(masterId);
        if (existing) {
            writes.push({ ref: masterRef, data: entry, merge: true });
            stats.updated++;
        }
        else {
            writes.push({ ref: masterRef, data: { ...entry, createdAt: now }, merge: false });
            stats.created++;
            if (!printfulProduct)
                stats.printifyOnly++;
        }
    }
    // ── Process unmatched Printful products ──────────────────────────────────────
    for (const pf of printfulProducts) {
        const pfId = Number(pf.id || pf._docId);
        if (matchedPrintfulIds.has(pfId))
            continue;
        const now = new Date().toISOString();
        const masterId = `pf_${pfId}`;
        const existing = existingMaster.get(masterId);
        const pfVars = variantsByPrintfulId.get(pfId) || [];
        const colorMap = new Map();
        const sizeSet = new Set();
        for (const v of pfVars) {
            if (v.color && !colorMap.has(v.color))
                colorMap.set(v.color, v.colorCode || v.color_code || '#888888');
            if (v.size)
                sizeSet.add(v.size);
        }
        const pfImages = Array.isArray(pf.images) ? pf.images : (pf.image ? [pf.image] : []);
        const combinedImages = Array.from(new Set([...(existing?.images || []), ...pfImages])).filter(Boolean);
        // Description: Printful never provides it — preserve existing (manually set) or null
        const newDescription = existing?.description && String(existing.description).trim()
            ? existing.description
            : null;
        const pfMin = pf.minPrice ? parseFloat(String(pf.minPrice)) : null;
        const pfMax = pf.maxPrice ? parseFloat(String(pf.maxPrice)) : null;
        const entry = {
            title: pf.title || pf.typeName || existing?.title || '',
            description: newDescription,
            brand: pf.brand || existing?.brand || null,
            images: combinedImages,
            colors: Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex })),
            sizes: Array.from(sizeSet),
            originCountry: pf.originCountry || pf.origin_country || existing?.originCountry || null,
            category: pf.category || existing?.category || classifyCategory(pf.title || pf.typeName || ''),
            printifyBlueprintId: null,
            printfulProductId: pfId,
            minPrice: pfMin ?? existing?.minPrice ?? null,
            maxPrice: pfMax ?? existing?.maxPrice ?? null,
            lastSyncedAt: now,
            updatedAt: now,
        };
        const masterRef = core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(masterId);
        if (existing) {
            writes.push({ ref: masterRef, data: entry, merge: true });
            stats.updated++;
        }
        else {
            writes.push({ ref: masterRef, data: { ...entry, createdAt: now }, merge: false });
            stats.created++;
            stats.printfulOnly++;
        }
    }
    await commitBatch(writes);
    console.log('[MasterCatalog] Sync complete:', stats);
    return stats;
}
//# sourceMappingURL=master-catalog.js.map