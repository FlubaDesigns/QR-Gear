"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const nexusmail_1 = require("../nexusmail");
function register(app) {
    // ============ ADMIN PRICING RULES ============
    app.get('/admin/pricing-rules', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('pricingRules').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/pricing-rules', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('pricingRules').add({
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
    app.put('/admin/pricing-rules/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('pricingRules').doc(req.params.id).update(req.body);
            const doc = await core_1.db.collection('pricingRules').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/pricing-rules/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('pricingRules').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ HOSTING TIERS (ADMIN) ============
    app.post('/admin/hosting-tiers', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('hostingTiers').add({
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
    app.put('/admin/hosting-tiers/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('hostingTiers').doc(req.params.id).update(req.body);
            const doc = await core_1.db.collection('hostingTiers').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/hosting-tiers/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('hostingTiers').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ GALLERY (ADMIN) ============
    app.post('/admin/gallery', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('galleryItems').add({
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
    app.delete('/admin/gallery/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('galleryItems').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ COUPONS (ADMIN) ============
    app.get('/admin/coupons', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('coupons').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/coupons', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('coupons').add({
                ...req.body,
                redemptionCount: 0,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/coupons/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('coupons').doc(req.params.id).update(req.body);
            const doc = await core_1.db.collection('coupons').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/coupons/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('coupons').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ NEXUSMAIL ADMIN ENDPOINTS ============
    // Get NexusMail status and health
    app.get('/admin/nexusmail/status', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const service = (0, nexusmail_1.getNexusMailService)(core_1.db);
            const isReady = service.isReady();
            const healthScore = service.getHealthScore();
            const stats = await service.getStats();
            res.json({
                ready: isReady,
                provider: isReady ? 'resend' : 'not_configured',
                health: healthScore,
                outboxStats: stats,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Seed default email templates
    app.post('/admin/nexusmail/seed-templates', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const service = (0, nexusmail_1.getNexusMailService)(core_1.db);
            const templateStore = service.getTemplateStore();
            const seeded = await (0, nexusmail_1.seedDefaultTemplates)(templateStore);
            res.json({
                success: true,
                message: `Seeded ${seeded} templates`,
                templatesSeeded: seeded,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Get outbox records
    app.get('/admin/nexusmail/outbox', middleware_1.requireAdmin, async (req, res) => {
        try {
            const service = (0, nexusmail_1.getNexusMailService)(core_1.db);
            const outboxRepo = service.getOutboxRepo();
            const limit = parseInt(req.query.limit) || 50;
            const records = await outboxRepo.getRecent(limit);
            res.json({ records });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Process pending outbox items
    app.post('/admin/nexusmail/process-outbox', middleware_1.requireAdmin, async (req, res) => {
        try {
            const service = (0, nexusmail_1.getNexusMailService)(core_1.db);
            const limit = parseInt(req.body.limit) || 10;
            const sent = await service.processOutbox(limit);
            res.json({
                success: true,
                sent,
                message: `Processed ${sent} emails`,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Retry failed outbox items
    app.post('/admin/nexusmail/retry-failed', middleware_1.requireAdmin, async (req, res) => {
        try {
            const service = (0, nexusmail_1.getNexusMailService)(core_1.db);
            const limit = parseInt(req.body.limit) || 10;
            const sent = await service.retryFailed(limit);
            res.json({
                success: true,
                sent,
                message: `Retried and sent ${sent} emails`,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=admin-settings.js.map