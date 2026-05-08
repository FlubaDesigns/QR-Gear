"use strict";
/**
 * functions/src/services/grf-registrar.ts
 *
 * GRF asset registration — single authoritative mint engine for production.
 * ALL GRF minting goes through this file. Routes must NOT inline counter
 * transactions, buildGrfId calls, or grf_assets writes.
 *
 * Two source modes:
 *   imageData  — raw base64 (no data: prefix); registrar uploads to Storage,
 *                builds canonical path from the minted GRF ID, writes Firestore.
 *   sourceUrl  — asset already in Storage; registrar dedup-checks by URL,
 *                mints only if not found, writes Firestore.
 *
 * Required order for imageData mode:
 *   1. Call registerGrfAsset({ imageData, ... }) → get { grfId, publicUrl }
 *   2. Use grfId downstream (Assembly mappings, etc.)
 *
 * Required order for sourceUrl mode:
 *   1. Upload asset to Firebase Storage → get URL
 *   2. Call registerGrfAsset({ sourceUrl, ... }) → get { grfId }
 *   3. Use grfId downstream
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGrfAsset = registerGrfAsset;
exports.registerPacketGrfAssets = registerPacketGrfAssets;
const core_1 = require("../core");
const GRF_engine_1 = require("../../../shared/GRF_engine");
const GRF_ASSETS_COLLECTION = 'grf_assets';
const GRF_COUNTERS_COLLECTION = 'grf_counters';
// ── Core mint ─────────────────────────────────────────────────────────────────
async function allocateSequence() {
    const counterRef = core_1.db.collection(GRF_COUNTERS_COLLECTION).doc(GRF_engine_1.GRF_COUNTER_KEY);
    let sequence = 0;
    await core_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        if (!snap.exists) {
            sequence = 1;
            tx.set(counterRef, { count: 1, createdAt: core_1.admin.firestore.FieldValue.serverTimestamp() });
        }
        else {
            sequence = (snap.data().count || 0) + 1;
            tx.update(counterRef, {
                count: sequence,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
    return sequence;
}
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
    // ── sourceUrl mode: dedup by URL ─────────────────────────────────────────
    if (sourceUrl && !imageData) {
        if (sourceUrl.trim() === '') {
            throw new Error('[GRFRegistrar] sourceUrl must not be empty');
        }
        const existing = await core_1.db.collection(GRF_ASSETS_COLLECTION)
            .where('sourceUrl', '==', sourceUrl)
            .limit(1)
            .get();
        if (!existing.empty) {
            const doc = existing.docs[0];
            const data = doc.data();
            const existingId = data.grfId;
            if (packetId || sourceSessionId) {
                await doc.ref.update({
                    ...(packetId ? { packetId } : {}),
                    ...(sourceSessionId ? { sourceSessionId } : {}),
                    updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            console.log(`[GRFRegistrar] reused grfId=${existingId} for url=${sourceUrl.slice(0, 80)}…`);
            return {
                grfId: existingId,
                publicUrl: data.publicUrl || sourceUrl,
                storagePath: data.storagePath || null,
                sequence: data.sequence || 0,
            };
        }
    }
    // ── Allocate sequence + build GRF ID ─────────────────────────────────────
    const sequence = await allocateSequence();
    const grfId = (0, GRF_engine_1.buildGrfId)({ assetClass, mediaType, channel, purpose, format, sequence });
    const parsed = (0, GRF_engine_1.parseGrfId)(grfId);
    const now = core_1.admin.firestore.FieldValue.serverTimestamp();
    // ── imageData mode: upload to Storage ────────────────────────────────────
    let publicUrl;
    let storagePath;
    if (imageData) {
        const ext = (mimeType || '').includes('png') ? 'png' : 'jpg';
        const canonicalPath = storagePathOverride
            || (0, GRF_engine_1.grfStoragePath)(grfId)
            || `grf/${grfId}/original.${ext}`;
        const bucket = core_1.admin.storage().bucket();
        const buffer = Buffer.from(imageData, 'base64');
        const fileRef = bucket.file(canonicalPath);
        await fileRef.save(buffer, { metadata: { contentType: mimeType || 'image/jpeg' } });
        await fileRef.makePublic();
        const encoded = canonicalPath.split('/').map(encodeURIComponent).join('/');
        publicUrl = `https://storage.googleapis.com/${bucket.name}/${encoded}`;
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
        source: 'grf_registrar',
        createdBy,
        isActive: true,
        createdAt: now,
    };
    if (parsed.channel === '4' && parsed.purpose === '1') {
        assetData.originalFilename = originalFilename || null;
    }
    await core_1.db.collection(GRF_ASSETS_COLLECTION).doc(grfId).set(assetData);
    console.log(`[GRFRegistrar] minted ${grfId} (${parsed.channelName}/${parsed.purposeName}) → ${publicUrl.slice(0, 80)}…`);
    return { grfId, publicUrl, storagePath, sequence };
}
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
    };
    const isStorageUrl = (url) => {
        if (!url || typeof url !== 'string' || url.trim() === '')
            return false;
        if (url.startsWith('data:'))
            return false;
        if (url.includes('api.qrserver.com'))
            return false;
        return true;
    };
    const bgUrl = packetData.backgroundUrl || packetData.landingPageBackgroundUrl || null;
    if (isStorageUrl(bgUrl)) {
        const r = await registerGrfAsset({
            sourceUrl: bgUrl, mimeType: 'image/png', sourceSessionId, packetId,
            ...GRF_engine_1.GRF_PACKET_SLOTS.background,
        });
        result.backgroundGrfId = r.grfId;
    }
    const qrUrl = packetData.qrOnlyUrl || null;
    if (isStorageUrl(qrUrl)) {
        const r = await registerGrfAsset({
            sourceUrl: qrUrl, mimeType: 'image/png', sourceSessionId, packetId,
            ...GRF_engine_1.GRF_PACKET_SLOTS.qrStandalone,
        });
        result.qrGrfId = r.grfId;
    }
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
    return result;
}
//# sourceMappingURL=grf-registrar.js.map