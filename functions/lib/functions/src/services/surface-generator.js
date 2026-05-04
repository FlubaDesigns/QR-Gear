"use strict";
/**
 * surface-generator.ts
 *
 * Converts a committed admin_catalog_instance (+ its linked productPacket)
 * into a canonical NormalizedProduct, then builds a Surface draft payload
 * ready for insertion into the surfaces collection.
 *
 * Two-stage contract:
 *   Stage A — normalizeProductForPublishing(instanceId, db)  → NormalizedProduct
 *   Stage B — createSurfaceDraftFromNormalizedProduct(normalized, marketplace, defaults?) → surface payload
 *
 * Data precedence (highest wins):
 *   1. instance.resolved   — single source of truth: title / description / images / brand / colors / sizes / category
 *   2. instance.enabledColors / enabledSizes  — admin-curated subset (overrides resolved.colors/sizes when set)
 *   3. packet.pricing.customerPrice           — retail price
 *   4. packet.options                         — structured option groups for variants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAndNormalizeForPublishing = resolveAndNormalizeForPublishing;
exports.normalizeProductForPublishing = normalizeProductForPublishing;
exports.createSurfaceDraftFromNormalizedProduct = createSurfaceDraftFromNormalizedProduct;
const constants_1 = require("../constants");
const qrgCodes_1 = require("../../../shared/qrgCodes");
const qrg_resolver_1 = require("./qrg-resolver");
// ─────────────────────────────────────────────────────────────────────────────
// Collection names (local — admin_catalog_instances not yet in constants)
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_INSTANCES_COLLECTION = 'admin_catalog_instances';
// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Extract plain URL strings from the resolved.images array.
 * Entries may be ImageRecord objects { url, alt, … } or plain strings.
 */
function extractImageUrls(images) {
    return (images ?? [])
        .map((img) => {
        if (typeof img === 'string')
            return img.trim();
        if (img && typeof img === 'object' && img.url)
            return String(img.url).trim();
        return null;
    })
        .filter((u) => !!u && u.length > 0);
}
/**
 * Derive a listing department from a category string using keyword matching.
 * Default: Unisex (safest for POD apparel).
 */
function deriveDepartment(category) {
    if (!category)
        return 'Unisex';
    const cat = category.toLowerCase();
    if (/\b(women|ladies|girl|female|womens)\b/.test(cat))
        return 'Women';
    if (/\b(men|man|male|boys|mens)\b/.test(cat))
        return 'Men';
    if (/\b(kids|child|youth|baby|toddler|infant)\b/.test(cat))
        return 'Kids';
    return 'Unisex';
}
/**
 * Derive a product type label from category string for eBay item specifics.
 */
function deriveType(category) {
    if (!category)
        return null;
    const cat = category.toLowerCase();
    if (/\b(t.?shirt|tee|top)\b/.test(cat))
        return 'T-Shirt';
    if (/\b(hoodie|hooded)\b/.test(cat))
        return 'Hoodie';
    if (/\b(sweatshirt)\b/.test(cat))
        return 'Sweatshirt';
    if (/\b(hat|cap)\b/.test(cat))
        return 'Hat';
    if (/\b(beanie)\b/.test(cat))
        return 'Beanie';
    if (/\b(mug|cup)\b/.test(cat))
        return 'Mug';
    if (/\b(bag|tote)\b/.test(cat))
        return 'Bag';
    if (/\b(poster|print)\b/.test(cat))
        return 'Poster';
    if (/\b(phone|case)\b/.test(cat))
        return 'Phone Case';
    return null;
}
/**
 * Derive the SKU for a normalized product.
 * Priority:
 *   1. instance.qrgBaseCode — canonical QRG-[STNNN]-[C]-[NNNNNN] (current schema)
 *   2. instance.qrgPacketCode — legacy field name (backward compat for existing docs)
 *   3. Reconstruct from parts if all three fields are present
 *
 * Throws loudly if no valid QRG identity exists — never invents a fake code.
 */
