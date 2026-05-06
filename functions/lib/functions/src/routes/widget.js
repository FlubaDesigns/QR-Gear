"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const jwt = __importStar(require("jsonwebtoken"));
const core_1 = require("../core");
const constants_1 = require("../constants");
function register(app) {
    // ============ WIDGET API ============
    function signWidgetToken(payload) {
        if (!core_1.WIDGET_JWT_SECRET) {
            throw new Error('WIDGET_JWT_SECRET not configured');
        }
        return jwt.sign(payload, core_1.WIDGET_JWT_SECRET, { expiresIn: '1h' });
    }
    function verifyWidgetToken(token) {
        try {
            if (!core_1.WIDGET_JWT_SECRET) {
                return null;
            }
            return jwt.verify(token, core_1.WIDGET_JWT_SECRET);
        }
        catch {
            return null;
        }
    }
    app.get('/widget/session', async (req, res) => {
        try {
            const token = req.query.token;
            if (!token) {
                res.status(400).json({ error: 'Token required' });
                return;
            }
            const payload = verifyWidgetToken(token);
            if (!payload) {
                res.status(401).json({ error: 'Invalid or expired token' });
                return;
            }
            const snapshot = await core_1.db.collection('products')
                .where('isEnabled', '==', true)
                .limit(6)
                .get();
            const featuredProducts = snapshot.docs.map(doc => {
                const p = doc.data();
                return {
                    id: doc.id,
                    name: p.name,
                    imageUrl: p.imageUrl || '',
                    basePrice: p.basePrice,
                    category: p.category,
                };
            });
            res.json({
                businessName: payload.businessName,
                businessLogoUrl: payload.businessLogoUrl,
                kcListingUrl: payload.kcListingUrl,
                products: featuredProducts,
            });
        }
        catch (error) {
            console.error('Widget session error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/widget/token', async (req, res) => {
        try {
            const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
            if (!core_1.WIDGET_API_KEY || apiKey !== core_1.WIDGET_API_KEY) {
                res.status(401).json({ error: 'Invalid or missing API key' });
                return;
            }
            const { businessName, businessLogoUrl, kcListingUrl } = req.body;
            if (!businessName || !kcListingUrl) {
                res.status(400).json({ error: 'businessName and kcListingUrl are required' });
                return;
            }
            const token = signWidgetToken({ businessName, businessLogoUrl, kcListingUrl });
            res.json({
                token,
                expiresIn: 3600
            });
        }
        catch (error) {
            console.error('Widget token error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Partner widget items endpoint - used by external partner widget embeds
    app.get('/widget/items', async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const apiKey = req.headers['x-api-key'];
            const providedKey = apiKey || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader);
            if (!core_1.PARTNER_API_KEY || providedKey !== core_1.PARTNER_API_KEY) {
                res.status(401).json({ error: 'Invalid or missing API key' });
                return;
            }
            const channelId = req.query.channelId;
            const storeId = req.query.storeId;
            if (!storeId) {
                res.status(400).json({ error: 'storeId is required' });
                return;
            }
            if (!channelId) {
                res.status(400).json({ error: 'channelId is required' });
                return;
            }
            // Query channel items from Firestore
            const snapshot = await core_1.db.collection('catalogItemLinks')
                .where('channelId', '==', channelId)
                .where('status', '==', 'published')
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
            const items = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title || data.name,
                    description: data.description,
                    previewUrl: data.previewUrl || data.thumbnailUrl,
                    publicUrl: data.publicUrl,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt,
                    shareImageSquareUrl: data.shareImageSquareUrl,
                    shareImageLinkUrl: data.shareImageLinkUrl,
                    shareCaption: data.shareCaption,
                };
            });
            res.json({
                channelId,
                storeId,
                items,
                count: items.length,
            });
        }
        catch (error) {
            console.error('Widget items error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: WIDGET ROUTES ============
    app.get('/widget/events', async (req, res) => {
        res.json({ events: [
                { type: 'qrgear:ready', description: 'Widget loaded' },
                { type: 'qrgear:height', description: 'Height changed' },
                { type: 'qrgear:navigate', description: 'User clicked return' },
                { type: 'qrgear:item_click', description: 'User clicked item' },
                { type: 'qrgear:item_share', description: 'User shared item' },
                { type: 'qrgear:publish_success', description: 'Product published' },
            ] });
    });
    app.get('/widget/mosaics/:mosaicId', async (req, res) => {
        try {
            const doc = await core_1.db.collection(constants_1.MOSAICS_COLLECTION).doc(req.params.mosaicId).get();
            if (!doc.exists) {
                res.status(404).json({ ok: false, error: "Mosaic not found" });
                return;
            }
            res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() } });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    app.get('/widget/mosaics/:mosaicId/moments', async (req, res) => {
        try {
            const doc = await core_1.db.collection(constants_1.MOSAICS_COLLECTION).doc(req.params.mosaicId).get();
            if (!doc.exists) {
                res.status(404).json({ ok: false, error: "Mosaic not found" });
                return;
            }
            const entries = doc.data()?.entries || [];
            const moments = entries.sort((a, b) => a.day - b.day);
            res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() }, moments });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    app.post('/widget/mosaics', async (req, res) => {
        try {
            const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
            if (!core_1.WIDGET_API_KEY || apiKey !== core_1.WIDGET_API_KEY) {
                res.status(401).json({ ok: false, error: 'Invalid or missing API key' });
                return;
            }
            const ref = await core_1.db.collection(constants_1.MOSAICS_COLLECTION).add({ ...req.body, createdAt: new Date(), status: 'draft' });
            const doc = await ref.get();
            res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() } });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    app.patch('/widget/mosaics/:mosaicId', async (req, res) => {
        try {
            const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
            if (!core_1.WIDGET_API_KEY || apiKey !== core_1.WIDGET_API_KEY) {
                res.status(401).json({ ok: false, error: 'Invalid or missing API key' });
                return;
            }
            await core_1.db.collection(constants_1.MOSAICS_COLLECTION).doc(req.params.mosaicId).update(req.body);
            res.json({ ok: true });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    app.get('/widget/stores/:storeId/mosaics', async (req, res) => {
        try {
            const snap = await core_1.db.collection(constants_1.MOSAICS_COLLECTION).where('storeId', '==', req.params.storeId).get();
            res.json({ ok: true, mosaics: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    app.get('/widget/verify', async (req, res) => {
        try {
            const token = req.query.token;
            if (!token) {
                res.json({ valid: false, error: "No token" });
                return;
            }
            res.json({ valid: true, payload: { token } });
        }
        catch (e) {
            res.json({ valid: false, error: e.message });
        }
    });
}
//# sourceMappingURL=widget.js.map