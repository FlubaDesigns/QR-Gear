import { getStorageBucket, isFirebaseInitialized, initializeFirebase } from './firebase-admin';
import crypto from 'crypto';

export type ContentMode = 'canvas' | 'play' | 'dynamics' | 'basics';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const ALLOWED_CONTENT_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for videos

export interface ContentUploadResult {
  fileName: string;
  storagePath: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
  mode: ContentMode;
}

function ensureFirebaseInitialized() {
  if (!isFirebaseInitialized()) {
    initializeFirebase();
  }
}

function getStoragePath(mode: ContentMode, userId: string, packetId: string, fileName?: string): string {
  const basePath = `content/members/${userId}/${mode}`;
  
  if (mode === 'canvas' || mode === 'basics') {
    // Use fileName if provided to allow multiple files per packet (e.g., product-graphic vs landing-snapshot)
    if (fileName) {
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      return `${basePath}/${packetId}/${safeName}`;
    }
    return `${basePath}/${packetId}.png`;
  } else if (mode === 'play' || mode === 'dynamics') {
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const safeName = fileName?.replace(/[^a-zA-Z0-9.-]/g, '_') || `file_${uniqueId}`;
    return `${basePath}/${packetId}/${safeName}`;
  }
  
  return `${basePath}/${packetId}`;
}

export async function uploadContent(
  buffer: Buffer,
  mode: ContentMode,
  userId: string,
  packetId: string,
  mimeType: string,
  originalFileName?: string
): Promise<ContentUploadResult> {
  ensureFirebaseInitialized();
  
  console.log(`[ContentUpload] Starting upload: mode=${mode}, userId=${userId}, packetId=${packetId}, mimeType=${mimeType}, fileName=${originalFileName}, bufferSize=${buffer.length}`);
  
  if (!buffer || buffer.length === 0) {
    throw new Error('File is empty - no data received');
  }
  
  if (!ALLOWED_CONTENT_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
  }
  
  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  
  if (buffer.length > maxSize) {
    throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB for ${isVideo ? 'videos' : 'images'}`);
  }
  
  const storagePath = getStoragePath(mode, userId, packetId, originalFileName);
  
  const bucket = getStorageBucket();
  const file = bucket.file(storagePath);
  
  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        mode,
        userId,
        packetId,
        uploadedAt: new Date().toISOString(),
      },
    },
  });
  
  await file.makePublic();
  
  const bucketName = bucket.name;
  const publicUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;
  
  console.log(`[ContentUpload] Uploaded ${storagePath} (${buffer.length} bytes) for ${mode} mode`);
  
  return {
    fileName: storagePath.split('/').pop() || storagePath,
    storagePath,
    publicUrl,
    sizeBytes: buffer.length,
    mimeType,
    mode,
  };
}

export async function uploadCanvasComposite(
  base64Data: string,
  userId: string,
  packetId: string,
  fileName?: string
): Promise<ContentUploadResult> {
  const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = base64Match?.[1] || 'image/png';
  const actualBase64 = base64Match?.[2] || base64Data;
  const buffer = Buffer.from(actualBase64, 'base64');
  
  return uploadContent(buffer, 'canvas', userId, packetId, mimeType, fileName);
}

export async function uploadPlayMedia(
  buffer: Buffer,
  userId: string,
  packetId: string,
  mimeType: string,
  originalFileName: string
): Promise<ContentUploadResult> {
  return uploadContent(buffer, 'play', userId, packetId, mimeType, originalFileName);
}

export async function getContentUrl(
  mode: ContentMode,
  userId: string,
  packetId: string
): Promise<string | null> {
  ensureFirebaseInitialized();
  
  try {
    const bucket = getStorageBucket();
    const basePath = `content/members/${userId}/${mode}/${packetId}`;
    
    if (mode === 'canvas' || mode === 'basics') {
      const file = bucket.file(`${basePath}.png`);
      const [exists] = await file.exists();
      if (exists) {
        return `https://storage.googleapis.com/${bucket.name}/${basePath}.png`;
      }
    } else {
      const [files] = await bucket.getFiles({ prefix: basePath + '/' });
      if (files.length > 0) {
        return `https://storage.googleapis.com/${bucket.name}/${files[0].name}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[ContentUpload] Error getting content URL:', error);
    return null;
  }
}

export async function deleteContent(
  mode: ContentMode,
  userId: string,
  packetId: string
): Promise<boolean> {
  ensureFirebaseInitialized();
  
  try {
    const bucket = getStorageBucket();
    const basePath = `content/members/${userId}/${mode}/${packetId}`;
    
    if (mode === 'canvas' || mode === 'basics') {
      const file = bucket.file(`${basePath}.png`);
      await file.delete();
    } else {
      const [files] = await bucket.getFiles({ prefix: basePath + '/' });
      for (const file of files) {
        await file.delete();
      }
    }
    
    console.log(`[ContentUpload] Deleted content for ${mode}/${userId}/${packetId}`);
    return true;
  } catch (error) {
    console.error('[ContentUpload] Error deleting content:', error);
    return false;
  }
}

export { ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_CONTENT_TYPES, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE };
