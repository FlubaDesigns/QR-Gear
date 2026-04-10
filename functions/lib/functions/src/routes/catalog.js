"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ CATALOG MANAGEMENT SYSTEM ============
    app.get('/admin/catalogs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('catalogs').orderBy('createdAt', 'desc').get();
            const catalogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json({ catalogs });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/catalogs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, description } = req.body;
            if (!name || typeof name !== 'string') {
                res.status(400).json({ error: 'name is required' });
                return;
            }
            const doc = await core_1.db.collection('catalogs').add({
                name: name.trim(),
                description: (description || '').trim(),
                blankIds: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            console.log(`[Catalogs] Created catalog "${name}" with id ${doc.id}`);
            res.json({ id: doc.id, name: name.trim(), description: (description || '').trim(), blankIds: [], createdAt: new Date().toISOString() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/catalogs/:catalogId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const updates = { updatedAt: new Date().toISOString() };
            if (req.body.name !== undefined)
                updates.name = String(req.body.name).trim();
            if (req.body.description !== undefined)
                updates.description = String(req.body.description).trim();
            if (Array.isArray(req.body.blankIds))
                updates.blankIds = req.body.blankIds.map(String);
            await core_1.db.collection('catalogs').doc(catalogId).update(updates);
            console.log(`[Catalogs] Updated catalog ${catalogId}`);
            res.json({ success: true, catalogId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/catalogs/:catalogId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const assignDoc = await core_1.db.collection('systemSettings').doc('catalog-assignments').get();
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
            await core_1.db.collection('catalogs').doc(catalogId).delete();
            console.log(`[Catalogs] Deleted catalog ${catalogId}`);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/catalogs/:catalogId/blanks', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const { blankIds } = req.body;
            if (!Array.isArray(blankIds)) {
                res.status(400).json({ error: 'blankIds must be an array' });
                return;
            }
            const docRef = core_1.db.collection('catalogs').doc(catalogId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Catalog not found' });
                return;
            }
            const existing = (doc.data()?.blankIds || []).map(String);
            const merged = [...new Set([...existing, ...blankIds.map(String)])];
            await docRef.update({ blankIds: merged, updatedAt: new Date().toISOString() });
            console.log(`[Catalogs] Added ${blankIds.length} blanks to catalog ${catalogId}. Total: ${merged.length}`);
            res.json({ success: true, count: merged.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/catalogs/:catalogId/blanks', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const { blankIds } = req.body;
            if (!Array.isArray(blankIds)) {
                res.status(400).json({ error: 'blankIds must be an array' });
                return;
            }
            const docRef = core_1.db.collection('catalogs').doc(catalogId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Catalog not found' });
                return;
            }
            const existing = doc.data()?.blankIds || [];
            const removeSet = new Set(blankIds.map(String));
            const filtered = existing.filter(id => !removeSet.has(String(id)));
            await docRef.update({ blankIds: filtered, updatedAt: new Date().toISOString() });
            console.log(`[Catalogs] Removed ${blankIds.length} blanks from catalog ${catalogId}. Remaining: ${filtered.length}`);
            res.json({ success: true, count: filtered.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/catalogs/:catalogId/duplicate', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const srcDoc = await core_1.db.collection('catalogs').doc(catalogId).get();
            if (!srcDoc.exists) {
                res.status(404).json({ error: 'Catalog not found' });
                return;
            }
            const src = srcDoc.data();
            const newName = req.body.name || `${src.name} (Copy)`;
            const newCatalog = {
                name: newName,
                description: src.description || '',
                blankIds: src.blankIds || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            if (src.blankTiers)
                newCatalog.blankTiers = src.blankTiers;
            if (src.tierConfig)
                newCatalog.tierConfig = src.tierConfig;
            if (src.blankDescriptions)
                newCatalog.blankDescriptions = src.blankDescriptions;
            if (src.blankTitles)
                newCatalog.blankTitles = src.blankTitles;
            const doc = await core_1.db.collection('catalogs').add(newCatalog);
            console.log(`[Catalogs] Duplicated catalog "${src.name}" → "${newName}" (${doc.id}), ${(src.blankIds || []).length} blanks`);
            res.json({ id: doc.id, name: newName, description: src.description || '', blankIds: src.blankIds || [], createdAt: new Date().toISOString() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/catalogs/:catalogId/bulk-copy', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { catalogId } = req.params;
            const { targetCatalogId, blankIds } = req.body;
            if (!targetCatalogId) {
                res.status(400).json({ error: 'targetCatalogId is required' });
                return;
            }
            if (!Array.isArray(blankIds) || blankIds.length === 0) {
                res.status(400).json({ error: 'blankIds must be a non-empty array' });
                return;
            }
            const srcDoc = await core_1.db.collection('catalogs').doc(catalogId).get();
            if (!srcDoc.exists) {
                res.status(404).json({ error: 'Source catalog not found' });
                return;
            }
            const targetRef = core_1.db.collection('catalogs').doc(targetCatalogId);
            const targetDoc = await targetRef.get();
            if (!targetDoc.exists) {
                res.status(404).json({ error: 'Target catalog not found' });
                return;
            }
            const existing = (targetDoc.data()?.blankIds || []).map(String);
            const merged = [...new Set([...existing, ...blankIds.map(String)])];
            await targetRef.update({ blankIds: merged, updatedAt: new Date().toISOString() });
            const added = merged.length - existing.length;
            console.log(`[Catalogs] Bulk copied ${blankIds.length} blanks from ${catalogId} to ${targetCatalogId}. ${added} new, ${merged.length} total`);
            res.json({ success: true, added, total: merged.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/catalog-defaults', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('systemSettings').doc('catalog-defaults').get();
            const data = doc.exists ? doc.data() : {};
            res.json({ defaultCatalogId: data?.defaultCatalogId || null });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/catalog-defaults', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { defaultCatalogId } = req.body;
            if (defaultCatalogId) {
                const catDoc = await core_1.db.collection('catalogs').doc(defaultCatalogId).get();
                if (!catDoc.exists) {
                    res.status(400).json({ error: 'Catalog not found' });
                    return;
                }
            }
            await core_1.db.collection('systemSettings').doc('catalog-defaults').set({ defaultCatalogId: defaultCatalogId || null, updatedAt: new Date().toISOString() }, { merge: true });
            console.log(`[Catalogs] Set default catalog: ${defaultCatalogId || 'none'}`);
            res.json({ success: true, defaultCatalogId: defaultCatalogId || null });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/catalog-assignments', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('systemSettings').doc('catalog-assignments').get();
            const data = doc.exists ? doc.data() : {};
            res.json({
                member: data?.member || null,
                public: data?.public || null,
                external: data?.external || null,
                marketplace: data?.marketplace || null,
                platform: data?.platform || null,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/catalog-assignments', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { member, public: pub, external, marketplace, platform } = req.body;
            const updates = { updatedAt: new Date().toISOString() };
            if (member !== undefined)
                updates.member = member;
            if (pub !== undefined)
                updates.public = pub;
            if (external !== undefined)
                updates.external = external;
            if (marketplace !== undefined)
                updates.marketplace = marketplace;
            if (platform !== undefined)
                updates.platform = platform;
            await core_1.db.collection('systemSettings').doc('catalog-assignments').set(updates, { merge: true });
            console.log(`[Catalogs] Updated section assignments:`, updates);
            res.json({ success: true, assignments: updates });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=catalog.js.map