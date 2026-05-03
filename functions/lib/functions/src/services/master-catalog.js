"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASTER_CATALOG_SYNCS_COLLECTION = exports.MASTER_CATALOG_COLLECTION = exports.QRG_BLANK_CATEGORIES = void 0;
exports.syncMasterCatalog = syncMasterCatalog;
const core_1 = require("../core");
const safeAssign_1 = require("../safeAssign");
const instance_resolver_1 = require("./instance-resolver");
/** Extract plain URL strings from an ImageRecord[] or mixed array */
function toUrlArray(records) {
    return (records || []).map((r) => {
        if (typeof r === 'string')
            return r.trim() || null;
        if (r && typeof r === 'object' && typeof r.url === 'string')
            return r.url.trim() || null;
        return null;
    }).filter((u) => !!u);
}
/** Merge image arrays and return plain URL strings */
function mergeImages(existing, incoming) {
    return toUrlArray((0, instance_resolver_1.mergeImagesByUrl)(existing, incoming));
}
const MASTER_CATALOG_COLLECTION = 'master_catalog';
exports.MASTER_CATALOG_COLLECTION = MASTER_CATALOG_COLLECTION;
const MASTER_CATALOG_SYNCS_COLLECTION = 'master_catalog_syncs';
exports.MASTER_CATALOG_SYNCS_COLLECTION = MASTER_CATALOG_SYNCS_COLLECTION;
const PRINTIFY_BLUEPRINTS_COLLECTION = 'printify_blueprints';
const PRINTIFY_PROVIDERS_COLLECTION = 'printifyPrintProviders';
const PRINTFUL_PRODUCTS_COLLECTION = 'printful_products';
const PRINTFUL_VARIANTS_COLLECTION = 'printful_variants';
// ── QRG Blank Category Definitions (BBB segment of QRG numbering schema) ─────
// Source of truth: README.md QRG Numbering System section
exports.QRG_BLANK_CATEGORIES = [
    { name: 'Tees', rangeStart: 101, rangeEnd: 199 },
    { name: 'Hoodies', rangeStart: 201, rangeEnd: 299 },
    { name: 'Hats', rangeStart: 301, rangeEnd: 399 },
    { name: 'Drinkware', rangeStart: 401, rangeEnd: 499 },
];
/**
 * Classify a product into a QRG blank category based on title and typeName.
 * Returns null if the product does not fit any defined category (Unclassified).
 */
