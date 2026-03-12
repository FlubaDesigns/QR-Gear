"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ PRODUCT CATEGORIES ============
    app.get('/product-categories', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('productCategories')
                .orderBy('sortOrder')
                .get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/product-categories/:id/products', async (req, res) => {
        try {
            const mappingSnapshot = await core_1.db.collection('productCategoryMappings')
                .where('categoryId', '==', req.params.id)
                .get();
            const productIds = mappingSnapshot.docs.map(d => d.data().productId);
            if (productIds.length === 0) {
                res.json([]);
                return;
            }
            const products = await Promise.all(productIds.map(async (id) => {
                const doc = await core_1.db.collection('products').doc(id).get();
                return doc.exists ? (0, core_1.docToObject)(doc) : null;
            }));
            res.json(products.filter(Boolean));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ ADMIN PRODUCT CATEGORIES ============
    app.post('/admin/product-categories', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('productCategories').add({
                ...req.body,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/product-categories/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('productCategories').doc(req.params.id).update(req.body);
            const doc = await core_1.db.collection('productCategories').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/product-categories/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('productCategories').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=categories.js.map