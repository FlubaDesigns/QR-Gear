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
exports.processQueueInBackground = processQueueInBackground;
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const graphicCodes_1 = require("../../../shared/graphicCodes");
const mockup_generator_1 = require("../services/mockup-generator");
async function processQueueInBackground() {
    const processLimit = 10;
    const pendingSnapshot = await core_1.db.collection('mockup_jobs')
        .where('status', '==', 'pending')
        .limit(processLimit)
        .get();
    if (pendingSnapshot.empty) {
        console.log('[Queue Background] No pending jobs');
        return;
    }
    console.log(`[Queue Background] Processing ${pendingSnapshot.size} jobs`);
    for (const jobDoc of pendingSnapshot.docs) {
        const job = jobDoc.data();
        const jobId = jobDoc.id;
        try {
            const claimed = await core_1.db.runTransaction(async (transaction) => {
                const jobRef = core_1.db.collection('mockup_jobs').doc(jobId);
                const freshDoc = await transaction.get(jobRef);
                if (!freshDoc.exists || freshDoc.data()?.status !== 'pending') {
                    return false;
                }
                transaction.update(jobRef, {
                    status: 'processing',
                    startedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                    processorId: `bg-${Date.now()}`,
                });
                return true;
            });
            if (!claimed)
                continue;
            await new Promise(resolve => setTimeout(resolve, 10000));
            let effectiveProvider;
            let resolvedBlueprintId;
            let artworkUrl;
            let artworkVariant;
            let printProviderId;
            if (job.templateId) {
                const templateDoc = await core_1.db.collection('productTemplates').doc(job.templateId).get();
                if (!templateDoc.exists) {
                    throw new Error(`Template ${job.templateId} not found`);
                }
                const template = templateDoc.data();
                effectiveProvider = template.fulfillmentProvider || job.fulfillmentProvider || 'printify';
                if (effectiveProvider === 'printful') {
                    resolvedBlueprintId = template.productId || template.blueprintId || 71;
                }
                else {
                    resolvedBlueprintId = template.blueprintId || template.productId || 5;
                }
                artworkUrl = template.artworkUrl;
                artworkVariant = template.artworkVariant || 'black';
                printProviderId = template.printProviderId || 39;
            }
            else if (job.jobData) {
                effectiveProvider = job.jobData.fulfillmentProvider || 'printify';
                if (effectiveProvider === 'printful') {
                    resolvedBlueprintId = job.jobData.blueprintId || 71;
                }
                else {
                    resolvedBlueprintId = job.jobData.blueprintId || 5;
                }
                artworkUrl = job.jobData.artworkUrl;
                artworkVariant = job.jobData.artworkVariant || 'black';
                printProviderId = job.jobData.printProviderId || 39;
            }
            else {
                throw new Error(`Job ${jobId} has no templateId or jobData`);
            }
            const mockupResult = await (0, mockup_generator_1.generateMockupFromPrintful)({
                blueprintId: resolvedBlueprintId,
                printProviderId,
                colorName: job.colorName,
                colorHex: job.colorHex || '#000000',
                artworkUrl,
                artworkVariant: artworkVariant,
                fulfillmentProvider: effectiveProvider,
                placement: job.placement || 'front',
                printMethod: job.printMethod,
                qrSize: job.qrSize || 'medium',
                hasCompositeGraphic: true,
            });
            if (job.templateId) {
                const colorKey = job.colorName.replace(/\s+/g, '_').toLowerCase();
                const placementKey = job.placement || 'front';
                const sizeKey = job.qrSize || 'large';
                await core_1.db.collection('productTemplates').doc(job.templateId).update({
                    [`mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`]: mockupResult.mockupUrl,
                    [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleMockupUrl || null,
                    updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            await core_1.db.collection('mockup_jobs').doc(jobId).update({
                status: 'completed',
                mockupUrl: mockupResult.mockupUrl,
                completedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            // If this job belongs to a packet, write the best mockup URL back to the
            // packet document so template cards always display a real printer mockup,
            // AND write the full mockupsByColor 3-level structure so the store can
            // serve per-color swatches via extractPacketMockups().
            if (job.productId && typeof job.productId === 'string' && job.productId.startsWith('packet_')) {
                const packetId = job.productId.slice('packet_'.length);
                try {
                    const packetRef = core_1.db.collection('productPackets').doc(packetId);
                    const packetSnap = await packetRef.get();
                    if (packetSnap.exists) {
                        const packetData = packetSnap.data() || {};
                        const existingUrl = packetData.priorityMockupUrl || null;
                        const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl || null;
                        // Always write mockupsByColor so per-color swatches appear in the store.
                        const colorKey = job.colorName.replace(/\s+/g, '_').toLowerCase();
                        const placementKey = job.placement || 'front';
                        const sizeKey = job.qrSize || 'large';
                        await packetRef.update({
                            [`mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`]: mockupResult.mockupUrl,
                            [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleMockupUrl || null,
                            updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                        });
                        console.log(`[Queue Background] Wrote mockupsByColor to packet ${packetId}: ${colorKey}/${placementKey}/${sizeKey}`);
                        const isUpgrade = bestUrl &&
                            (!existingUrl || (mockupResult.lifestyleMockupUrl && existingUrl !== mockupResult.lifestyleMockupUrl));
                        if (isUpgrade) {
                            await packetRef.update({ priorityMockupUrl: bestUrl });
                            console.log(`[Queue Background] Updated packet ${packetId} priorityMockupUrl with ${mockupResult.lifestyleMockupUrl ? 'lifestyle' : 'flat'} mockup`);
                            // Also prepend the mockup into the committed admin_catalog_instance, if one exists.
                            // Chain: packet.ownerInstanceId → admin_catalog_instances doc → resolved.images
                            const ownerInstanceId = packetData.ownerInstanceId || null;
                            if (ownerInstanceId) {
                                try {
                                    const instanceRef = core_1.db.collection('admin_catalog_instances').doc(ownerInstanceId);
                                    const instanceSnap = await instanceRef.get();
                                    if (instanceSnap.exists) {
                                        const instanceData = instanceSnap.data() || {};
                                        const existingImages = instanceData.resolved?.images || [];
                                        if (!existingImages[0] || existingImages[0] !== bestUrl) {
                                            const filtered = existingImages.filter((img) => img !== bestUrl);
                                            const newImages = [bestUrl, ...filtered];
                                            await instanceRef.update({
                                                'resolved.images': newImages,
                                                'baseSnapshot.images': newImages,
                                                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                                            });
                                            console.log(`[Queue Background] Updated instance ${ownerInstanceId} resolved.images with mockup`);
                                        }
                                    }
                                }
                                catch (instanceErr) {
                                    console.error(`[Queue Background] Failed to write-back mockup to instance ${ownerInstanceId}:`, instanceErr.message);
                                }
                            }
                        }
                    }
                }
                catch (packetErr) {
                    console.error(`[Queue Background] Failed to write-back mockup to packet ${packetId}:`, packetErr.message);
                }
            }
            console.log(`[Queue Background] Completed: ${job.colorName}/${job.placement}/${job.qrSize}`);
        }
        catch (error) {
            console.error(`[Queue Background] Job ${jobId} failed:`, error.message);
            await core_1.db.collection('mockup_jobs').doc(jobId).update({
                status: 'failed',
                error: error.message,
                failedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
}
function register(app) {
    // ============ FILE UPLOAD (Firebase Storage) ============
    app.post('/upload', async (req, res) => {
        try {
            const user = await (0, middleware_1.verifyAuth)(req);
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            res.json({
                success: false,
                message: 'File uploads should be done directly to Firebase Storage from the client using Firebase SDK',
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ LIBRARY ASSET ENDPOINTS (source / cropped / background pipeline) ============
    const VALID_ASSET_TYPES = new Set(['source', 'cropped', 'background', 'template', 'design']);
    function sanitizeAssetFilename(name) {
        return String(name || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
    }
    app.get('/admin/background-assets', middleware_1.requireAdmin, async (req, res) => {
        try {
            const typeFilter = req.query.type || 'source';
            if (!VALID_ASSET_TYPES.has(typeFilter)) {
                res.status(400).json({ error: `Invalid type. Must be one of: ${[...VALID_ASSET_TYPES].join(', ')}` });
                return;
            }
            const snapshot = await core_1.db.collection('library_assets')
                .where('isActive', '==', true)
                .where('assetType', '==', typeFilter)
                .get();
            const assets = snapshot.docs.map((doc) => {
                const data = doc.data();
                const filename = (data.storageUrl || '').split('/').pop() || data.fileName || '';
                const proxyUrl = `/api/library-files/${encodeURIComponent(filename)}`;
                return { id: doc.id, ...data, proxyUrl, publicUrl: proxyUrl };
            });
            assets.sort((a, b) => {
                const getTime = (val) => {
                    if (!val)
                        return 0;
                    if (typeof val === 'string')
                        return new Date(val).getTime() || 0;
                    if (val.toDate)
                        return val.toDate().getTime();
                    if (val._seconds)
                        return val._seconds * 1000;
                    return 0;
                };
                return getTime(a.createdAt) - getTime(b.createdAt);
            });
            res.json(assets);
        }
        catch (error) {
            console.error('[BackgroundAssets][GET] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/background-assets', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, assetType, imageData, mimeType, sourceAssetId } = req.body;
            if (!name || !assetType || !imageData) {
                res.status(400).json({ error: 'Missing required fields: name, assetType, imageData' });
                return;
            }
            if (assetType !== 'source' && assetType !== 'cropped') {
                res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
                return;
            }
            const buffer = Buffer.from(imageData, 'base64');
            const folderPath = assetType === 'source' ? 'library/backgrounds/raw' : 'library/backgrounds/cropped';
            const safeName = sanitizeAssetFilename(name);
            const timestamp = Date.now();
            const fullPath = `${folderPath}/${timestamp}-${safeName}`;
            const file = core_1.storage.bucket().file(fullPath);
            await file.save(buffer, { metadata: { contentType: mimeType || 'image/png' } });
            const actualFilename = fullPath.split('/').pop() || safeName;
            const proxyUrl = `/api/library-files/${encodeURIComponent(actualFilename)}`;
            const { FieldValue } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
            const docRef = await core_1.db.collection('library_assets').add({
                ownerType: 'admin',
                assetType,
                mediaType: 'image',
                name: safeName.replace(/\.[^/.]+$/, ''),
                fileName: actualFilename,
                originalName: safeName,
                mimeType: mimeType || 'image/png',
                sizeBytes: buffer.length,
                storageUrl: fullPath,
                publicUrl: proxyUrl,
                isActive: true,
                createdAt: FieldValue.serverTimestamp(),
                ...(sourceAssetId ? { sourceAssetId } : {}),
            });
            if (assetType === 'cropped' && sourceAssetId) {
                try {
                    await core_1.db.collection('library_assets').doc(sourceAssetId).update({ assetType: 'background' });
                    console.log(`[BackgroundAssets] Source ${sourceAssetId} moved to background after crop`);
                }
                catch (moveErr) {
                    console.error('[BackgroundAssets] Failed to move source to background:', moveErr.message);
                }
            }
            const doc = await docRef.get();
            res.json({ id: doc.id, ...doc.data(), proxyUrl });
        }
        catch (error) {
            console.error('[BackgroundAssets][POST] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/background-assets/sync', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const folder = 'library/backgrounds/raw';
            const [files] = await core_1.storage.bucket().getFiles({ prefix: folder });
            const existingSnap = await core_1.db.collection('library_assets')
                .where('isActive', '==', true)
                .where('assetType', '==', 'background')
                .get();
            const existingPaths = new Set(existingSnap.docs.map((d) => d.data().storageUrl));
            const { FieldValue } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
            const created = [];
            for (const file of files) {
                if (existingPaths.has(file.name))
                    continue;
                const [meta] = await file.getMetadata();
                const contentType = meta.contentType || '';
                if (!contentType.startsWith('image/'))
                    continue;
                const filename = file.name.split('/').pop() || file.name;
                const proxyUrl = `/api/library-files/${encodeURIComponent(filename)}`;
                const docRef = await core_1.db.collection('library_assets').add({
                    ownerType: 'admin', assetType: 'background', mediaType: 'image',
                    name: filename.replace(/\.[^/.]+$/, ''), fileName: filename,
                    originalName: filename, mimeType: contentType,
                    sizeBytes: Number(meta.size) || 0,
                    storageUrl: file.name, publicUrl: proxyUrl, isActive: true,
                    createdAt: FieldValue.serverTimestamp(),
                });
                created.push({ id: docRef.id, proxyUrl });
            }
            res.json({ scanned: files.length, existing: existingSnap.size, created: created.length });
        }
        catch (error) {
            console.error('[BackgroundAssets][SYNC] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/background-assets/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('library_assets').doc(req.params.id).update({ isActive: false });
            res.json({ success: true });
        }
        catch (error) {
            console.error('[BackgroundAssets][DELETE] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/library/admin', middleware_1.requireAdmin, (_req, res) => {
        res.status(410).json({ error: 'Removed. Use GET /admin/graphics?assetClass=2&channel=3&purpose=3' });
    });
    app.get('/admin/library/templates', middleware_1.requireAdmin, (_req, res) => {
        res.status(410).json({ error: 'Removed. Use GET /admin/templates' });
    });
    app.put('/admin/library/:id', middleware_1.requireAdmin, (_req, res) => {
        res.status(410).json({ error: 'Removed. Use PATCH /admin/graphics/:grfId/archive' });
    });
    app.delete('/admin/library/:id', middleware_1.requireAdmin, (_req, res) => {
        res.status(410).json({ error: 'Removed. Use PATCH /admin/graphics/:grfId/archive' });
    });
    // Admin: Mint a GRF code and save a graphic asset to grf_assets
    app.post('/admin/graphics/save-grf', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { assetClass, mediaType, channel, purpose, format, imageUrl, name, description, mimeType, storagePath, sourceGrfId, relatedPacketId, tags, originalFilename, } = req.body;
            if (!assetClass || !mediaType || !channel || !purpose || !format || !imageUrl) {
                res.status(400).json({ error: 'Missing required fields: assetClass, mediaType, channel, purpose, format, imageUrl' });
                return;
            }
            // Atomically mint the next sequence number from the single global counter
            const counterRef = core_1.db.collection('grf_counters').doc(graphicCodes_1.GRF_COUNTER_KEY);
            let newSeq = 0;
            await core_1.db.runTransaction(async (transaction) => {
                const doc = await transaction.get(counterRef);
                newSeq = (doc.exists ? doc.data().count : 0) + 1;
                transaction.set(counterRef, {
                    count: newSeq,
                    updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            let grfId;
            try {
                grfId = (0, graphicCodes_1.buildGrfId)({
                    assetClass: assetClass,
                    mediaType: mediaType,
                    channel: channel,
                    purpose,
                    format,
                    sequence: newSeq,
                });
            }
            catch (e) {
                res.status(400).json({ error: `Invalid GRF params: ${e.message}` });
                return;
            }
            const parsed = (0, graphicCodes_1.parseGrfId)(grfId);
            const existingAsset = await core_1.db.collection('grf_assets').doc(grfId).get();
            if (existingAsset.exists) {
                console.error(`[GRF] Counter integrity violation — ${grfId} already exists in grf_assets.`);
                res.status(500).json({ error: `GRF counter integrity error: ${grfId} was already assigned. Do not retry — contact admin to inspect grf_counters/${graphicCodes_1.GRF_COUNTER_KEY}.` });
                return;
            }
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const canonicalStoragePath = storagePath || (0, graphicCodes_1.grfStoragePath)(grfId, originalFilename || undefined);
            const assetData = {
                grfId,
                assetClass: parsed.assetClass,
                mediaType: parsed.mediaType,
                channel: parsed.channel,
                purpose: parsed.purpose,
                format: parsed.format,
                sequence: parsed.sequence,
                assetClassName: parsed.assetClassName,
                mediaTypeName: parsed.mediaTypeName,
                channelName: parsed.channelName,
                purposeName: parsed.purposeName,
                formatName: parsed.formatName,
                mimeType: mimeType || parsed.mimeType,
                name: name || `${parsed.purposeName} ${grfId}`,
                description: description || null,
                storagePath: canonicalStoragePath,
                publicUrl: imageUrl,
                sourceGrfId: sourceGrfId || null,
                relatedPacketId: relatedPacketId || null,
                tags: tags || null,
                createdAt: now,
                createdBy: 'admin',
                isActive: true,
            };
            // Preserve original filename for assets-channel originals (D3=4, D4=1)
            if (parsed.channel === '4' && parsed.purpose === '1') {
                assetData.originalFilename = originalFilename || null;
            }
            await core_1.db.collection('grf_assets').doc(grfId).set(assetData);
            const doc = await core_1.db.collection('grf_assets').doc(grfId).get();
            console.log(`[GRF] Minted ${grfId} → grf_assets/${grfId}`);
            res.json({ success: true, grfId, asset: (0, core_1.docToObject)(doc) });
        }
        catch (error) {
            console.error('[GRF] Error saving graphic:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Crop-mint: upload cropped image + mint two GRF IDs (cropped + background)
    app.post('/admin/library/crop-mint', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { croppedImageData, croppedMimeType, originalPublicUrl, originalMimeType, name } = req.body;
            if (!croppedImageData || !croppedMimeType || !originalPublicUrl || !originalMimeType || !name) {
                res.status(400).json({ error: 'Missing required fields: croppedImageData, croppedMimeType, originalPublicUrl, originalMimeType, name' });
                return;
            }
            const { FieldValue } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
            const now = FieldValue.serverTimestamp();
            function mimeToFormatDigit(mimeType) {
                const normalized = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
                for (const [digit, entry] of Object.entries(graphicCodes_1.GRF_FORMATS['1'])) {
                    if (entry.mime === normalized)
                        return digit;
                }
                return '2';
            }
            async function mintSeq() {
                const counterRef = core_1.db.collection('grf_counters').doc(graphicCodes_1.GRF_COUNTER_KEY);
                let seq = 0;
                await core_1.db.runTransaction(async (tx) => {
                    const doc = await tx.get(counterRef);
                    seq = (doc.exists ? doc.data().count : 0) + 1;
                    tx.set(counterRef, { count: seq, updatedAt: FieldValue.serverTimestamp() });
                });
                return seq;
            }
            // ── 1. Mint cropped GRF ID (D4=2) ──────────────────────────────────────
            const croppedSeq = await mintSeq();
            const croppedFormat = mimeToFormatDigit(croppedMimeType);
            const croppedGrfId = (0, graphicCodes_1.buildGrfId)({ assetClass: '1', mediaType: '1', channel: '4', purpose: '2', format: croppedFormat, sequence: croppedSeq });
            const croppedParsed = (0, graphicCodes_1.parseGrfId)(croppedGrfId);
            const croppedExt = croppedMimeType.includes('png') ? 'png' : 'jpg';
            const croppedPath = `grf/${croppedGrfId}/cropped.${croppedExt}`;
            const croppedBuffer = Buffer.from(croppedImageData, 'base64');
            await core_1.storage.bucket().file(croppedPath).save(croppedBuffer, { metadata: { contentType: croppedMimeType } });
            const croppedPublicUrl = `/api/grf-files/${croppedGrfId}/cropped.${croppedExt}`;
            await core_1.db.collection('grf_assets').doc(croppedGrfId).set({
                grfId: croppedGrfId,
                assetClass: croppedParsed.assetClass, mediaType: croppedParsed.mediaType,
                channel: croppedParsed.channel, purpose: croppedParsed.purpose,
                format: croppedParsed.format, sequence: croppedParsed.sequence,
                assetClassName: croppedParsed.assetClassName, mediaTypeName: croppedParsed.mediaTypeName,
                channelName: croppedParsed.channelName, purposeName: croppedParsed.purposeName,
                formatName: croppedParsed.formatName, mimeType: croppedMimeType,
                name: `cropped_${name}`, storagePath: croppedPath, publicUrl: croppedPublicUrl,
                sourceGrfId: null, createdAt: now, createdBy: 'admin', isActive: true,
            });
            // ── 2. Mint background GRF ID (D4=3) ───────────────────────────────────
            const backgroundSeq = await mintSeq();
            const backgroundFormat = mimeToFormatDigit(originalMimeType);
            const backgroundGrfId = (0, graphicCodes_1.buildGrfId)({ assetClass: '1', mediaType: '1', channel: '4', purpose: '3', format: backgroundFormat, sequence: backgroundSeq });
            const backgroundParsed = (0, graphicCodes_1.parseGrfId)(backgroundGrfId);
            await core_1.db.collection('grf_assets').doc(backgroundGrfId).set({
                grfId: backgroundGrfId,
                assetClass: backgroundParsed.assetClass, mediaType: backgroundParsed.mediaType,
                channel: backgroundParsed.channel, purpose: backgroundParsed.purpose,
                format: backgroundParsed.format, sequence: backgroundParsed.sequence,
                assetClassName: backgroundParsed.assetClassName, mediaTypeName: backgroundParsed.mediaTypeName,
                channelName: backgroundParsed.channelName, purposeName: backgroundParsed.purposeName,
                formatName: backgroundParsed.formatName, mimeType: originalMimeType,
                name: `background_${name}`, storagePath: null, publicUrl: originalPublicUrl,
                sourceGrfId: null, createdAt: now, createdBy: 'admin', isActive: true,
            });
            console.log(`[CropMint] Minted ${croppedGrfId} (cropped) + ${backgroundGrfId} (background) for "${name}"`);
            res.json({ success: true, croppedGrfId, backgroundGrfId });
        }
        catch (error) {
            console.error('[CropMint] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Admin: Get GRF assets, optionally filtered by any descriptor digit.
    // Filtered in memory to avoid requiring composite Firestore indexes.
    app.get('/admin/graphics', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { assetClass, mediaType, channel, purpose, format } = req.query;
            const snapshot = await core_1.db.collection('grf_assets').where('isActive', '==', true).get();
            const getTime = (val) => {
                if (!val)
                    return 0;
                if (typeof val === 'string')
                    return new Date(val).getTime() || 0;
                if (val.toDate)
                    return val.toDate().getTime();
                if (val._seconds)
                    return val._seconds * 1000;
                return 0;
            };
            const assets = snapshot.docs
                .map((doc) => (0, core_1.docToObject)(doc))
                .filter((a) => (!assetClass || a.assetClass === assetClass) &&
                (!mediaType || a.mediaType === mediaType) &&
                (!channel || a.channel === channel) &&
                (!purpose || a.purpose === purpose) &&
                (!format || a.format === format))
                .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
            res.json(assets);
        }
        catch (error) {
            console.error('[GRF] Error fetching graphics:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Admin: Archive (soft-delete) a GRF asset
    app.patch('/admin/graphics/:grfId/archive', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { grfId } = req.params;
            const docRef = core_1.db.collection('grf_assets').doc(grfId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: `GRF asset not found: ${grfId}` });
                return;
            }
            await docRef.update({ isActive: false, archivedAt: core_1.admin.firestore.FieldValue.serverTimestamp() });
            console.log(`[GRF] Archived ${grfId}`);
            res.json({ success: true, grfId });
        }
        catch (error) {
            console.error('[GRF] Error archiving graphic:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Admin: Get mockups for a template
    app.get('/admin/templates/:templateId/mockups', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { templateId } = req.params;
            const jobsSnapshot = await core_1.db.collection('mockup_jobs')
                .where('templateId', '==', templateId)
                .get();
            const mockups = jobsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    status: data.status,
                    color: data.color,
                    size: data.size,
                    placement: data.placement,
                    mockupUrl: data.mockupUrl || null,
                    error: data.error || null,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                    completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
                };
            });
            const completed = mockups.filter(m => m.status === 'completed');
            const pending = mockups.filter(m => m.status === 'pending');
            const processing = mockups.filter(m => m.status === 'processing');
            const failed = mockups.filter(m => m.status === 'failed');
            res.json({
                success: true,
                templateId,
                summary: {
                    total: mockups.length,
                    completed: completed.length,
                    pending: pending.length,
                    processing: processing.length,
                    failed: failed.length,
                },
                mockups,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Admin: Full template save with batch mockup generation
    app.post('/admin/templates/full-save', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { colors = [], placements = ['front', 'back'], placementMethods = {}, ...templateFields } = req.body;
            const templateKeys = ['name', 'description', 'category', 'productId', 'blueprintId', 'printProviderId',
                'fulfillmentProvider', 'artworkUrl', 'artworkVariant', 'thumbnailUrl', 'qrContent', 'pricing', 'packetId',
                'graphicLayoutMode', 'qrSizePercent', 'qrPositionX', 'qrPositionY',
                'productName', 'headerText', 'footerText', 'headerStyle', 'footerStyle',
                'subBottomEnabled', 'subBottomText', 'subBottomFontFamily', 'subBottomFontSize', 'subBottomFontWeight', 'subBottomColor',
                'backgroundUrl', 'qrProductState', 'areaImageUrl', 'areaImageMode', 'areaImageOffsetX', 'areaImageOffsetY', 'areaImageScale',
                'placements', 'placementConfig', 'placementSizes', 'placementMethods',
                'defaultColor', 'defaultColorHex', 'landingPageTitle', 'landingPageDescription'];
            const template = {};
            for (const key of templateKeys) {
                if (templateFields[key] !== undefined)
                    template[key] = templateFields[key];
            }
            if (!template.name && !template.productId) {
                res.status(400).json({ error: 'Template data is required' });
                return;
            }
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const templateData = {
                ...template,
                placements,
                placementMethods,
                createdAt: now,
                updatedAt: now,
            };
            const templateRef = await core_1.db.collection('productTemplates').add(templateData);
            const templateId = templateRef.id;
            // Queue mockup generation jobs for each color × placement × qr size combo
            const qrSizes = ['small', 'medium', 'large'];
            let jobsQueued = 0;
            for (const color of colors) {
                for (const placement of placements) {
                    // For front/back, generate all 3 QR sizes; for other placements, only large
                    const sizesToGenerate = (placement === 'front' || placement === 'back') ? qrSizes : ['large'];
                    for (const qrSize of sizesToGenerate) {
                        const jobData = {
                            templateId,
                            colorName: color.name,
                            colorHex: color.hex,
                            placement,
                            qrSize,
                            status: 'pending',
                            createdAt: now,
                            fulfillmentProvider: template.fulfillmentProvider || 'printify',
                        };
                        if (placementMethods[placement]) {
                            jobData.printMethod = placementMethods[placement];
                        }
                        await core_1.db.collection('mockup_jobs').add(jobData);
                        jobsQueued++;
                    }
                }
            }
            console.log(`[Templates] Full save complete: template=${templateId}, ${jobsQueued} mockup jobs queued`);
            // Trigger queue processing in background (fire and forget)
            if (jobsQueued > 0) {
                processQueueInBackground().catch(err => {
                    console.error('[Templates] Background queue processing error:', err.message);
                });
            }
            res.json({
                success: true,
                templateId,
                jobsQueued,
                message: `Template saved with ${jobsQueued} mockup jobs queued`,
            });
        }
        catch (error) {
            console.error('[Templates] Error in full save:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ ADMIN IMAGE LIBRARY (with folders) ============
    app.get('/admin/images', middleware_1.requireAdmin, async (req, res) => {
        try {
            const folder = req.query.folder || '';
            console.log('[AdminImages] GET request - folder filter:', folder || '(all)');
            const snap = await core_1.db.collection('admin_images').get();
            console.log('[AdminImages] Raw docs:', snap.size);
            const bucketName = core_1.storage.bucket().name;
            const images = snap.docs
                .map(doc => {
                const data = doc.data();
                // Use direct GCS public URL so subdirectory paths (library/images/{folder}/) resolve correctly.
                // Files are made public on upload, so the GCS URL always works.
                const gcsUrl = data.storageUrl
                    ? `https://storage.googleapis.com/${bucketName}/${data.storageUrl}`
                    : (data.publicUrl || '');
                return {
                    id: doc.id,
                    ...data,
                    proxyUrl: `/api/admin/images/${doc.id}/file`,
                    publicUrl: gcsUrl,
                };
            })
                .filter((img) => img.isActive !== false)
                .filter((img) => !folder || img.folder === folder)
                .sort((a, b) => {
                const getTime = (val) => {
                    if (!val)
                        return 0;
                    if (val._seconds)
                        return val._seconds * 1000;
                    if (val.toDate)
                        return val.toDate().getTime();
                    if (typeof val === 'string')
                        return new Date(val).getTime() || 0;
                    return 0;
                };
                return getTime(b.createdAt) - getTime(a.createdAt);
            });
            console.log('[AdminImages] Filtered images:', images.length);
            res.json(images);
        }
        catch (error) {
            console.error('[AdminImages] List error:', error.message, error.stack);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/images/folders', middleware_1.requireAdmin, async (req, res) => {
        try {
            const [imgSnap, folderSnap] = await Promise.all([
                core_1.db.collection('admin_images').get(),
                core_1.db.collection('admin_image_folders').get(),
            ]);
            const folderSet = new Set();
            folderSnap.docs.forEach(doc => {
                const name = doc.data().name;
                if (name)
                    folderSet.add(name);
            });
            imgSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.isActive === false)
                    return;
                const f = data.folder;
                if (f)
                    folderSet.add(f);
            });
            const folders = Array.from(folderSet).sort();
            res.json(folders);
        }
        catch (error) {
            console.error('[AdminImages] Folders error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/images/folders', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name } = req.body;
            if (!name || typeof name !== 'string' || !name.trim()) {
                res.status(400).json({ error: 'Folder name is required' });
                return;
            }
            const trimmed = name.trim().replace(/\s{2,}/g, ' ');
            if (trimmed.length > 80) {
                res.status(400).json({ error: 'Folder name must be 80 characters or less' });
                return;
            }
            const normalizedName = trimmed.toLowerCase();
            const allFolders = await core_1.db.collection('admin_image_folders').get();
            const match = allFolders.docs.find(doc => (doc.data().name || '').trim().toLowerCase() === normalizedName);
            if (match) {
                const existingName = match.data().name;
                res.json({ ok: true, folder: existingName, created: false });
                return;
            }
            await core_1.db.collection('admin_image_folders').add({ name: trimmed, normalizedName, createdAt: new Date().toISOString() });
            console.log('[AdminImages] Folder created:', trimmed);
            res.json({ ok: true, folder: trimmed, created: true });
        }
        catch (error) {
            console.error('[AdminImages] Create folder error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/images', middleware_1.requireAdmin, async (req, res) => {
        try {
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=(.+)/);
            if (!boundaryMatch) {
                res.status(400).json({ error: 'Expected multipart/form-data' });
                return;
            }
            const boundary = boundaryMatch[1];
            const rawBody = req.rawBody || Buffer.from(req.body || '');
            if (!rawBody || rawBody.length === 0) {
                res.status(400).json({ error: 'No request body' });
                return;
            }
            const boundaryBuffer = Buffer.from(`--${boundary}`);
            const parts = [];
            let start = 0;
            while (true) {
                const idx = rawBody.indexOf(boundaryBuffer, start);
                if (idx === -1)
                    break;
                if (start > 0)
                    parts.push(rawBody.slice(start, idx - 2));
                start = idx + boundaryBuffer.length + 2;
            }
            let fileBuffer = null;
            let fileMimeType = 'image/png';
            let fieldName = '';
            let fieldFolder = 'general';
            for (const part of parts) {
                const headerEnd = part.indexOf('\r\n\r\n');
                if (headerEnd === -1)
                    continue;
                const hdrs = part.slice(0, headerEnd).toString();
                const body = part.slice(headerEnd + 4);
                const filenameMatch = hdrs.match(/filename="([^"]+)"/);
                const ctMatch = hdrs.match(/Content-Type:\s*([^\r\n]+)/i);
                const nameMatch = hdrs.match(/name="([^"]+)"/);
                if (filenameMatch) {
                    fileBuffer = body;
                    if (ctMatch)
                        fileMimeType = ctMatch[1].trim();
                }
                else if (nameMatch) {
                    const val = body.toString().trim();
                    if (nameMatch[1] === 'name')
                        fieldName = val;
                    if (nameMatch[1] === 'folder')
                        fieldFolder = val;
                }
            }
            if (!fileBuffer || fileBuffer.length === 0) {
                res.status(400).json({ error: 'No file in upload' });
                return;
            }
            const name = fieldName || `image-${Date.now()}`;
            const folder = fieldFolder || 'general';
            const bucket = core_1.storage.bucket();
            const ext = fileMimeType.split('/')[1] || 'png';
            const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fullPath = `library/images/${folder}/${Date.now()}-${safeName}.${ext}`;
            console.log(`[AdminImages] Upload native file: ${name} -> ${fullPath} (${fileBuffer.length} bytes)`);
            const file = bucket.file(fullPath);
            await file.save(fileBuffer, { metadata: { contentType: fileMimeType } });
            await file.makePublic();
            // Use direct GCS public URL — the proxy alias only matches the filename, not the folder subdirectory.
            const publicGcsUrl = `https://storage.googleapis.com/${bucket.name}/${fullPath}`;
            const docRef = await core_1.db.collection('admin_images').add({
                name, folder, mimeType: fileMimeType, sizeBytes: fileBuffer.length,
                storageUrl: fullPath, publicUrl: publicGcsUrl, isActive: true,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json({ id: doc.id, ...doc.data(), proxyUrl: `/api/admin/images/${docRef.id}/file`, publicUrl: publicGcsUrl });
        }
        catch (error) {
            console.error('[AdminImages] Native upload error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/images/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { folder, name } = req.body;
            const updates = { updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp() };
            if (folder !== undefined)
                updates.folder = folder;
            if (name !== undefined)
                updates.name = name;
            await core_1.db.collection('admin_images').doc(req.params.id).update(updates);
            res.json({ success: true });
        }
        catch (error) {
            console.error('[AdminImages] Update error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ── Serve admin image by Firestore doc ID (stable, auth-bypassing proxy) ──
    app.get('/admin/images/:id/file', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const doc = await core_1.db.collection('admin_images').doc(id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Image not found' });
                return;
            }
            const data = doc.data();
            if (data.isActive === false) {
                res.status(404).json({ error: 'Image not active' });
                return;
            }
            const storageUrl = data.storageUrl;
            if (!storageUrl) {
                res.status(404).json({ error: 'No storage path on record' });
                return;
            }
            const file = core_1.storage.bucket().file(storageUrl);
            const [exists] = await file.exists();
            if (!exists) {
                res.status(404).json({ error: 'File not found in storage' });
                return;
            }
            const contentType = data.mimeType || 'image/png';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            res.set('Access-Control-Allow-Origin', '*');
            file.createReadStream().pipe(res);
        }
        catch (error) {
            console.error('[AdminImages] File serve error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/images/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('admin_images').doc(req.params.id).update({
                isActive: false,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            res.json({ success: true });
        }
        catch (error) {
            console.error('[AdminImages] Delete error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=file-routes.js.map