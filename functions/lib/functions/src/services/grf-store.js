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
exports.LibraryImageError = void 0;
exports.createGrfRegistrar = createGrfRegistrar;
const image_validation_1 = require("./image-validation");
const crypto_1 = require("crypto");
const bldCodes_1 = require("../../../shared/bldCodes");
const GRF_engine_1 = require("../../../shared/GRF_engine");
var image_validation_2 = require("./image-validation");
Object.defineProperty(exports, "LibraryImageError", { enumerable: true, get: function () { return image_validation_2.LibraryImageError; } });
function createGrfRegistrar({ db, now, bucket }) {
    const GRF_ASSETS_COLLECTION = 'grf_assets';
    const GRF_COUNTERS_COLLECTION = 'grf_counters';
    // ── Options ───────────────────────────────────────────────────────────────────
    // ── Core mint ─────────────────────────────────────────────────────────────────
    /**
     * Register a GRF asset. Mints a new canonical GRF ID and writes to grf_assets.
     *
     * @throws if neither sourceUrl nor imageData is provided
     * @throws if GRF params are invalid
     */
    async function registerGrfAsset(opts) {
        const { assetClass, mediaType, channel, purpose, format, sourceUrl, imageData, mimeType, name, description, originalFilename, storagePath: storagePathOverride, sourceGrfId, relatedPacketId, tags, createdBy = 'admin', sourceSessionId, packetId, } = opts;
        if (!sourceUrl && !imageData) {
            throw new Error('[GRFRegistrar] Either sourceUrl or imageData is required');
        }
        if (!!sourceUrl === !!imageData)
            throw new Error('Provide exactly one GRF source.');
        // Transactionally reserve the permanent ID before uploading. A failed upload retries
        // the same reservation; concurrent registrations of the same file share one identity.
        const hash = imageData ? (0, crypto_1.createHash)('sha256').update(Buffer.from(imageData, 'base64')).digest('hex') : null;
        const query = db.collection(GRF_ASSETS_COLLECTION).where(hash ? 'contentHash' : 'sourceUrl', '==', hash || sourceUrl);
        const reservation = await db.runTransaction(async (tx) => {
            const matches = await tx.get(query);
            const existing = matches.docs.find(d => {
                const data = d.data();
                if (!(0, GRF_engine_1.isValidGrfId)(data.grfId))
                    return false;
                const p = (0, GRF_engine_1.parseGrfId)(data.grfId);
                return p.assetClass === assetClass && p.mediaType === mediaType && p.channel === channel &&
                    p.purpose === purpose && p.format === format &&
                    (!sourceGrfId || data.sourceGrfId === sourceGrfId);
            });
            if (existing) {
                const data = existing.data();
                if (data.isActive === false)
                    throw new Error('This GRF file is archived. Restore it before reuse.');
                return data;
            }
            const counterRef = db.collection(GRF_COUNTERS_COLLECTION).doc(GRF_engine_1.GRF_COUNTER_KEY);
            const count = (await tx.get(counterRef)).data()?.count ?? 0;
            if (!Number.isInteger(count) || count < 0 || count >= 999999)
                throw new Error('Invalid or exhausted GRF counter.');
            const sequence = count + 1;
            const grfId = (0, GRF_engine_1.buildGrfId)({ assetClass, mediaType, channel, purpose, format, sequence });
            const ref = db.collection(GRF_ASSETS_COLLECTION).doc(grfId);
            if ((await tx.get(ref)).exists)
                throw new Error('GRF counter points to an existing asset.');
            const data = { grfId, sequence, sourceUrl: sourceUrl || null, contentHash: hash,
                sourceGrfId: sourceGrfId || null, originalFilename: originalFilename || null,
                registrationState: 'pending', isActive: true, createdAt: now() };
            tx.set(counterRef, { count: sequence, updatedAt: now() }, { merge: true });
            tx.create(ref, data);
            return data;
        });
        const { grfId, sequence } = reservation;
        if (reservation.publicUrl && reservation.registrationState !== 'pending')
            return {
                grfId, sequence, publicUrl: reservation.publicUrl, storagePath: reservation.storagePath || null,
            };
        const parsed = (0, GRF_engine_1.parseGrfId)(grfId);
        const timestamp = now();
        // ── imageData mode: upload to Storage ────────────────────────────────────
        let publicUrl;
        let storagePath;
        if (imageData) {
            const ext = (mimeType || '').includes('png') ? 'png' : 'jpg';
            const canonicalPath = storagePathOverride
                || (0, GRF_engine_1.grfStoragePath)(grfId, reservation.originalFilename || originalFilename || undefined)
                || `grf/${grfId}/original.${ext}`;
            const storageBucket = bucket();
            const buffer = Buffer.from(imageData, 'base64');
            const fileRef = storageBucket.file(canonicalPath);
            await fileRef.save(buffer, { metadata: { contentType: mimeType || 'image/jpeg' } });
            await fileRef.makePublic();
            const encoded = canonicalPath.split('/').map(encodeURIComponent).join('/');
            publicUrl = `https://storage.googleapis.com/${storageBucket.name}/${encoded}`;
            storagePath = canonicalPath;
            console.log(`[GRFRegistrar] uploaded base64 → ${publicUrl}`);
        }
        else {
            publicUrl = sourceUrl;
            storagePath = null;
        }
        // ── Write grf_assets ─────────────────────────────────────────────────────
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
            storagePath,
            publicUrl,
            sourceUrl: publicUrl, // keep both field names populated
            sourceGrfId: sourceGrfId || null,
            relatedPacketId: relatedPacketId || null,
            tags: tags || null,
            sourceSessionId: sourceSessionId || null,
            packetId: packetId || null,
            contentHash: hash, registrationState: 'ready',
            source: 'grf_registrar',
            createdBy,
            isActive: true,
            createdAt: timestamp,
        };
        if (parsed.channel === '4' && parsed.purpose === '1') {
            assetData.originalFilename = originalFilename || null;
        }
        await db.collection(GRF_ASSETS_COLLECTION).doc(grfId).set(assetData);
        console.log(`[GRFRegistrar] minted ${grfId} (${parsed.channelName}/${parsed.purposeName}) → ${publicUrl.slice(0, 80)}…`);
        return { grfId, publicUrl, storagePath, sequence };
    }
    // ── Packet registration (multi-slot) ─────────────────────────────────────────
    /**
     * Register all graphic assets from a packet at commit time.
     * Skips external QR URLs (api.qrserver.com) and data URLs.
     */
    async function registerPacketGrfAssets(packetData, sourceSessionId, packetId) {
        const result = {
            backgroundGrfId: null,
            qrGrfId: null,
            compositeGrfId: null,
            landingSnapshotGrfId: null,
            glamorShotGrfId: null,
            storeFrontGrfId: null,
        };
        const isStorageUrl = (url) => typeof url === 'string' && /^https:\/\//.test(url) && !url.includes('api.qrserver.com');
        for (const layer of (0, bldCodes_1.extractBuilderLayers)(packetData.builderSnapshot || {})) {
            if (!layer.imageUrl || !layer.assetKey)
                continue;
            const r = await registerGrfAsset({ sourceUrl: layer.imageUrl, mimeType: 'image/png', sourceSessionId, packetId, ...GRF_engine_1.GRF_PACKET_SLOTS.background });
            result[layer.assetKey] = r.grfId;
        }
        // Persist a real QR file for the exact payload used by the composite renderer.
        if (!packetData.qrContent?.trim())
            throw new Error('Generated packet has no QR payload.');
        const QRCode = await Promise.resolve().then(() => __importStar(require('qrcode')));
        const qrBytes = await QRCode.toBuffer(packetData.qrContent.trim(), { type: 'png', width: 3000, margin: 2, errorCorrectionLevel: 'M' });
        const qr = await registerGrfAsset({ imageData: qrBytes.toString('base64'), mimeType: 'image/png', sourceSessionId, packetId, ...GRF_engine_1.GRF_PACKET_SLOTS.qrStandalone });
        result.qrGrfId = qr.grfId;
        if (packetId)
            await db.collection('productPackets').doc(packetId).update({ qrOnlyUrl: qr.publicUrl });
        const compositeUrl = packetData.compositeUrl || packetData.productGraphicUrl || null;
        if (isStorageUrl(compositeUrl)) {
            const r = await registerGrfAsset({
                sourceUrl: compositeUrl, mimeType: 'image/png', sourceSessionId, packetId,
                ...GRF_engine_1.GRF_PACKET_SLOTS.qrComposite,
            });
            result.compositeGrfId = r.grfId;
        }
        const snapshotUrl = packetData.landingPageSnapshotUrl || null;
        if (isStorageUrl(snapshotUrl)) {
            const r = await registerGrfAsset({
                sourceUrl: snapshotUrl, mimeType: 'image/png', sourceSessionId, packetId,
                ...GRF_engine_1.GRF_PACKET_SLOTS.urlSnapshot,
            });
            result.landingSnapshotGrfId = r.grfId;
        }
        const placementGrfIds = {};
        for (const [placement, url] of Object.entries(packetData.placementGraphicUrls || {})) {
            if (!isStorageUrl(url))
                throw new Error(`Missing stored graphic for ${placement}.`);
            const asset = await registerGrfAsset({ sourceUrl: url, mimeType: 'image/png', sourceSessionId, packetId, ...GRF_engine_1.GRF_PACKET_SLOTS.qrComposite });
            placementGrfIds[placement] = asset.grfId;
        }
        if (packetId)
            await db.collection('productPackets').doc(packetId).update({ placementGrfIds });
        if (!result.compositeGrfId)
            throw new Error('Generate a composite file before committing.');
        if (packetId)
            await db.collection('productPackets').doc(packetId).update({ ...result });
        return result;
    }
    // ── Mockup registration (post-commit) ─────────────────────────────────────────
    /** Maps canonical placement names to their GRF slot. Unrecognised placements are logged only. */
    const PLACEMENT_TO_GRF_SLOT = {
        front: 'storeFront',
        front_large: 'storeFront',
        front_small: 'storeFront',
        back: 'storeBack',
    };
    /**
     * Register lifestyle and placement mockup URLs as GRF assets.
     * Called from the packet PATCH route when mockup URLs arrive (after commit).
     */
    async function registerMockupGrfAssets(packetId, lifestyleMockupUrl, placementMockupUrls) {
        const result = { glamorShotGrfId: null, storeFrontGrfId: null, storeBackGrfId: null };
        const isMockupUrl = (url) => !!url && typeof url === 'string' && url.trim() !== '' && !url.startsWith('data:');
        if (isMockupUrl(lifestyleMockupUrl)) {
            const r = await registerGrfAsset({
                sourceUrl: lifestyleMockupUrl, mimeType: 'image/jpeg', packetId,
                ...GRF_engine_1.GRF_PACKET_SLOTS.glamorShot,
            });
            result.glamorShotGrfId = r.grfId;
        }
        for (const [placement, url] of Object.entries(placementMockupUrls || {})) {
            if (!isMockupUrl(url))
                continue;
            const slotKey = PLACEMENT_TO_GRF_SLOT[placement.toLowerCase()];
            if (!slotKey) {
                console.log(`[GRFRegistrar] No GRF slot for placement "${placement}" — skipping registration`);
                continue;
            }
            const r = await registerGrfAsset({
                sourceUrl: url, mimeType: 'image/jpeg', packetId,
                ...GRF_engine_1.GRF_PACKET_SLOTS[slotKey],
            });
            if (slotKey === 'storeFront')
                result.storeFrontGrfId = r.grfId;
            if (slotKey === 'storeBack')
                result.storeBackGrfId = r.grfId;
        }
        return result;
    }
    async function registerSourceImage(input) {
        const { imageData, mimeType } = (0, image_validation_1.decodeLibraryImage)(input.imageUrl, input.mimeType);
        const originalFilename = String(input.originalFilename || input.name || 'image').split(/[\\/]/).pop();
        const result = await registerGrfAsset({ ...(0, GRF_engine_1.originalGrfParams)(mimeType), imageData, mimeType, originalFilename, name: originalFilename });
        const asset = (await db.collection(GRF_ASSETS_COLLECTION).doc(result.grfId).get()).data();
        return { success: true, grfId: result.grfId, asset };
    }
    async function registerSourceCrop(input) {
        const { imageData, mimeType } = (0, image_validation_1.decodeLibraryImage)(input.croppedImageData, input.croppedMimeType);
        if (!(0, GRF_engine_1.isValidGrfId)(input.sourceGrfId))
            throw new image_validation_1.LibraryImageError('Invalid source GRF ID');
        const source = (await db.collection(GRF_ASSETS_COLLECTION).doc(input.sourceGrfId).get()).data();
        if (!source || source.isActive === false)
            throw new image_validation_1.LibraryImageError('Source image is missing or archived');
        const sourceType = (0, GRF_engine_1.parseGrfId)(input.sourceGrfId);
        if (sourceType.channel !== '4' || !['1', '3'].includes(sourceType.purpose))
            throw new image_validation_1.LibraryImageError('Choose an original or background image to crop');
        const originalId = sourceType.purpose === '1' ? input.sourceGrfId : source.sourceGrfId;
        if (!(0, GRF_engine_1.isValidGrfId)(originalId))
            throw new image_validation_1.LibraryImageError('Background has no valid original image');
        const original = originalId === input.sourceGrfId ? source : (await db.collection(GRF_ASSETS_COLLECTION).doc(originalId).get()).data();
        const originalType = (0, GRF_engine_1.parseGrfId)(originalId);
        if (!original || original.isActive === false || originalType.channel !== '4' || originalType.purpose !== '1' || !original.publicUrl) {
            throw new image_validation_1.LibraryImageError('Original image is missing or archived');
        }
        // Each distinct crop gets an immutable file/ID. Identical retries reuse that file.
        const cropped = await registerGrfAsset({ ...(0, GRF_engine_1.croppedGrfParams)(mimeType), imageData, mimeType, sourceGrfId: originalId });
        const background = await registerGrfAsset({ ...(0, GRF_engine_1.backgroundGrfParams)(originalType.mimeType), sourceUrl: original.publicUrl,
            mimeType: originalType.mimeType, sourceGrfId: originalId, originalFilename: original.originalFilename });
        return { success: true, croppedGrfId: cropped.grfId, backgroundGrfId: background.grfId, croppedPublicUrl: cropped.publicUrl };
    }
    return { registerGrfAsset, registerPacketGrfAssets, registerMockupGrfAssets, registerSourceImage, registerSourceCrop };
}
//# sourceMappingURL=grf-store.js.map