import { normalizeMimeType, GRF_IMAGE_MAX_BYTES, GRF_IMAGE_MAX_MB } from '../../../shared/GRF_engine';

import { ImageLibraryError as LibraryImageError } from '../../../shared/imageLibrary';
import type { Response } from 'express';
import sharp from 'sharp';
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
    : mimeType === 'image/gif' ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())
    : mimeType === 'image/svg+xml' && /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(bytes.toString('utf8').trimStart());
  if (!matches) throw new LibraryImageError('Image bytes do not match the selected format. Use PNG, JPEG, WebP, or SVG.');
}

/** Public proxy output is decoded pixels, never an upstream document. */
export async function rasterizeProxyImage(bytes: Buffer, mimeType: string): Promise<Buffer> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType)) throw new LibraryImageError('Only raster images are allowed', 415);
  validateImageBytes(bytes, mimeType);
  try {
    return await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }).rotate().png().toBuffer();
  } catch { throw new LibraryImageError('The image cannot be safely decoded', 415); }
}

/** Protect direct navigation as well as image-element use of stored uploads. */
export function setUntrustedAssetHeaders(res: Response, rawMime?: string): void {
  const mime = (rawMime || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  res.set('Content-Type', mime);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'].includes(mime)) {
    res.set('Content-Disposition', 'attachment');
    res.set('Cache-Control', 'private, no-store');
  }
}

export function providerImageUrl(value: string, base?: URL): URL {
  let url: URL;
  try { url = new URL(value, base); } catch { throw new LibraryImageError('Invalid image URL'); }
  const hosts = ['images.printify.com', 'images-api.printify.com', 'printful.com', 'files.cdn.printful.com'];
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) {
    throw new LibraryImageError('Image host is not allowed', 403);
  }
  return url;
}

export async function fetchProviderImage(value: string): Promise<Buffer> {
  let url = providerImageUrl(value);
  const signal = AbortSignal.timeout(15_000);
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(url, { redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || hop === 3) throw new LibraryImageError('Invalid image redirect', 502);
      url = providerImageUrl(location, url);
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new LibraryImageError('Image provider could not return the image', 502); }
    if (Number(response.headers.get('content-length')) > GRF_IMAGE_MAX_BYTES) {
      await response.body?.cancel(); throw new LibraryImageError('Image is too large', 413);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new LibraryImageError('Empty image response', 502);
    const chunks: Buffer[] = []; let size = 0;
    try {
      while (true) {
        const { done, value: chunk } = await reader.read(); if (done) break;
        size += chunk.byteLength;
        if (size > GRF_IMAGE_MAX_BYTES) throw new LibraryImageError('Image is too large', 413);
        chunks.push(Buffer.from(chunk));
      }
    } finally { await reader.cancel(); }
    return rasterizeProxyImage(Buffer.concat(chunks), (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase());
  }
  throw new LibraryImageError('Too many image redirects', 502);
}