function classifyToQRGCategory(title, typeName) {
    const t = ((title || '') + ' ' + (typeName || '')).toLowerCase();
    if (/t-?shirt|tshirt|\btee\b|tank.?top|\bpolo\b|v-?neck|\bhenley\b|long.?sleeve|\bjersey\b|raglan|crop.?top|camisole|\bblouse\b|\bshirt\b|bodysuit|onesie/.test(t))
        return 'Tees';
    if (/hoodie|hoody|sweatshirt|pullover|\bfleece\b|zip.?up|crewneck|crew.?neck|\bsweater\b/.test(t))
        return 'Hoodies';
    if (/snapback|trucker.?hat|dad.?hat|baseball.?cap|bucket.?hat|\bbeanie\b|\bvisor\b|\bcap\b|\bhat\b/.test(t))
        return 'Hats';
    if (/\bmugs?\b|tumbler|water.?bottle|wine.?glass|beer.?stein|beer.?mug|\bflask\b|thermos|travel.?mug|\bpint\b|\bdrinkware\b|insulated.?bottle|insulated.?tumbler|shot.?glass/.test(t))
        return 'Drinkware';
    return null;
}
function normalizeForMatch(s) {
    return (s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}
function isBrandModelMatch(brandA, modelA, brandB, modelB) {
    if (!brandA || !modelA || !brandB || !modelB)
        return false;
    const ba = normalizeForMatch(brandA);
    const ma = normalizeForMatch(modelA);
    const bb = normalizeForMatch(brandB);
    const mb = normalizeForMatch(modelB);
    const brandMatch = ba === bb || ba.includes(bb) || bb.includes(ba);
    const modelMatch = ma === mb || ma.includes(mb) || mb.includes(ma);
    return brandMatch && modelMatch;
}
function extractImageUrls(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw)) {
        return raw
            .map((img) => {
            if (typeof img === 'string')
                return img;
            return img?.src || img?.url || img?.imageUrl || null;
        })
            .filter((u) => !!u && typeof u === 'string');
    }
    if (typeof raw === 'string')
        return [raw];
    return [];
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
async function syncMasterCatalog(_options = {}) {
    console.log('[MasterCatalog] Starting QRG sync...');
    const stats = {
        created: 0,
        updated: 0,
        bridged: 0,
        printifyOnly: 0,
        printfulOnly: 0,
        unclassified: 0,
        byCategory: { tees: 0, hoodies: 0, hats: 0, drinkware: 0 },
    };
    const writes = [];
    // Load everything in parallel
    const [bpSnap, provSnap, pfSnap, pvSnap, masterSnap] = await Promise.all([
        core_1.db.collection(PRINTIFY_BLUEPRINTS_COLLECTION).get(),
        core_1.db.collection(PRINTIFY_PROVIDERS_COLLECTION).get(),
        core_1.db.collection(PRINTFUL_PRODUCTS_COLLECTION).get(),
        core_1.db.collection(PRINTFUL_VARIANTS_COLLECTION).get(),
        core_1.db.collection(MASTER_CATALOG_COLLECTION).get(),
    ]);
    const printifyBlueprints = bpSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printifyProviders = provSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printfulProducts = pfSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printfulVariants = pvSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    // Build existing master catalog map (docId → data)
    const existingMaster = new Map();
    for (const doc of masterSnap.docs) {
        existingMaster.set(doc.id, { _docId: doc.id, ...doc.data() });
    }
    console.log(`[MasterCatalog] Loaded: ${printifyBlueprints.length} blueprints, ${printfulProducts.length} Printful products, ${existingMaster.size} existing master records`);
    // ── Build lookups: providerKey → existing QRG docId ──────────────────────────
    // Allows re-sync to find the correct QRG doc for a provider product
    const blueprintToQrgDoc = new Map(); // blueprintId → qrg_docId
    const printfulToQrgDoc = new Map(); // printfulProductId → qrg_docId
    for (const [docId, data] of existingMaster.entries()) {
        if (Array.isArray(data.providerMappings)) {
            for (const m of data.providerMappings) {
                if (m.provider === 'printify' && m.blueprintId)
                    blueprintToQrgDoc.set(Number(m.blueprintId), docId);
                if (m.provider === 'printful' && m.productId)
                    printfulToQrgDoc.set(Number(m.productId), docId);
            }
        }
    }
    // ── Build next available BBB number per category ──────────────────────────────
    // On first run (empty collection) these start at range start.
    // On re-sync they advance past existing assignments.
    const nextBBB = {
        'Tees': 101, 'Hoodies': 201, 'Hats': 301, 'Drinkware': 401,
    };
    for (const [, data] of existingMaster.entries()) {
        if (data.qrgBlankId && data.qrgCategory && nextBBB[data.qrgCategory] !== undefined) {
            if (Number(data.qrgBlankId) >= nextBBB[data.qrgCategory]) {
                nextBBB[data.qrgCategory] = Number(data.qrgBlankId) + 1;
            }
        }
    }
    // ── Build best Printify provider per blueprint ──────────────────────────────
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
    // ── Build Printful variant and product lookups ──────────────────────────────
    const variantsByPrintfulId = new Map();
    for (const v of printfulVariants) {
        const pid = Number(v.productId || v.product_id);
        if (!pid)
            continue;
        if (!variantsByPrintfulId.has(pid))
            variantsByPrintfulId.set(pid, []);
        variantsByPrintfulId.get(pid).push(v);
    }
    const printfulById = new Map();
    for (const pf of printfulProducts) {
        printfulById.set(Number(pf.id || pf._docId), pf);
    }
    // ── In-memory docs being built this sync ─────────────────────────────────────
    // docId → accumulated entry (used for bridging within same sync run)
    const inProgressDocs = new Map();
    function allocateQRGDocId(existingDocId, qrgCategory, pendingFallback) {
        if (existingDocId) {
            return { docId: existingDocId, alreadyExists: existingMaster.has(existingDocId) || inProgressDocs.has(existingDocId) };
        }
        if (qrgCategory) {
            const bbb = nextBBB[qrgCategory];
            const catDef = exports.QRG_BLANK_CATEGORIES.find(c => c.name === qrgCategory);
            if (catDef && bbb <= catDef.rangeEnd) {
                nextBBB[qrgCategory] = bbb + 1;
                return { docId: `qrg_${bbb}`, alreadyExists: false };
            }
        }
        // No category match or range exhausted → pending doc
        return { docId: `pending_${pendingFallback}`, alreadyExists: existingMaster.has(`pending_${pendingFallback}`) };
    }
    function bumpCategoryStats(qrgCategory) {
        if (qrgCategory === 'Tees')
            stats.byCategory.tees++;
        else if (qrgCategory === 'Hoodies')
            stats.byCategory.hoodies++;
        else if (qrgCategory === 'Hats')
            stats.byCategory.hats++;
        else if (qrgCategory === 'Drinkware')
            stats.byCategory.drinkware++;
        else
            stats.unclassified++;
    }
    const matchedPrintfulIds = new Set();
    // ── Process Printify blueprints ──────────────────────────────────────────────
    for (const bp of printifyBlueprints) {
        const blueprintId = Number(bp.id || bp.blueprintId || bp._docId);
        if (isNaN(blueprintId))
            continue;
        const provider = bestProviderByBlueprint.get(blueprintId);
        const now = new Date().toISOString();
        // Classify into QRG category
        const qrgCategory = classifyToQRGCategory(bp.title, bp.typeName);
        // Try to match with a Printful product by brand+model
        let matchedPrintful = null;
        for (const pf of printfulProducts) {
            if (isBrandModelMatch(bp.brand, bp.model, pf.brand, pf.model)) {
                matchedPrintful = pf;
                break;
            }
        }
        const pfId = matchedPrintful ? Number(matchedPrintful.id || matchedPrintful._docId) : null;
        if (pfId !== null)
            matchedPrintfulIds.add(pfId);
        // Find existing QRG doc: check Printify mapping first, then Printful mapping
        const existingViaBlueprint = blueprintToQrgDoc.get(blueprintId);
        const existingViaPrintful = pfId !== null ? printfulToQrgDoc.get(pfId) : undefined;
        const resolvedExistingId = existingViaBlueprint || existingViaPrintful;
        const { docId, alreadyExists } = allocateQRGDocId(resolvedExistingId, qrgCategory, `py_${blueprintId}`);
        // Register lookups so Printful processing can find this doc
        blueprintToQrgDoc.set(blueprintId, docId);
        if (pfId !== null)
            printfulToQrgDoc.set(pfId, docId);
        const currentDoc = existingMaster.get(docId) || inProgressDocs.get(docId);
        // ── Build Printify provider mapping ──────────────────────────────────────
        const pyMapping = {
            provider: 'printify',
            blueprintId,
            brand: bp.brand || null,
            model: bp.model || null,
            printProviderId: provider?.providerId || null,
            originCountry: provider?.country || null,
            isUSA: provider?.isUSA || false,
        };
        // ── Extract Printify images ───────────────────────────────────────────────
        const pyImagesRaw = extractImageUrls(bp.images);
        // ── Build Printful data if matched ────────────────────────────────────────
        let pfMapping = null;
        let pfImagesRaw = [];
        let pfColors = [];
        let pfSizes = [];
        let pfMinPrice = null;
        let pfMaxPrice = null;
        let pfOriginCountry = null;
        if (matchedPrintful && pfId !== null) {
            const pfVars = variantsByPrintfulId.get(pfId) || [];
            const colorMap = new Map();
            const sizeSet = new Set();
            for (const v of pfVars) {
                if (v.color && !colorMap.has(v.color))
                    colorMap.set(v.color, v.colorCode || v.color_code || '#888888');
                if (v.size)
                    sizeSet.add(v.size);
            }
            pfColors = Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }));
            pfSizes = Array.from(sizeSet);
            pfImagesRaw = extractImageUrls(matchedPrintful.images);
            if (pfImagesRaw.length === 0 && matchedPrintful.image)
                pfImagesRaw = [matchedPrintful.image];
            pfMinPrice = matchedPrintful.minPrice ? parseFloat(String(matchedPrintful.minPrice)) : null;
            pfMaxPrice = matchedPrintful.maxPrice ? parseFloat(String(matchedPrintful.maxPrice)) : null;
            pfOriginCountry = matchedPrintful.originCountry || matchedPrintful.origin_country || null;
            pfMapping = {
                provider: 'printful',
                productId: pfId,
                brand: matchedPrintful.brand || null,
                model: matchedPrintful.model || null,
                originCountry: pfOriginCountry,
                isUSA: (pfOriginCountry || '').toUpperCase() === 'US' || (pfOriginCountry || '').toUpperCase() === 'USA',
            };
        }
        // ── Merge provider mappings ───────────────────────────────────────────────
        const existingMappings = currentDoc?.providerMappings || [];
        const newMappings = [...existingMappings];
        const pyIdx = newMappings.findIndex((m) => m.provider === 'printify' && m.blueprintId === blueprintId);
        if (pyIdx >= 0)
            newMappings[pyIdx] = pyMapping;
        else
            newMappings.push(pyMapping);
        if (pfMapping) {
            const pfIdx = newMappings.findIndex((m) => m.provider === 'printful' && m.productId === pfId);
            if (pfIdx >= 0)
                newMappings[pfIdx] = pfMapping;
            else
                newMappings.push(pfMapping);
        }
        // availableVia — provider badge: sorted array of providers that carry this blank
        const availableVia = Array.from(new Set(newMappings.map((m) => m.provider))).sort();
        // ── Merge images by provider — stored separately AND combined ─────────────
        const existingPyImages = currentDoc?.printifyImages || [];
        const existingPfImages = currentDoc?.printfulImages || [];
        const newPyImages = mergeImages(existingPyImages, pyImagesRaw);
        const newPfImages = pfImagesRaw.length > 0
            ? mergeImages(existingPfImages, pfImagesRaw)
            : existingPfImages;
        const combinedImages = mergeImages([], [...newPyImages, ...newPfImages]);
        // ── Colors & sizes: Printful variants win if available, else Printify ─────
        let incomingColors = pfColors;
        if (incomingColors.length === 0 && Array.isArray(provider?.availableColors))
            incomingColors = provider.availableColors;
        const newColors = (0, instance_resolver_1.isMeaningfulValue)(incomingColors) ? incomingColors : (currentDoc?.colors ?? []);
        let incomingSizes = pfSizes;
        if (incomingSizes.length === 0 && Array.isArray(provider?.availableSizes))
            incomingSizes = provider.availableSizes;
        const newSizes = (0, instance_resolver_1.mergeArrayUnionStrings)(currentDoc?.sizes ?? [], incomingSizes);
        // ── Pricing ───────────────────────────────────────────────────────────────
        const pyMinCents = provider?.minCost ?? null;
        const pyMin = pyMinCents !== null ? pyMinCents / 100 : null;
        const pyMaxCents = provider?.maxCost ?? null;
        const pyMax = pyMaxCents !== null ? pyMaxCents / 100 : null;
        const newMinPrice = pyMin !== null && pfMinPrice !== null ? Math.max(pyMin, pfMinPrice) : (pyMin ?? pfMinPrice ?? null);
        const newMaxPrice = pyMax !== null && pfMaxPrice !== null ? Math.max(pyMax, pfMaxPrice) : (pyMax ?? pfMaxPrice ?? null);
        // ── Canonical fields (safe merge — never overwrite with empty) ────────────
        const providerTitle = matchedPrintful?.title || matchedPrintful?.typeName || bp.title || null;
        const canonicalTitle = (0, safeAssign_1.safeAssignRequired)(currentDoc?.canonicalTitle, providerTitle);
        const canonicalBrand = (0, safeAssign_1.safeAssign)(currentDoc?.brand, matchedPrintful?.brand || bp.brand || null);
        // ── Determine categorySource ──────────────────────────────────────────────
        // If existing doc was manually set by admin, respect it. Otherwise derive from classification.
        const categorySource = currentDoc?.categorySource === 'manual'
            ? 'manual'
            : (qrgCategory ? 'mapped' : 'inferred');
        const entry = {
            qrgBlankId: docId.startsWith('qrg_') ? parseInt(docId.slice(4)) : null,
            qrgCategory: qrgCategory || 'Unclassified',
            canonicalTitle,
            brand: canonicalBrand || currentDoc?.brand || null,
            model: (0, safeAssign_1.safeAssign)(currentDoc?.model, bp.model || matchedPrintful?.model || null),
            description: (0, safeAssign_1.safeAssign)(currentDoc?.description, bp.description || null),
            providerMappings: newMappings,
            availableVia,
            printifyImages: newPyImages,
            printfulImages: newPfImages,
            images: combinedImages,
            colors: newColors,
            sizes: newSizes,
            originCountry: pfOriginCountry || provider?.country || currentDoc?.originCountry || null,
            minPrice: newMinPrice,
            maxPrice: newMaxPrice,
            categorySource,
            lastSyncedAt: now,
            updatedAt: now,
        };
        inProgressDocs.set(docId, { ...currentDoc, ...entry });
        const masterRef = core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(docId);
        const isFirstWrite = !alreadyExists;
        if (isFirstWrite) {
            writes.push({ ref: masterRef, data: { ...entry, createdAt: now }, merge: false });
            stats.created++;
            if (matchedPrintful)
                stats.bridged++;
            else
                stats.printifyOnly++;
        }
        else {
            writes.push({ ref: masterRef, data: entry, merge: true });
            stats.updated++;
        }
        bumpCategoryStats(qrgCategory);
    }
    // ── Process unmatched Printful products ──────────────────────────────────────
    for (const pf of printfulProducts) {
        const pfId = Number(pf.id || pf._docId);
        if (matchedPrintfulIds.has(pfId))
            continue;
        const now = new Date().toISOString();
        const qrgCategory = classifyToQRGCategory(pf.title, pf.typeName);
        const existingQrgDocId = printfulToQrgDoc.get(pfId);
        const { docId, alreadyExists } = allocateQRGDocId(existingQrgDocId, qrgCategory, `pf_${pfId}`);
        printfulToQrgDoc.set(pfId, docId);
        const currentDoc = existingMaster.get(docId) || inProgressDocs.get(docId);
        const pfVars = variantsByPrintfulId.get(pfId) || [];
        const colorMap = new Map();
        const sizeSet = new Set();
        for (const v of pfVars) {
            if (v.color && !colorMap.has(v.color))
                colorMap.set(v.color, v.colorCode || v.color_code || '#888888');
            if (v.size)
                sizeSet.add(v.size);
        }
        const incomingColors = Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }));
        const incomingSizes = Array.from(sizeSet);
        let pfImagesRaw = extractImageUrls(pf.images);
        if (pfImagesRaw.length === 0 && pf.image)
            pfImagesRaw = [pf.image];
        const pfOriginCountry = pf.originCountry || pf.origin_country || null;
        const pfMapping = {
            provider: 'printful',
            productId: pfId,
            brand: pf.brand || null,
            model: pf.model || null,
            originCountry: pfOriginCountry,
            isUSA: (pfOriginCountry || '').toUpperCase() === 'US' || (pfOriginCountry || '').toUpperCase() === 'USA',
        };
        const existingMappings = currentDoc?.providerMappings || [];
        const newMappings = [...existingMappings];
        const pfIdx = newMappings.findIndex((m) => m.provider === 'printful' && m.productId === pfId);
        if (pfIdx >= 0)
            newMappings[pfIdx] = pfMapping;
        else
            newMappings.push(pfMapping);
        const availableVia = Array.from(new Set(newMappings.map((m) => m.provider))).sort();
        const existingPfImages = currentDoc?.printfulImages || [];
        const existingPyImages = currentDoc?.printifyImages || [];
        const newPfImages = mergeImages(existingPfImages, pfImagesRaw);
        const combinedImages = mergeImages([], [...existingPyImages, ...newPfImages]);
        const pfMin = pf.minPrice ? parseFloat(String(pf.minPrice)) : null;
        const pfMax = pf.maxPrice ? parseFloat(String(pf.maxPrice)) : null;
        const categorySource = currentDoc?.categorySource === 'manual'
            ? 'manual'
            : (qrgCategory ? 'mapped' : 'inferred');
        const entry = {
            qrgBlankId: docId.startsWith('qrg_') ? parseInt(docId.slice(4)) : null,
            qrgCategory: qrgCategory || 'Unclassified',
            canonicalTitle: (0, safeAssign_1.safeAssignRequired)(currentDoc?.canonicalTitle, pf.title || pf.typeName || null),
            brand: (0, safeAssign_1.safeAssign)(currentDoc?.brand, pf.brand || null),
            model: (0, safeAssign_1.safeAssign)(currentDoc?.model, pf.model || null),
            description: (0, safeAssign_1.safeAssign)(currentDoc?.description, null),
            providerMappings: newMappings,
            availableVia,
            printifyImages: existingPyImages,
            printfulImages: newPfImages,
            images: combinedImages,
            colors: (0, instance_resolver_1.isMeaningfulValue)(incomingColors) ? incomingColors : (currentDoc?.colors ?? []),
            sizes: (0, instance_resolver_1.mergeArrayUnionStrings)(currentDoc?.sizes ?? [], incomingSizes),
            originCountry: pfOriginCountry || currentDoc?.originCountry || null,
            minPrice: pfMin ?? currentDoc?.minPrice ?? null,
            maxPrice: pfMax ?? currentDoc?.maxPrice ?? null,
            categorySource,
            lastSyncedAt: now,
            updatedAt: now,
        };
        inProgressDocs.set(docId, { ...currentDoc, ...entry });
        const masterRef = core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(docId);
        if (!alreadyExists) {
            writes.push({ ref: masterRef, data: { ...entry, createdAt: now }, merge: false });
            stats.created++;
            stats.printfulOnly++;
        }
        else {
            writes.push({ ref: masterRef, data: entry, merge: true });
            stats.updated++;
        }
        bumpCategoryStats(qrgCategory);
    }
    await commitBatch(writes);
    console.log('[MasterCatalog] QRG sync complete:', stats);
    return stats;
}
//# sourceMappingURL=master-catalog.js.map