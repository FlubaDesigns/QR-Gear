import { createHash, randomUUID } from 'crypto';
import { ImageLibraryError, imageExtension, normalizeImageFolder, publicImageUrl, validateImageUpload, type AdminImage } from '../../../shared/imageLibrary';
import { validateImageBytes } from './image-validation';

export function createAdminImageLibrary({ db, bucket, now }: { db: any; bucket: () => any; now: () => any }) {
  const images = () => db.collection('admin_images');
  const folders = () => db.collection('admin_image_folders');
  const mapImage = (doc: any): AdminImage => {
    const data = doc.data();
    return { ...data, id: doc.id, proxyUrl: `/api/admin/images/${encodeURIComponent(doc.id)}/file`,
      publicUrl: data.storageUrl ? publicImageUrl(bucket().name, data.storageUrl) : data.publicUrl || '' };
  };
  async function list(folder?: string) {
    const snapshot = await images().get();
    const getTime = (value: any): number => value?.toMillis?.() ?? (value?._seconds ? value._seconds * 1000 : Date.parse(value) || 0);
    return snapshot.docs.map((doc: any) => ({ image: mapImage(doc), time: getTime(doc.data().createdAt) }))
      .filter(({ image }: { image: AdminImage }) => image.isActive !== false && (!folder || image.folder === folder))
      .sort((a: any, b: any) => b.time - a.time).map(({ image }: { image: AdminImage }) => image);
  }
  async function listFolders(): Promise<string[]> {
    const [imageDocs, folderDocs] = await Promise.all([images().get(), folders().get()]);
    return Array.from(new Set<string>([
      ...folderDocs.docs.map((doc: any) => doc.data().name),
      ...imageDocs.docs.filter((doc: any) => doc.data().isActive !== false).map((doc: any) => doc.data().folder),
    ].filter(Boolean))).sort();
  }
  async function createFolder(rawName: string): Promise<{ folder: string; created: boolean }> {
    const name = normalizeImageFolder(rawName);
    const normalized = name.toLowerCase();
    const id = createHash('sha256').update(normalized).digest('hex');
    return db.runTransaction(async (tx: any) => {
      // Include existing image folders so older uploads keep their canonical spelling.
      const [savedFolders, savedImages] = await Promise.all([tx.get(folders()), tx.get(images())]);
      const names: string[] = [...savedFolders.docs.map((doc: any) => doc.data().name),
        ...savedImages.docs.filter((doc: any) => doc.data().isActive !== false).map((doc: any) => doc.data().folder)].filter(Boolean);
      const existing = names.find(value => normalizeImageFolder(value).toLowerCase() === normalized);
      if (existing) {
        if (!savedFolders.docs.some((doc: any) => doc.data().name === existing)) tx.set(folders().doc(id), { name: existing, normalizedName: normalized, createdAt: now() });
        return { folder: existing, created: false };
      }
      tx.set(folders().doc(id), { name, normalizedName: normalized, createdAt: now() });
      return { folder: name, created: true };
    });
  }
  async function upload(input: { bytes: Buffer; mimeType: string; name: string; folder: string }) {
    const mimeType = validateImageUpload(input.mimeType, input.bytes.length);
    validateImageBytes(input.bytes, mimeType);
    const { folder } = await createFolder(input.folder || 'general');
    const name = input.name.trim() || 'image';
    const stem = name.replace(/\.(png|jpe?g|webp|svg)$/i, '').replace(/[^a-zA-Z0-9.-]/g, '_') || 'image';
    const path = `library/images/${folder.replace(/[\\/]/g, '_')}/${randomUUID()}-${stem}.${imageExtension(mimeType)}`;
    const file = bucket().file(path);
    await file.save(input.bytes, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const ref = images().doc();
    await ref.set({ name, folder, mimeType, sizeBytes: input.bytes.length, storageUrl: path,
      publicUrl: publicImageUrl(bucket().name, path), isActive: true, createdAt: now() });
    return mapImage(await ref.get());
  }
  async function archive(id: string) {
    await images().doc(id).update({ isActive: false, updatedAt: now() });
  }
  async function update(id: string, input: { folder?: string; name?: string }) {
    const changes: Record<string, any> = { updatedAt: now() };
    if (input.folder !== undefined) changes.folder = (await createFolder(input.folder)).folder;
    if (input.name !== undefined) {
      const name = input.name.trim(); if (!name) throw new ImageLibraryError('Image name is required'); changes.name = name;
    }
    await images().doc(id).update(changes);
  }
  async function getFile(id: string) {
    const doc = await images().doc(id).get();
    if (!doc.exists || !doc.data().storageUrl) return null;
    // Archiving hides picker entries; already-used files remain available.
    return { file: bucket().file(doc.data().storageUrl), mimeType: doc.data().mimeType };
  }
  return { list, listFolders, createFolder, upload, archive, update, getFile };
}
