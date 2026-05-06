"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ BATCH: PACKETS & LANDING PAGES ============
    app.post('/packets', middleware_1.requireAdmin, async (req, res) => {
        try {
            const body = req.body;
            // Validate assemblyId exists in master_catalog if provided
            if (body.assemblyId) {
                const asmDoc = await core_1.db.collection('master_catalog').doc(String(body.assemblyId)).get();
                if (!asmDoc.exists) {
                    res.status(400).json({ error: `assemblyId '${body.assemblyId}' not found in master_catalog` });
                    return;
                }
            }
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const packetData = (0, core_1.stripUndef)({ ...body, createdAt: now, updatedAt: now });
            delete packetData.mockupJobsQueued;
            if (packetData.headerStyle)
                packetData.headerStyle = (0, core_1.sanitizeStyleForFirestore)(packetData.headerStyle);
            if (packetData.footerStyle)
                packetData.footerStyle = (0, core_1.sanitizeStyleForFirestore)(packetData.footerStyle);
            if (packetData.titleStyle)
                packetData.titleStyle = (0, core_1.sanitizeStyleForFirestore)(packetData.titleStyle);
            if (packetData.descriptionStyle)
                packetData.descriptionStyle = (0, core_1.sanitizeStyleForFirestore)(packetData.descriptionStyle);
            const ref = await core_1.db.collection('productPackets').add(packetData);
            res.json({ success: true, packetId: ref.id, mockupJobsQueued: 0, message: 'Product packet created' });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/packets', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('productPackets').orderBy('createdAt', 'desc').limit(100).get();
            const packets = snap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null }; });
            res.json({ success: true, packets, count: packets.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/packets/:packetId', async (req, res) => {
        try {
            const doc = await core_1.db.collection('productPackets').doc(req.params.packetId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Packet not found" });
                return;
            }
            const data = doc.data();
            let linkedTemplateId = null;
            const tSnap = await core_1.db.collection('productTemplates').where('packetId', '==', req.params.packetId).limit(1).get();
            if (!tSnap.empty)
                linkedTemplateId = tSnap.docs[0].id;
            res.json({ success: true, packet: { id: doc.id, ...data, templateId: linkedTemplateId, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null } });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/public/landing/:slug', async (req, res) => {
        try {
            const snap = await core_1.db.collection('productPackets').where('landingPageSlug', '==', req.params.slug).limit(1).get();
            if (snap.empty) {
                res.status(404).json({ error: "Landing page not found" });
                return;
            }
            const doc = snap.docs[0];
            const d = doc.data();
            res.json({ success: true, landingPage: { packetId: doc.id, title: d.landingPageTitle || d.productName || 'QR Product', description: d.landingPageDescription || d.productDescription || '', backgroundUrl: d.landingPageBackgroundUrl || d.compositeUrl || null, compositeUrl: d.compositeUrl || null, qrOnlyUrl: d.qrOnlyUrl || null, qrContent: d.qrContent || null, productName: d.productName || null, productImageUrl: d.productImageUrl || null, headerStyle: d.headerStyle || null, footerStyle: d.footerStyle || null, pricing: d.pricing || null, createdAt: d.createdAt?.toDate?.() || null, landingPageSnapshotUrl: d.landingPageSnapshotUrl || d.compositeUrl || null, qrProductState: d.qrProductState || d.mode || 'qr_canvas', playMediaUrl: d.playMediaUrl || d.videoUrl || null, playMediaType: d.playMediaType || d.mediaType || null, landingPageTitle: d.landingPageTitle || d.productName || null, landingPageDescription: d.landingPageDescription || null, landingPageBackgroundUrl: d.landingPageBackgroundUrl || null } });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
//# sourceMappingURL=packets.js.map