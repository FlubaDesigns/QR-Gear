"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSignedUrl = generateSignedUrl;
exports.addSignedUrlsToAssets = addSignedUrlsToAssets;
exports.downloadAndStoreImage = downloadAndStoreImage;
const core_1 = require("../core");
// ============ SIGNED URL HELPER ============
async function generateSignedUrl(storagePath, expiresInMinutes = 15) {
    if (!storagePath)
        return null;
    try {
        // Remove leading slash if present
        const cleanPath = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;
        const bucket = core_1.storage.bucket();
        const file = bucket.file(cleanPath);
        const [exists] = await file.exists();
        if (!exists) {
            console.warn(`[SignedURL] File not found: ${cleanPath}`);
            return null;
        }
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + expiresInMinutes * 60 * 1000,
        });
        return signedUrl;
    }
    catch (error) {
        console.error(`[SignedURL] Error generating signed URL for ${storagePath}:`, error.message);
        return null;
    }
}
async function addSignedUrlsToAssets(assets) {
    return Promise.all(assets.map(async (asset) => {
        const signedUrl = asset.storageUrl ? await generateSignedUrl(asset.storageUrl) : null;
        const thumbnailSignedUrl = asset.thumbnailUrl ? await generateSignedUrl(asset.thumbnailUrl) : null;
        return {
            ...asset,
            signedUrl,
            thumbnailSignedUrl,
        };
    }));
}
// ============ FIREBASE STORAGE UPLOAD ============
async function downloadAndStoreImage(imageUrl, storagePath) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok)
            throw new Error(`Failed to download: ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const bucket = core_1.storage.bucket();
        const file = bucket.file(storagePath);
        await file.save(buffer, {
            metadata: { contentType: 'image/jpeg' },
            public: true,
        });
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        console.log(`[Storage] Uploaded to: ${publicUrl}`);
        return publicUrl;
    }
    catch (error) {
        console.error('[Storage] Upload failed:', error.message);
        return null;
    }
}
//# sourceMappingURL=storage-helpers.js.map