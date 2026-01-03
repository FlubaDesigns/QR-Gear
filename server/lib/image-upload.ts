import crypto from 'crypto';
import {
  uploadToFirebaseStorage,
  getFileFromFirebaseStorage,
  deleteFromFirebaseStorage,
  ALLOWED_MIME_TYPES as FIREBASE_ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE as FIREBASE_MAX_FILE_SIZE,
} from './firebase-storage-service';

const ALLOWED_MIME_TYPES = FIREBASE_ALLOWED_MIME_TYPES;
const MAX_FILE_SIZE = FIREBASE_MAX_FILE_SIZE;

interface UploadResult {
  fileName: string;
  storageUrl: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
}

function useFirebaseStorage(): boolean {
  const mode = process.env.STORAGE_MODE || 'postgres-only';
  return mode === 'dual-write' || mode === 'firestore-only';
}

export async function uploadImage(
  base64Data: string,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }

  const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  const actualBase64 = base64Match ? base64Match[2] : base64Data;
  const buffer = Buffer.from(actualBase64, 'base64');

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (useFirebaseStorage()) {
    return uploadToFirebaseStorage(buffer, originalName, mimeType, 'hosted-images');
  }

  const { objectStorageClient } = await import('../replit_integrations/object_storage');
  
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set. Please set up object storage.');
  }

  const extension = mimeType.split('/')[1] || 'jpg';
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const objectName = `hosted-images/${uniqueId}.${extension}`;

  const bucket = objectStorageClient.bucket(bucketId);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
  });

  return {
    fileName: objectName,
    storageUrl: objectName,
    publicUrl: `/api/images/${uniqueId}`,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export async function getImageBuffer(fileName: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (useFirebaseStorage()) {
    return getFileFromFirebaseStorage(fileName, 'hosted-images');
  }

  try {
    const { objectStorageClient } = await import('../replit_integrations/object_storage');
    
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      return null;
    }

    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(fileName);

    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }

    const [contents] = await file.download();
    const extension = fileName.split('.').pop() || 'jpg';
    const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

    return {
      buffer: contents,
      mimeType,
    };
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

export async function deleteImage(fileName: string): Promise<boolean> {
  if (useFirebaseStorage()) {
    return deleteFromFirebaseStorage(fileName, 'hosted-images');
  }

  try {
    const { objectStorageClient } = await import('../replit_integrations/object_storage');
    
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      return false;
    }

    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(fileName);

    await file.delete();
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}

export async function uploadImageFromBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folderPath?: string
): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const folder = folderPath || 'custom-designs';

  if (useFirebaseStorage()) {
    return uploadToFirebaseStorage(buffer, originalName, mimeType, folder);
  }

  const { objectStorageClient } = await import('../replit_integrations/object_storage');
  
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set. Please set up object storage.');
  }

  const extension = mimeType.split('/')[1] || 'jpg';
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const objectName = `${folder}/${uniqueId}.${extension}`;

  const bucket = objectStorageClient.bucket(bucketId);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
  });

  const publicUrl = folder.startsWith('library/')
    ? `/api/library-files/${uniqueId}.${extension}`
    : `/api/files/${uniqueId}.${extension}`;

  return {
    fileName: objectName,
    storageUrl: objectName,
    publicUrl,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
