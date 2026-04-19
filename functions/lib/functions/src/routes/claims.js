"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ CLAIM CODE SYSTEM ============
    function generateNanoId(length = 12) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    // Validate claim code
    app.get('/claim/validate/:claimCode', async (req, res) => {
        try {
            const { claimCode } = req.params;
            const doc = await core_1.db.collection('claimCodes').doc(claimCode).get();
            if (!doc.exists) {
                res.json({ valid: false, reason: 'Claim code not found' });
                return;
            }
            const claimData = doc.data();
            if (claimData.status === 'claimed') {
                res.json({ valid: false, reason: 'This item has already been claimed' });
                return;
            }
            if (claimData.status === 'expired') {
                res.json({ valid: false, reason: 'This claim code has expired' });
                return;
            }
            if (claimData.expiresAt && new Date(claimData.expiresAt) < new Date()) {
                await core_1.db.collection('claimCodes').doc(claimCode).update({ status: 'expired' });
                res.json({ valid: false, reason: 'This claim code has expired' });
                return;
            }
            res.json({ valid: true, claimData });
        }
        catch (error) {
            console.error('[Claim] Validation error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Claim an item
    app.post('/claim/:claimCode', middleware_1.requireAuth, async (req, res) => {
        try {
            const { claimCode } = req.params;
            const userId = req.user?.uid;
            const userEmail = req.user?.email;
            const doc = await core_1.db.collection('claimCodes').doc(claimCode).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Claim code not found' });
                return;
            }
            const claimData = doc.data();
            if (claimData.status !== 'unclaimed') {
                res.status(400).json({ error: 'This item has already been claimed or expired' });
                return;
            }
            const instanceId = generateNanoId(16);
            const now = new Date();
            const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            const instanceData = {
                instanceId,
                claimCode,
                templateId: claimData.templateId || '',
                packetType: claimData.packetType,
                ownerUserId: userId,
                ownerEmail: userEmail || null,
                productName: claimData.productName,
                productDescription: claimData.productDescription || null,
                previewImageUrl: claimData.previewImageUrl || null,
                destinationUrl: null,
                customConfig: null,
                status: 'active',
                hostingExpiresAt: oneYearFromNow.toISOString(),
                remindersSent: [],
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                claimedAt: now.toISOString(),
                metadata: claimData.metadata || null,
            };
            const batch = core_1.db.batch();
            batch.set(core_1.db.collection('claimedInstances').doc(instanceId), instanceData);
            batch.update(core_1.db.collection('claimCodes').doc(claimCode), {
                status: 'claimed',
                instanceId,
                claimedByUserId: userId,
                claimedAt: now.toISOString(),
            });
            await batch.commit();
            console.log(`[Claim] Item claimed: ${claimCode} -> Instance: ${instanceId} by User: ${userId}`);
            res.json({ success: true, instanceId });
        }
        catch (error) {
            console.error('[Claim] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Get user's claimed instances
    app.get('/claimed-instances', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            const snapshot = await core_1.db.collection('claimedInstances')
                .where('ownerUserId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            const instances = snapshot.docs.map(doc => doc.data());
            res.json(instances);
        }
        catch (error) {
            console.error('[Claim] Get instances error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Get single claimed instance
    app.get('/claimed-instances/:instanceId', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const doc = await core_1.db.collection('claimedInstances').doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            const instance = doc.data();
            const isActive = instance?.status === 'active' && new Date(instance?.hostingExpiresAt) > new Date();
            res.json({ ...instance, isActive });
        }
        catch (error) {
            console.error('[Claim] Get instance error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Update claimed instance destination
    app.patch('/claimed-instances/:instanceId', middleware_1.requireAuth, async (req, res) => {
        try {
            const { instanceId } = req.params;
            const { destinationUrl } = req.body;
            const userId = req.user?.uid;
            const doc = await core_1.db.collection('claimedInstances').doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            const instance = doc.data();
            if (instance?.ownerUserId !== userId) {
                res.status(403).json({ error: 'Not authorized to modify this instance' });
                return;
            }
            await core_1.db.collection('claimedInstances').doc(instanceId).update({
                destinationUrl,
                updatedAt: new Date().toISOString(),
            });
            res.json({ success: true });
        }
        catch (error) {
            console.error('[Claim] Update error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Admin: Generate claim codes
    app.post('/admin/claim-codes', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { templateId, packetType, productName, productDescription, previewImageUrl, count = 1 } = req.body;
            if (!templateId || !packetType || !productName) {
                res.status(400).json({ error: 'templateId, packetType, and productName are required' });
                return;
            }
            const codes = [];
            const batch = core_1.db.batch();
            for (let i = 0; i < Math.min(count, 100); i++) {
                const claimCode = generateNanoId(12);
                const claimData = {
                    claimCode,
                    templateId,
                    packetType,
                    productName,
                    productDescription,
                    previewImageUrl,
                    status: 'unclaimed',
                    createdAt: new Date().toISOString(),
                };
                batch.set(core_1.db.collection('claimCodes').doc(claimCode), claimData);
                codes.push(claimData);
            }
            await batch.commit();
            console.log(`[Claim] Generated ${codes.length} claim codes for template: ${templateId}`);
            res.json({
                message: `Generated ${codes.length} claim codes`,
                codes: count === 1 ? codes[0] : codes,
            });
        }
        catch (error) {
            console.error('[Claim] Generate codes error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=claims.js.map