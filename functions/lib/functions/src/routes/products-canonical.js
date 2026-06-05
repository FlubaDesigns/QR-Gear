"use strict";
/**
 * functions/src/routes/products-canonical.ts
 *
 * UNIVERSAL PRODUCT RESOLVER
 *
 * Single source of truth for all product resolution across all contexts:
 * - Admin (full access)
 * - Members (own library instances)
 * - Owners (claimed instances)
 * - External sites (public data only)
 * - Marketplaces (formatted for that provider)
 *
 * Architecture: Takes a QRG code → resolves via master_catalog → merges Printify + Printful data → returns canonical shape
 *
 * Follows schema map from ADMIN_SCHEMA_MAP.md:
 * - QRG (identity) lives in master_catalog
 * - BLD (build) resolved separately if needed
 * - GRF (graphics) resolved separately if needed
 * - ASSEMBLY joins them
 * - Context filtering applied client-side based on permissions
 *
 * One endpoint. All contexts. No duplication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProductCanonical = resolveProductCanonical;
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
// ── Database constants ──────────────────────────────────────────────────────────
const MASTER_CATALOG_COLLECTION = 'master_catalog';
/**
 * Resolve a QRG code to canonical product data
 *
 * Usage:
 *   GET /api/products/canonical/QRG-11101?context=admin
 *   GET /api/products/canonical/QRG-11101?context=member&memberId=user123
 *   GET /api/products/canonical/QRG-11101?context=owner&ownerId=owner456
 *   GET /api/products/canonical/QRG-11101?context=external
 *   GET /api/products/canonical/QRG-11101?context=marketplace&provider=etsy
 *
 * Returns: CanonicalProduct (shape is identical across all contexts)
 *
 * Access control:
 *   - admin: needs requireAdmin
 *   - member: needs memberId and member auth
 *   - owner: needs ownerId and owner auth
 *   - external/marketplace: public access
 */
async function resolveProductCanonical(qrgCode, options) {
    // Normalize QRG code format: "QRG-11101" → "qrg_11101" (Firestore doc ID)
    const docId = `qrg_${qrgCode.replace(/^QRG-/, '')}`;
    // Load from master_catalog
    const doc = await core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(docId).get();
    if (!doc.exists) {
        throw new Error(`Product not found: ${qrgCode}`);
    }
    const data = doc.data();
    // Extract canonical fields
    const canonical = {
        qrgCode,
        qrgBlankId: data.qrgBlankId || qrgCode.replace(/^QRG-/, ''),
        title: data.title || data.canonicalTitle || 'Untitled Product',
        description: data.description || null,
        brand: data.brand || null,
        category: data.category || 'Unclassified',
        subCategory: data.qrgCategory || 'Unclassified',
        images: data.images || [],
        printifyImages: data.printifyImages || [],
        printfulImages: data.printfulImages || [],
        colors: (data.colors || []).map((c) => ({
            name: c.name || c.label || '',
            code: c.code || c.value || '',
        })),
        sizes: (data.sizes || []).map((s) => ({
            name: s.name || s.label || '',
            code: s.code || s.value || '',
        })),
        pricing: {
            minPrice: data.minPrice || 0,
            maxPrice: data.maxPrice || 0,
            currency: 'USD',
        },
        availability: {
            availableVia: data.availableVia || [],
            printifyAvailable: (data.availableVia || []).includes('Printify'),
            printfulAvailable: (data.availableVia || []).includes('Printful'),
        },
        metadata: {
            originCountry: data.originCountry || null,
            weight: data.weight || null,
            dimensions: data.dimensions || null,
            lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
        },
        providers: {},
    };
    // Map provider data (NEW SCHEMA: providerMappings is object)
    const pm = data.providerMappings;
    if (pm && typeof pm === 'object' && !Array.isArray(pm)) {
        if (pm.printify) {
            canonical.providers.printify = {
                blueprintId: String(pm.printify.blueprintId || ''),
                title: pm.printify.title || canonical.title,
                productId: String(pm.printify.productId || ''),
            };
        }
        if (pm.printful) {
            canonical.providers.printful = {
                productId: String(pm.printful.productId || ''),
                title: pm.printful.title || canonical.title,
            };
        }
    }
    return canonical;
}
/**
 * Verify context-specific permissions
 * Returns true if the requester is authorized for the requested context
 */
