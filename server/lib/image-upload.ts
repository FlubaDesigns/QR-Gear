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
  // Always use Firebase Storage - no Replit fallback
  return true;
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

  // Always use Firebase Storage
  return uploadToFirebaseStorage(buffer, originalName, mimeType, 'hosted-images');
}

export async function getImageBuffer(fileName: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  // Always use Firebase Storage
  return getFileFromFirebaseStorage(fileName, 'hosted-images');
}

export async function deleteImage(fileName: string): Promise<boolean> {
  // Always use Firebase Storage
  return deleteFromFirebaseStorage(fileName, 'hosted-images');
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

  // Always use Firebase Storage
  return uploadToFirebaseStorage(buffer, originalName, mimeType, folder);
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
