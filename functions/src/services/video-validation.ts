import { GRF_VIDEO_MAX_BYTES, GRF_VIDEO_MAX_MB, validateVideoUpload } from '../../../shared/GRF_engine';

export class VideoUploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Validate uploaded container and encoding before allocating an identity or writing a file. */
export function decodeVideoUpload(value: string, mimeType: string): { imageData: string; mimeType: string } {
  const dataUri = /^data:([^;]+);base64,([\s\S]*)$/.exec(value);
  const normalized = String(mimeType || '').toLowerCase();
  if (dataUri && dataUri[1].toLowerCase() !== normalized) throw new VideoUploadError('Video format does not match its upload type');
  const imageData = dataUri ? dataUri[2] : value;
  if (imageData.length > Math.ceil(GRF_VIDEO_MAX_BYTES / 3) * 4) throw new VideoUploadError(`Videos must be ${GRF_VIDEO_MAX_MB} MB or smaller`, 413);
  if (imageData.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(imageData)) throw new VideoUploadError('Invalid video encoding');
  const bytes = Buffer.from(imageData, 'base64');
  try { validateVideoUpload(normalized, bytes.length); }
  catch (error) { throw new VideoUploadError((error as Error).message, bytes.length > GRF_VIDEO_MAX_BYTES ? 413 : 400); }
  const matches = normalized === 'video/mp4'
    ? bytes.length >= 16 && bytes.subarray(4, 8).toString() === 'ftyp' && bytes.subarray(8, 12).toString() !== 'qt  '
    : bytes.length >= 8 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && bytes.subarray(0, 4096).includes(Buffer.from('webm'));
  if (!matches) throw new VideoUploadError('Video bytes do not match the selected format. Use MP4 or WebM.');
  return { imageData, mimeType: normalized };
}
