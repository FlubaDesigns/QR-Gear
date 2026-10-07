"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminImageLibrary = createAdminImageLibrary;
const crypto_1 = require("crypto");
const imageLibrary_1 = require("../../../shared/imageLibrary");
const image_validation_1 = require("./image-validation");
function createAdminImageLibrary({ db, bucket, now }) {
    const images = () => db.collection('admin_images');
    const folders = () => db.collection('admin_image_folders');
    const mapImage = (doc) => {
        const data = doc.data();
        return { ...data, id: doc.id, proxyUrl: `/api/admin/images/${encodeURIComponent(doc.id)}/file`,
            publicUrl: data.storageUrl ? (0, imageLibrary_1.publicImageUrl)(bucket().name, data.storageUrl) : data.publicUrl || '' };
    };
    async function list(folder) {
        const snapshot = await images().get();
        const getTime = (value) => value?.toMillis?.() ?? (value?._seconds ? value._seconds * 1000 : Date.parse(value) || 0);
        return snapshot.docs.map((doc) => ({ image: mapImage(doc), time: getTime(doc.data().createdAt) }))
            .filter(({ image }) => image.isActive !== false && (!folder || image.folder === folder))
            .sort((a, b) => b.time - a.time).map(({ image }) => image);
    }
    async function listFolders() {
        const [imageDocs, folderDocs] = await Promise.all([images().get(), folders().get()]);
        return Array.from(new Set([
            ...folderDocs.docs.map((doc) => doc.data().name),
            ...imageDocs.docs.filter((doc) => doc.data().isActive !== false).map((doc) => doc.data().folder),
        ].filter(Boolean))).sort();
    }
    async function createFolder(rawName) {
        const name = (0, imageLibrary_1.normalizeImageFolder)(rawName);
        const normalized = name.toLowerCase();
        const id = (0, crypto_1.createHash)('sha256').update(normalized).digest('hex');
        return db.runTransaction(async (tx) => {
            // Include existing image folders so older uploads keep their canonical spelling.
            const [savedFolders, savedImages] = await Promise.all([tx.get(folders()), tx.get(images())]);
            const names = [...savedFolders.docs.map((doc) => doc.data().name),
                ...savedImages.docs.filter((doc) => doc.data().isActive !== false).map((doc) => doc.data().folder)].filter(Boolean);
            const existing = names.find(value => (0, imageLibrary_1.normalizeImageFolder)(value).toLowerCase() === normalized);
            if (existing) {
                if (!savedFolders.docs.some((doc) => doc.data().name === existing))
                    tx.set(folders().doc(id), { name: existing, normalizedName: normalized, createdAt: now() });
                return { folder: existing, created: false };
            }
            tx.set(folders().doc(id), { name, normalizedName: normalized, createdAt: now() });
            return { folder: name, created: true };
        });
    }
    async function upload(input) {
        const mimeType = (0, imageLibrary_1.validateImageUpload)(input.mimeType, input.bytes.length);
        (0, image_validation_1.validateImageBytes)(input.bytes, mimeType);
        const { folder } = await createFolder(input.folder || 'general');
        const name = input.name.trim() || 'image';
        const stem = name.replace(/\.(png|jpe?g|webp|svg)$/i, '').replace(/[^a-zA-Z0-9.-]/g, '_') || 'image';
        const path = `library/images/${folder.replace(/[\\/]/g, '_')}/${(0, crypto_1.randomUUID)()}-${stem}.${(0, imageLibrary_1.imageExtension)(mimeType)}`;
        const file = bucket().file(path);
        await file.save(input.bytes, { metadata: { contentType: mimeType } });
        await file.makePublic();
        const ref = images().doc();
        await ref.set({ name, folder, mimeType, sizeBytes: input.bytes.length, storageUrl: path,
            publicUrl: (0, imageLibrary_1.publicImageUrl)(bucket().name, path), isActive: true, createdAt: now() });
        return mapImage(await ref.get());
    }
    async function archive(id) {
        await images().doc(id).update({ isActive: false, updatedAt: now() });
    }
    async function update(id, input) {
        const changes = { updatedAt: now() };
        if (input.folder !== undefined)
            changes.folder = (await createFolder(input.folder)).folder;
        if (input.name !== undefined) {
            const name = input.name.trim();
            if (!name)
                throw new imageLibrary_1.ImageLibraryError('Image name is required');
            changes.name = name;
        }
        await images().doc(id).update(changes);
    }
    async function getFile(id) {
        const doc = await images().doc(id).get();
        if (!doc.exists || !doc.data().storageUrl)
            return null;
        // Archiving hides picker entries; already-used files remain available.
        return { file: bucket().file(doc.data().storageUrl), mimeType: doc.data().mimeType };
    }
    return { list, listFolders, createFolder, upload, archive, update, getFile };
}
//# sourceMappingURL=admin-image-library.js.map