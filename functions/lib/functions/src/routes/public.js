"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const printify_1 = require("../services/printify");
function register(app) {
    // ============ QR GENERATION ============
    app.post('/qr/generate', async (req, res) => {
        try {
            const { content, color, backgroundColor, size, format } = req.body;
            if (!content) {
                res.status(400).json({ error: 'Content is required' });
                return;
            }
            res.json({
                success: true,
                message: 'QR generation endpoint - use client-side QR library for immediate generation',
                content,
                options: { color, backgroundColor, size, format },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ STORES (PUBLIC) ============
    app.get('/stores', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('partnerStores')
                .where('isActive', '==', true)
                .get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PUBLIC GIFT CODE VALIDATION ============
    app.get('/gift-codes/:code', async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('giftCodes')
                .where('code', '==', req.params.code.toUpperCase())
                .where('isRedeemed', '==', false)
                .limit(1)
                .get();
            if (snapshot.empty) {
                res.status(404).json({ error: 'Gift code not found or already redeemed' });
                return;
            }
            const giftCode = (0, core_1.docToObject)(snapshot.docs[0]);
            if (giftCode.expiresAt && new Date(giftCode.expiresAt) < new Date()) {
                res.status(400).json({ error: 'Gift code has expired' });
                return;
            }
            res.json(giftCode);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PRINTIFY STATUS ============
    app.get('/printify/status', async (_req, res) => {
        try {
            res.json({
                connected: printify_1.printifyClient.isConfigured,
                mode: 'firebase-functions',
                message: printify_1.printifyClient.isConfigured
                    ? 'Printify integration is configured and ready'
                    : 'Printify API key or Shop ID not configured'
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=public.js.map