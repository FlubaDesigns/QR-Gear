"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
function register(app) {
    // ============ PARTNER API ============
    app.get('/partner/products', async (req, res) => {
        try {
            const apiKey = req.headers['x-api-key'];
            if (!core_1.WIDGET_API_KEY || apiKey !== core_1.WIDGET_API_KEY) {
                res.status(401).json({ error: 'Invalid or missing API key' });
                return;
            }
            const { partnerId } = req.query;
            if (!partnerId || typeof partnerId !== 'string') {
                res.status(400).json({ error: 'partnerId query parameter required' });
                return;
            }
            const storeSnapshot = await core_1.db.collection('partnerStores')
                .where('slug', '==', partnerId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            if (storeSnapshot.empty) {
                res.status(404).json({ error: 'Partner not found or inactive' });
                return;
            }
            const store = storeSnapshot.docs[0];
            const storeData = store.data();
            const productsSnapshot = await core_1.db.collection('partnerStoreProducts')
                .where('storeId', '==', store.id)
                .where('isEnabled', '==', true)
                .get();
            const products = await Promise.all(productsSnapshot.docs.map(async (spDoc) => {
                const sp = spDoc.data();
                const productDoc = await core_1.db.collection('products').doc(sp.productId).get();
                if (!productDoc.exists)
                    return null;
                const product = productDoc.data();
                return {
                    id: productDoc.id,
                    blueprintId: product.blueprintId,
                    name: sp.customName || product.name,
                    description: product.description,
                    imageUrl: product.imageUrl,
                    basePrice: sp.customPrice || product.basePrice,
                    category: product.category,
                    kcBusinessSlug: sp.kcBusinessSlug,
                    sortOrder: sp.sortOrder,
                };
            }));
            res.json({
                store: { id: store.id, name: storeData.name, slug: storeData.slug },
                products: products.filter(Boolean),
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=partner.js.map