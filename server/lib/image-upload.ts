import { Client } from "@replit/object-storage";
import crypto from "crypto";

let objectStorageClient: Client | null = null;

function getObjectStorage(): Client {
  if (!objectStorageClient) {
    objectStorageClient = new Client();
  }
  return objectStorageClient;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadResult {
  fileName: string;
  storageUrl: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
}

export async function uploadImage(
  base64Data: string,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
  }

  const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  const actualBase64 = base64Match ? base64Match[2] : base64Data;
  
  const buffer = Buffer.from(actualBase64, "base64");
  
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const extension = mimeType.split("/")[1] || "jpg";
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const fileName = `hosted-images/${uniqueId}.${extension}`;

  const { ok, error } = await getObjectStorage().uploadFromBytes(fileName, buffer);

  if (!ok) {
    throw new Error(`Failed to upload image: ${error}`);
  }

  const publicUrl = `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DEV_DOMAIN?.replace('https://', '') || 'replit.dev'}/api/images/${uniqueId}`;

  return {
    fileName,
    storageUrl: fileName,
    publicUrl: `/api/images/${uniqueId}`,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export async function getImageBuffer(fileName: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const { ok, value } = await getObjectStorage().downloadAsBytes(fileName);
    if (!ok || !value) {
      return null;
    }
    
    const extension = fileName.split(".").pop() || "jpg";
    const mimeType = `image/${extension === "jpg" ? "jpeg" : extension}`;
    
    return {
      buffer: value instanceof Buffer ? value : Buffer.from(value as unknown as Uint8Array),
      mimeType,
    };
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

export async function deleteImage(fileName: string): Promise<boolean> {
  try {
    const { ok } = await getObjectStorage().delete(fileName);
    return ok;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
}

// Upload from raw buffer (for multipart form uploads)
export async function uploadImageFromBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folderPath?: string
): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const extension = mimeType.split("/")[1] || "jpg";
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const folder = folderPath || "custom-designs";
  const fileName = `${folder}/${uniqueId}.${extension}`;

  const { ok, error } = await getObjectStorage().uploadFromBytes(fileName, buffer);

  if (!ok) {
    throw new Error(`Failed to upload image: ${error}`);
  }

  return {
    fileName,
    storageUrl: fileName,
    publicUrl: `/api/library-files/${uniqueId}.${extension}`,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
