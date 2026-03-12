"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ DESIGNS CRUD ============
    app.get('/designs', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const snapshot = await core_1.db.collection('customDesigns')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/designs', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const docRef = await core_1.db.collection('customDesigns').add({
                ...req.body,
                userId,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/designs/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            await core_1.db.collection('customDesigns').doc(req.params.id).update({
                ...req.body,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await core_1.db.collection('customDesigns').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/designs/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            await core_1.db.collection('customDesigns').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=designs.js.map