function deriveSkuFromInstance(instance, instanceId) {
    if (instance.qrgBaseCode && (0, qrgCodes_1.isValidQrgCode)(instance.qrgBaseCode)) {
        return instance.qrgBaseCode;
    }
    // Backward compat: old field name used before schema rename
    if (instance.qrgPacketCode && (0, qrgCodes_1.isValidQrgCode)(instance.qrgPacketCode)) {
        return instance.qrgPacketCode;
    }
    if (instance.qrgBlankId && instance.qrgContext && instance.instanceNumber) {
        const candidate = `QRG-${instance.qrgBlankId}-${instance.qrgContext}-${String(instance.instanceNumber).padStart(6, '0')}`;
        if ((0, qrgCodes_1.isValidQrgBase)(candidate))
            return candidate;
    }
    throw new Error(`[SurfaceGenerator] Instance ${instanceId} has no valid QRG identity. ` +
        `Ensure qrgBaseCode, qrgContext, and instanceNumber are set before generating a surface.`);
}
/**
 * Auto-generate listing bullet points from normalized product attributes.
 */
function generateBullets(colors, sizes, brand) {
    const bullets = [];
    bullets.push('Unique QR code design printed directly on the product');
    if (colors.length > 0) {
        bullets.push(`Available in ${colors.length} color${colors.length > 1 ? 's' : ''}`);
    }
    if (sizes.length > 0) {
        bullets.push(`Multiple sizes available: ${sizes.join(', ')}`);
    }
    if (brand) {
        bullets.push(`Brand: ${brand}`);
    }
    bullets.push('Makes a great personalized gift for any occasion');
    return bullets;
}
/**
 * Auto-generate short tags (Etsy max 13) from product attributes.
 */
function generateTags(category, brand, department, colors) {
    const tags = new Set();
    tags.add('qr code');
    tags.add('custom');
    tags.add('personalized');
    if (category) {
        const cat = category.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (cat)
            tags.add(cat);
    }
    if (brand)
        tags.add(brand.toLowerCase());
    tags.add(department.toLowerCase());
    const type = deriveType(category);
    if (type)
        tags.add(type.toLowerCase());
    for (const color of colors.slice(0, 3)) {
        tags.add(color.toLowerCase());
    }
    return Array.from(tags).slice(0, 13);
}
/**
 * Auto-generate longer search keyword phrases.
 */
function generateKeywords(category, brand) {
    const kws = ['custom qr code', 'personalized gift', 'unique design'];
    const type = deriveType(category);
    if (type)
        kws.push(`custom ${type.toLowerCase()}`);
    if (brand)
        kws.push(`${brand.toLowerCase()} ${(type || 'product').toLowerCase()}`);
    return kws;
}
/**
 * Resolves either a qrgCode or productInstanceId to a NormalizedProduct.
 *
 * Resolution order:
 *   1. qrgCode → resolve instance → normalize
 *   2. productInstanceId → normalize directly
 *
 * Cross-validation: if both are supplied, the resolved instance must match.
 *
 * Throws loudly if:
 *   - Neither is provided
 *   - QRG is invalid or resolves to no/multiple instances
 *   - productInstanceId does not match the QRG-resolved instance
 *   - The loaded instance has no valid QRG identity (no fake code generated)
 */
async function resolveAndNormalizeForPublishing(input, db) {
    const { qrgCode, productInstanceId } = input;
    if (!qrgCode && !productInstanceId) {
        throw new Error('[SurfaceGenerator] Either qrgCode or productInstanceId is required.');
    }
    if (qrgCode) {
        const resolved = await (0, qrg_resolver_1.resolveQrgToProductInstance)(qrgCode);
        if (productInstanceId &&
            productInstanceId.trim() !== resolved.productInstanceId) {
            throw new Error(`[SurfaceGenerator] QRG code does not match product instance. ` +
                `QRG resolves to "${resolved.productInstanceId}", got "${productInstanceId}".`);
        }
        return normalizeProductForPublishing(resolved.productInstanceId, db);
    }
    // productInstanceId-only path — normalizeProductForPublishing already validates QRG
    return normalizeProductForPublishing(productInstanceId.trim(), db);
}
// ─────────────────────────────────────────────────────────────────────────────
// Stage A — normalizeProductForPublishing
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Loads an admin_catalog_instance by ID plus its linked productPacket and
 * returns a canonical NormalizedProduct ready for Surface draft generation.
 *
 * Throws with a descriptive message if the instance is not found.
 * Packet load is best-effort — missing packet is non-fatal.
 */