async function verifyContextPermission(req, context, memberId, ownerId) {
    switch (context) {
        case 'admin':
            // requireAdmin middleware will have already validated this upstream
            return true;
        case 'member':
            if (!memberId)
                return false;
            // Verify user is authenticated and is the member
            const memberAuth = await (0, middleware_1.verifyMemberAuthCF)(req, memberId);
            return memberAuth.authorized;
        case 'owner':
            if (!ownerId)
                return false;
            // TODO: Implement owner auth verification
            // For now, just check that ownerId is provided
            return true;
        case 'external':
        case 'marketplace':
            // Public access
            return true;
        default:
            return false;
    }
}
function register(app) {
    /**
     * GET /api/products/canonical/:qrgCode
     *
     * Resolve a product by QRG code
     *
     * Query params:
     *   context    - "admin" | "member" | "owner" | "external" | "marketplace" (required)
     *   memberId   - Required if context=member
     *   ownerId    - Required if context=owner
     *   provider   - Required if context=marketplace (etsy|amazon|ebay)
     *
     * Returns: CanonicalProduct
     */
    app.get('/products/canonical/:qrgCode', async (req, res) => {
        try {
            const { qrgCode } = req.params;
            const context = (req.query.context || 'external');
            const memberId = req.query.memberId;
            const ownerId = req.query.ownerId;
            const marketplaceProvider = req.query.provider;
            // Validate context
            if (!['admin', 'member', 'owner', 'external', 'marketplace'].includes(context)) {
                res.status(400).json({ error: 'Invalid context parameter' });
                return;
            }
            // Admin context requires admin auth
            if (context === 'admin') {
                // This endpoint can also be called with requireAdmin middleware upstream
                // For now, just validate admin status via auth
                const authHeader = req.headers.authorization;
                if (!authHeader) {
                    res.status(401).json({ error: 'Unauthorized' });
                    return;
                }
                // verifyAuth will be called before requireAdmin middleware
                // If we reach here without requireAdmin middleware, reject
                const user = req.user;
                if (!user?.admin) {
                    res.status(403).json({ error: 'Admin access required' });
                    return;
                }
            }
            // Member context requires member auth
            if (context === 'member') {
                if (!memberId) {
                    res.status(400).json({ error: 'memberId required for member context' });
                    return;
                }
                const auth = await (0, middleware_1.verifyMemberAuthCF)(req, memberId);
                if (!auth.authorized) {
                    res.status(403).json({ error: 'Member access denied' });
                    return;
                }
            }
            // Owner context requires owner ID (TODO: add full auth check)
            if (context === 'owner' && !ownerId) {
                res.status(400).json({ error: 'ownerId required for owner context' });
                return;
            }
            // Marketplace context requires provider
            if (context === 'marketplace' && !marketplaceProvider) {
                res.status(400).json({ error: 'provider required for marketplace context' });
                return;
            }
            // Resolve the product
            const product = await resolveProductCanonical(qrgCode, {
                context,
                memberId,
                ownerId,
                marketplaceProvider,
            });
            // Return canonical product (same shape for all contexts)
            res.json({
                success: true,
                context,
                product,
                resolvedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error.message.includes('Product not found')) {
                res.status(404).json({ error: error.message });
            }
            else {
                console.error('[ProductsCanonical] Error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    });
    /**
     * GET /api/products/canonical/batch
     *
     * Resolve multiple products at once
     *
     * Body:
     *   {
     *     qrgCodes: ["QRG-11101", "QRG-12001"],
     *     context: "admin" | "member" | "owner" | "external" | "marketplace",
     *     memberId?: string,
     *     ownerId?: string,
     *     provider?: string
     *   }
     *
     * Returns: { products: CanonicalProduct[], errors: { qrgCode, error }[] }
     */
    app.post('/products/canonical/batch', async (req, res) => {
        try {
            const { qrgCodes, context, memberId, ownerId, provider } = req.body;
            if (!Array.isArray(qrgCodes) || qrgCodes.length === 0) {
                res.status(400).json({ error: 'qrgCodes array required' });
                return;
            }
            if (!context) {
                res.status(400).json({ error: 'context required' });
                return;
            }
            // Admin auth check (if needed)
            if (context === 'admin') {
                const auth = await (0, middleware_1.verifyAuth)(req);
                if (!auth?.isAdmin) {
                    res.status(403).json({ error: 'Admin access required' });
                    return;
                }
            }
            // Resolve all products in parallel
            const results = await Promise.allSettled(qrgCodes.map((qrgCode) => resolveProductCanonical(qrgCode, { context, memberId, ownerId, marketplaceProvider: provider })));
            const products = [];
            const errors = [];
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.status === 'fulfilled') {
                    products.push(result.value);
                }
                else {
                    errors.push({
                        qrgCode: qrgCodes[i],
                        error: result.reason?.message || 'Unknown error',
                    });
                }
            }
            res.json({
                success: true,
                context,
                products,
                errors,
                count: products.length,
                failureCount: errors.length,
                resolvedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[ProductsCanonical/Batch] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=products-canonical.js.map