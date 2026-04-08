"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ BATCH: IMAGES, PROXY, UPLOADS, CLAIMS, STORAGE ============
    app.get('/proxy-image', async (req, res) => {
        try {
            const imageUrl = req.query.url;
            if (!imageUrl) {
                res.status(400).json({ error: "Missing url parameter" });
                return;
            }
            const allowed = ['images.printify.com', 'images-api.printify.com', 'printful.com', 'files.cdn.printful.com'];
            const url = new URL(imageUrl);
            if (!allowed.some(d => url.hostname.includes(d))) {
                res.status(403).json({ error: "Domain not allowed" });
                return;
            }
            const resp = await fetch(imageUrl);
            if (!resp.ok) {
                res.status(resp.status).json({ error: "Failed to fetch" });
                return;
            }
            const ct = resp.headers.get('content-type') || 'image/jpeg';
            const buf = Buffer.from(await resp.arrayBuffer());
            res.set('Content-Type', ct);
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Cache-Control', 'public, max-age=86400');
            res.send(buf);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/images/upload', middleware_1.requireAuth, async (req, res) => {
        try {
            const { imageData, originalName, mimeType, title, description, userId } = req.body;
            if (!imageData || !originalName || !mimeType) {
                res.status(400).json({ error: "Missing required fields" });
                return;
            }
            const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
            if (!allowedMimeTypes.includes(mimeType)) {
                res.status(400).json({ error: `Invalid file type: ${mimeType}. Allowed: PNG, JPEG, WebP, GIF, SVG` });
                return;
            }
            const buf = Buffer.from(imageData, 'base64');
            const maxSize = 25 * 1024 * 1024;
            if (buf.length > maxSize) {
                res.status(400).json({ error: "Image exceeds 25MB limit" });
                return;
            }
            const fileName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const bucket = core_1.admin.storage().bucket();
            const file = bucket.file(`uploads/${fileName}`);
            await file.save(buf, { metadata: { contentType: mimeType } });
            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/uploads/${fileName}`;
            const ref = await core_1.db.collection('hosted_images').add({ userId: userId || null, fileName, originalName, mimeType, sizeBytes: buf.length, storageUrl: `uploads/${fileName}`, publicUrl, title: title || null, description: description || null, isActive: true, createdAt: new Date() });
            res.json({ id: ref.id, publicUrl: `/view/${ref.id}`, directUrl: publicUrl, landingUrl: `/view/${ref.id}` });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/images/:imageId', async (req, res) => {
        try {
            const doc = await core_1.db.collection('hosted_images').doc(req.params.imageId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Image not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/images/info/:imageId', async (req, res) => {
        try {
            const doc = await core_1.db.collection('hosted_images').doc(req.params.imageId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Image not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/images/user/:userId', async (req, res) => {
        try {
            const snap = await core_1.db.collection('hosted_images').where('userId', '==', req.params.userId).where('isActive', '==', true).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/uploads/request-url', middleware_1.requireAuth, async (req, res) => {
        try {
            const { name, contentType } = req.body;
            if (!name || !contentType) {
                res.status(400).json({ error: "Missing name or contentType" });
                return;
            }
            const allowedUploadTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm'];
            if (!allowedUploadTypes.includes(contentType)) {
                res.status(400).json({ error: `Invalid content type: ${contentType}` });
                return;
            }
            const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const path = `uploads/${Date.now()}-${sanitizedName}`;
            const bucket = core_1.admin.storage().bucket();
            const file = bucket.file(path);
            const [uploadUrl] = await file.getSignedUrl({ action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType });
            res.json({ uploadUrl, fileUrl: `https://storage.googleapis.com/${bucket.name}/${path}`, path });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/claim/validate', async (req, res) => {
        try {
            const code = req.query.code;
            if (!code) {
                res.status(400).json({ valid: false, reason: "Missing claim code" });
                return;
            }
            const snap = await core_1.db.collection('claim_codes').where('code', '==', code).limit(1).get();
            if (snap.empty) {
                res.json({ valid: false, reason: "Claim code not found" });
                return;
            }
            const data = snap.docs[0].data();
            if (data.status !== 'available') {
                res.json({ valid: false, reason: "Already used" });
                return;
            }
            res.json({ valid: true, claimData: { claimCode: data.code, productName: data.productName || 'QR Gear Product', productDescription: data.productDescription || null, previewImageUrl: data.previewImageUrl || null, packetType: data.packetType || 'qr_basic', status: data.status } });
        }
        catch (e) {
            res.status(500).json({ valid: false, reason: e.message });
        }
    });
    app.get('/storage/health', async (req, res) => {
        try {
            const bucket = core_1.admin.storage().bucket();
            res.json({ healthy: true, bucket: bucket.name });
        }
        catch (e) {
            res.json({ healthy: false, error: e.message });
        }
    });
}
//# sourceMappingURL=images.js.map