async function normalizeProductForPublishing(instanceId, db) {
    // 1. Load the admin instance
    const instanceDoc = await db
        .collection(ADMIN_INSTANCES_COLLECTION)
        .doc(instanceId)
        .get();
    if (!instanceDoc.exists) {
        throw new Error(`[SurfaceGenerator] admin_catalog_instance not found: ${instanceId}`);
    }
    const instance = instanceDoc.data();
    const resolved = instance.resolved || {};
    const baseSnapshot = instance.baseSnapshot || {};
    // 2. Load linked packet (best-effort — non-fatal if missing)
    let packet = null;
    const packetId = instance.currentPacketId || null;
    if (packetId) {
        try {
            const packetDoc = await db
                .collection(constants_1.PRODUCT_PACKETS_COLLECTION)
                .doc(packetId)
                .get();
            if (packetDoc.exists) {
                packet = packetDoc.data();
            }
            else {
                console.warn(`[SurfaceGenerator] packet ${packetId} not found for instance ${instanceId} — continuing without packet data`);
            }
        }
        catch (err) {
            console.warn(`[SurfaceGenerator] could not load packet ${packetId} for instance ${instanceId}: ${err.message}`);
        }
    }
    // 3. Title + description — always from resolved (the canonical merged state)
    const title = (resolved.title || '').trim() || 'Untitled Product';
    const description = (resolved.description || '').trim() || '';
    // 4. Images — resolved.images already has the generated mockup prepended as hero
    const images = extractImageUrls(resolved.images || []);
    // 5. Colors + sizes
    //    Prefer admin-curated enabledColors/Sizes (set from builder commit step)
    //    over the full resolved set — they represent the operator's curation intent
    const resolvedColors = resolved.colors || [];
    const resolvedSizes = resolved.sizes || [];
    const adminColors = Array.isArray(instance.enabledColors) && instance.enabledColors.length > 0
        ? instance.enabledColors
        : null;
    const adminSizes = Array.isArray(instance.enabledSizes) && instance.enabledSizes.length > 0
        ? instance.enabledSizes
        : null;
    const colors = adminColors ?? resolvedColors;
    const sizes = adminSizes ?? resolvedSizes;
    // 6. Retail price
    //    Priority: resolved.pricing.customerPrice → packet.pricing.customerPrice
    //              → baseSnapshot.maxPrice → baseSnapshot.minPrice → 0
    let retailPrice = 0;
    const resolvedPricing = resolved.pricing || null;
    const packetPricing = packet?.pricing || null;
    if (resolvedPricing?.customerPrice) {
        retailPrice = parseFloat(resolvedPricing.customerPrice) || 0;
    }
    else if (packetPricing?.customerPrice) {
        retailPrice = parseFloat(packetPricing.customerPrice) || 0;
    }
    else if (baseSnapshot.maxPrice) {
        retailPrice = parseFloat(baseSnapshot.maxPrice) || 0;
    }
    else if (baseSnapshot.minPrice) {
        retailPrice = parseFloat(baseSnapshot.minPrice) || 0;
    }
    // 7. Structured options — from packet.options (built by the product builder)
    const options = packet?.options || [];
    // 8. Folder hierarchy
    const storeId = instance.storeId || null;
    const channelId = instance.channelId || null;
    const collectionId = instance.collectionId || null;
    // 9. Provider metadata
    const printifyBlueprintId = baseSnapshot.printifyBlueprintId || packet?.blueprintId || null;
    const printfulProductId = baseSnapshot.printfulProductId || null;
    const manufacturer = packet?.manufacturer || null;
    const originCountry = baseSnapshot.originCountry || null;
    // 10. Core attributes
    const brand = resolved.brand || null;
    const category = resolved.category || packet?.category || null;
    const slug = packet?.landingPageSlug || null;
    const sourceMasterId = instance.sourceMasterId || null;
    const sku = deriveSkuFromInstance(instance, instanceId);
    const department = deriveDepartment(category);
    // 11. Auto-generated listing content
    const bulletPoints = generateBullets(colors, sizes, brand);
    const tags = generateTags(category, brand, department, colors);
    const keywords = generateKeywords(category, brand);
    return {
        instanceId,
        packetId,
        sourceMasterId,
        title,
        description,
        sku,
        slug,
        retailPrice,
        compareAtPrice: null,
        images,
        colors,
        sizes,
        brand,
        category,
        department,
        originCountry,
        options,
        storeId,
        channelId,
        collectionId,
        bulletPoints,
        tags,
        keywords,
        printifyBlueprintId,
        printfulProductId,
        manufacturer,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Stage B — createSurfaceDraftFromNormalizedProduct
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Converts a NormalizedProduct into a Surface document payload.
 * The returned object can be written directly to the surfaces Firestore collection.
 *
 * Auto-populates eBay item specifics from the normalized product attributes.
 * All policy IDs and identifiers that require external lookup are left null
 * so the operator can review and fill them in the Surface editor.
 */
function createSurfaceDraftFromNormalizedProduct(normalized, marketplace, defaults = {}) {
    const now = new Date().toISOString();
    const ebayDefs = defaults.ebay || {};
    const wantsEbay = marketplace === 'ebay';
    const type = deriveType(normalized.category);
    // Auto-populate eBay item specifics from normalized attributes
    const autoItemSpecifics = {};
    autoItemSpecifics['Brand'] = normalized.brand || 'QR Gear';
    autoItemSpecifics['Department'] = normalized.department;
    if (type)
        autoItemSpecifics['Type'] = type;
    if (normalized.colors.length === 1) {
        autoItemSpecifics['Color'] = normalized.colors[0];
    }
    if (normalized.originCountry) {
        autoItemSpecifics['Country/Region of Manufacture'] = normalized.originCountry;
    }
    // eBay-specific block — null when marketplace is not eBay
    const ebayBlock = wantsEbay
        ? {
            categoryId: ebayDefs.categoryId || null,
            conditionId: ebayDefs.conditionId || '1000',
            listingFormat: ebayDefs.listingFormat || 'FIXED_PRICE',
            subtitle: null,
            bestOfferEnabled: ebayDefs.bestOfferEnabled ?? false,
            itemSpecifics: autoItemSpecifics,
            shippingPolicyId: ebayDefs.shippingPolicyId || null,
            returnsPolicyId: ebayDefs.returnsPolicyId || null,
            paymentPolicyId: ebayDefs.paymentPolicyId || null,
            handlingTime: ebayDefs.handlingTime ?? 3,
            packageWeightLbs: ebayDefs.packageWeightLbs ?? null,
            packageDimensionsInches: null,
            upc: null,
            ean: null,
            mpn: null,
            brand: normalized.brand || 'QR Gear',
            priceOverride: null,
            quantity: ebayDefs.quantity ?? 100,
        }
        : null;
    return {
        // ── Lineage ─────────────────────────────────────────────────────────────
        masterProductId: normalized.instanceId,
        productId: normalized.sourceMasterId || '',
        artifactId: normalized.packetId || '',
        mosaicId: '',
        // ── Core listing content ─────────────────────────────────────────────────
        title: normalized.title.slice(0, 80), // eBay enforces 80-char title limit
        subtitle: '',
        description: normalized.description,
        bulletPoints: normalized.bulletPoints,
        tags: normalized.tags,
        keywords: normalized.keywords,
        images: normalized.images,
        mockupImages: normalized.images.slice(0, 1),
        // ── Pricing ──────────────────────────────────────────────────────────────
        retailPrice: normalized.retailPrice,
        compareAtPrice: normalized.compareAtPrice ?? undefined,
        currency: 'USD',
        sku: normalized.sku,
        defaultSkuPrefix: normalized.sku,
        // ── Channel enablement ───────────────────────────────────────────────────
        enabledPlatforms: [marketplace],
        supportsEmbedStore: false,
        supportsEmbedProduct: false,
        supportsEmbedBuilder: false,
        supportsEtsy: marketplace === 'etsy',
        supportsEbay: wantsEbay,
        supportsAmazon: marketplace === 'amazon',
        // ── Folder hierarchy ─────────────────────────────────────────────────────
        storeId: normalized.storeId || '',
        channelId: normalized.channelId || '',
        collectionId: normalized.collectionId || '',
        // ── Marketplace-common fields ────────────────────────────────────────────
        brand: normalized.brand,
        condition: 'new',
        material: null,
        department: normalized.department,
        shippingProfileRef: null,
        returnsProfileRef: null,
        // ── eBay block ───────────────────────────────────────────────────────────
        ebay: ebayBlock,
        // ── Status ───────────────────────────────────────────────────────────────
        status: 'draft',
        readinessErrors: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };
}
//# sourceMappingURL=surface-generator.js.map