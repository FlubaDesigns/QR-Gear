import { normalizeMimeType, GRF_IMAGE_MAX_BYTES, GRF_IMAGE_MAX_MB } from '../../../shared/GRF_engine';

import { ImageLibraryError as LibraryImageError } from '../../../shared/imageLibrary';
export { ImageLibraryError as LibraryImageError } from '../../../shared/imageLibrary';

export function decodeLibraryImage(value: string, rawMime: string): { imageData: string; mimeType: string } {
  let mimeType: string;
  try { mimeType = normalizeMimeType(rawMime); } catch (error) { throw new LibraryImageError((error as Error).message); }
  if (typeof value !== 'string' || !value) throw new LibraryImageError('Image data is required');
  const dataUri = /^data:([^;]+);base64,([\s\S]*)$/.exec(value);
  if (dataUri && dataUri[1].replace('image/jpg', 'image/jpeg') !== mimeType) throw new LibraryImageError('Image format does not match its upload type');
  const imageData = dataUri ? dataUri[2] : value;
  if (imageData.length > Math.ceil(GRF_IMAGE_MAX_BYTES / 3) * 4) throw new LibraryImageError(`Images must be ${GRF_IMAGE_MAX_MB} MB or smaller`, 413);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageData)) throw new LibraryImageError('Invalid image encoding');
  const bytes = Buffer.from(imageData, 'base64');
  if (!bytes.length || bytes.length > GRF_IMAGE_MAX_BYTES) throw new LibraryImageError(`Images must be ${GRF_IMAGE_MAX_MB} MB or smaller`, 413);
  validateImageBytes(bytes, mimeType);
  return { imageData, mimeType };
}

export function validateImageBytes(bytes: Buffer, mimeType: string): void {
  if (!bytes.length || bytes.length > GRF_IMAGE_MAX_BYTES) throw new LibraryImageError(`Images must be ${GRF_IMAGE_MAX_MB} MB or smaller`, 413);
  const matches = mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mimeType === 'image/webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    : /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(bytes.toString('utf8').trimStart());
  if (!matches) throw new LibraryImageError('Image bytes do not match the selected format. Use PNG, JPEG, WebP, or SVG.');
}
