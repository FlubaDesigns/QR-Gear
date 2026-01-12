import { getStorageBucket, isFirebaseInitialized, initializeFirebase } from './firebase-admin';
import crypto from 'crypto';
import { Response } from 'express';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadResult {
  fileName: string;
  storageUrl: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
}

function useFirebaseStorage(): boolean {
  // Always use Firebase Storage - no Replit fallback
  return true;
}

function ensureFirebaseInitialized() {
  if (!isFirebaseInitialized()) {
    initializeFirebase();
  }
}

function getMimeTypeFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function uploadToFirebaseStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  ensureFirebaseInitialized();
  
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const extension = mimeType.split('/')[1] || 'jpg';
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const objectName = `${folder}/${uniqueId}.${extension}`;

  const bucket = getStorageBucket();
  const file = bucket.file(objectName);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
  });

  const publicUrl = `/api/files/${uniqueId}.${extension}`;

  console.log(`[FirebaseStorage] Uploaded ${objectName} (${buffer.length} bytes)`);

  return {
    fileName: objectName,
    storageUrl: objectName,
    publicUrl,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export async function uploadImageBase64(
  base64Data: string,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  const actualBase64 = base64Match ? base64Match[2] : base64Data;
  const buffer = Buffer.from(actualBase64, 'base64');
  
  return uploadToFirebaseStorage(buffer, originalName, mimeType, 'hosted-images');
}

export async function uploadImageFromBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folderPath?: string
): Promise<UploadResult> {
  const folder = folderPath || 'custom-designs';
  return uploadToFirebaseStorage(buffer, originalName, mimeType, folder);
}

export async function getFileFromFirebaseStorage(
  fileName: string,
  folder: string = 'custom-designs'
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!useFirebaseStorage()) {
    return null;
  }
  
  ensureFirebaseInitialized();
  
  try {
    const bucket = getStorageBucket();
    
    const possiblePaths = [
      `${folder}/${fileName}`,
      fileName,
      `custom-designs/${fileName}`,
      `hosted-images/${fileName}`,
      `mockups/${fileName}`,
      `library/${fileName}`,
    ];

    for (const objectName of possiblePaths) {
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      
      if (exists) {
        const [contents] = await file.download();
        const [metadata] = await file.getMetadata();
        const mimeType = metadata.contentType || 'application/octet-stream';
        
        console.log(`[FirebaseStorage] Downloaded ${objectName}`);
        return { buffer: contents, mimeType };
      }
    }

    console.log(`[FirebaseStorage] File not found: ${fileName}`);
    return null;
  } catch (error) {
    console.error('[FirebaseStorage] Error downloading file:', error);
    return null;
  }
}

export async function downloadAndStreamFile(
  fileName: string,
  res: Response,
  folder: string = 'custom-designs',
  cacheTtlSec: number = 3600
): Promise<boolean> {
  if (!useFirebaseStorage()) {
    return false;
  }
  
  ensureFirebaseInitialized();
  
  try {
    const bucket = getStorageBucket();
    
    const possiblePaths = [
      `${folder}/${fileName}`,
      fileName,
      `custom-designs/${fileName}`,
      `hosted-images/${fileName}`,
      `mockups/${fileName}`,
      // New canonical paths (libraries/ plural)
      `libraries/backgrounds/raw/${fileName}`,
      `libraries/backgrounds/zip/${fileName}`,
      `libraries/backgrounds/cropped/${fileName}`,
      `libraries/designs/${fileName}`,
      `libraries/videos/${fileName}`,
      // Legacy paths (library/ singular) for backward compatibility
      `library/${fileName}`,
      `library/admin/backgrounds/${fileName}`,
      `library/admin/designs/${fileName}`,
      `library/admin/videos/${fileName}`,
      `library/user/${fileName}`,
      `library/backgrounds/raw/${fileName}`,
      `library/backgrounds/raw/zip/${fileName}`,
      `library/backgrounds/cropped/${fileName}`,
      `backgrounds/source/${fileName}`,
    ];

    for (const objectName of possiblePaths) {
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      
      if (exists) {
        const [metadata] = await file.getMetadata();
        
        res.set({
          'Content-Type': metadata.contentType || 'application/octet-stream',
          'Content-Length': metadata.size,
          'Cache-Control': `public, max-age=${cacheTtlSec}`,
        });

        const stream = file.createReadStream();
        
        stream.on('error', (err) => {
          console.error('[FirebaseStorage] Stream error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error streaming file' });
          }
        });

        stream.pipe(res);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[FirebaseStorage] Error streaming file:', error);
    return false;
  }
}

export async function deleteFromFirebaseStorage(fileName: string, folder: string = 'custom-designs'): Promise<boolean> {
  if (!useFirebaseStorage()) {
    return false;
  }
  
  ensureFirebaseInitialized();
  
  try {
    const bucket = getStorageBucket();
    const objectName = fileName.includes('/') ? fileName : `${folder}/${fileName}`;
    const file = bucket.file(objectName);
    
    await file.delete();
    console.log(`[FirebaseStorage] Deleted ${objectName}`);
    return true;
  } catch (error) {
    console.error('[FirebaseStorage] Error deleting file:', error);
    return false;
  }
}

export async function downloadAndStoreFromUrl(
  imageUrl: string,
  storagePath: string
): Promise<string | null> {
  try {
    console.log(`[Storage] Downloading image from ${imageUrl.substring(0, 80)}...`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[Storage] Failed to download image: ${response.status}`);
      return null;
    }
    
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') {
      console.error(`[Storage] Image has zero content length`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) {
      console.error(`[Storage] Image too small (${buffer.length} bytes), likely invalid`);
      return null;
    }
    
    console.log(`[Storage] Downloaded ${buffer.length} bytes, uploading to storage...`);
    
    const filename = `mockup-${storagePath.replace(/\//g, '-')}`;
    let mimeType = response.headers.get('content-type') || getMimeTypeFromUrl(imageUrl);
    
    // Ensure MIME type is an allowed type, default to image/jpeg for mockups
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      mimeType = 'image/jpeg';
    }
    
    ensureFirebaseInitialized();
    
    const bucket = getStorageBucket();
    const fullPath = `custom-designs/${filename}`;
    
    const file = bucket.file(fullPath);
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
    });
    
    const publicUrl = `/api/files/${filename}`;
    console.log(`[FirebaseStorage] Stored permanently at: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`[Storage] Failed to download/store image:`, err);
    return null;
  }
}

export async function fileExistsInFirebaseStorage(fileName: string, folder: string = 'custom-designs'): Promise<boolean> {
  if (!useFirebaseStorage()) {
    return false;
  }
  
  ensureFirebaseInitialized();
  
  try {
    const bucket = getStorageBucket();
    const objectName = fileName.includes('/') ? fileName : `${folder}/${fileName}`;
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error('[FirebaseStorage] Error checking file existence:', error);
    return false;
  }
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, useFirebaseStorage };
