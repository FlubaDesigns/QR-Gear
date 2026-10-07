import { GRF_IMAGE_ACCEPT_TYPES, GRF_IMAGE_MAX_BYTES, GRF_IMAGE_MAX_MB, GRF_FORMATS, normalizeMimeType } from './GRF_engine';

export class ImageLibraryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Images and GRF assets share image formats and limits, not identities or collections.
export const IMAGE_LIBRARY_ACCEPT = GRF_IMAGE_ACCEPT_TYPES;
export const IMAGE_LIBRARY_MAX_BYTES = GRF_IMAGE_MAX_BYTES;
export const IMAGE_LIBRARY_MAX_MB = GRF_IMAGE_MAX_MB;
export const IMAGE_FOLDER_MAX_LENGTH = 80;
export interface AdminImage {
  id: string;
  name: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  publicUrl: string;
  proxyUrl: string;
  isActive: boolean;
}
export function normalizeImageFolder(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new ImageLibraryError('Folder name is required');
  if (name.length > IMAGE_FOLDER_MAX_LENGTH) throw new ImageLibraryError(`Folder names must be ${IMAGE_FOLDER_MAX_LENGTH} characters or less`);
  return name;
}
export function validateImageUpload(mime: string, size: number): string {
  let normalized: string;
  try { normalized = normalizeMimeType(mime); } catch (error) { throw new ImageLibraryError((error as Error).message); }
  if (size <= 0) throw new ImageLibraryError('The image file is empty');
  if (size > IMAGE_LIBRARY_MAX_BYTES) throw new ImageLibraryError(`Images must be ${IMAGE_LIBRARY_MAX_MB} MB or smaller`);
  return normalized;
}
export function imageExtension(mime: string): string {
  let normalized: string;
  try { normalized = normalizeMimeType(mime); } catch (error) { throw new ImageLibraryError((error as Error).message); }
  return Object.values(GRF_FORMATS['1']).find(format => format.mime === normalized)!.label;
}
export function publicImageUrl(bucket: string, path: string): string {
  return `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
