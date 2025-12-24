import { objectStorageClient } from "../replit_integrations/object_storage";
import crypto from "crypto";

function getBucketName(): string {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set. Please set up object storage.");
  }
  return bucketId;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
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
  const objectName = `hosted-images/${uniqueId}.${extension}`;

  const bucketName = getBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
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
  try {
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(fileName);
    
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    
    const [contents] = await file.download();
    const extension = fileName.split(".").pop() || "jpg";
    const mimeType = `image/${extension === "jpg" ? "jpeg" : extension}`;
    
    return {
      buffer: contents,
      mimeType,
    };
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

export async function deleteImage(fileName: string): Promise<boolean> {
  try {
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(fileName);
    
    await file.delete();
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
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
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const extension = mimeType.split("/")[1] || "jpg";
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const folder = folderPath || "custom-designs";
  const objectName = `${folder}/${uniqueId}.${extension}`;

  const bucketName = getBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
  });

  return {
    fileName: objectName,
    storageUrl: objectName,
    publicUrl: `/api/files/${uniqueId}.${extension}`,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
