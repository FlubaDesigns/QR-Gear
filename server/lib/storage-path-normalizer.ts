/**
 * Storage Path Normalizer - Firebase Storage path format handler
 * 
 * Handles all path format conversions:
 * - gs://bucket/path → bucket-relative path
 * - https://storage.googleapis.com/bucket/path → bucket-relative path
 * - https://firebasestorage.googleapis.com/.../o/path?... → bucket-relative path
 * - Raw paths → unchanged
 * 
 * Also generates proxyUrl for frontend consumption
 */

export interface NormalizedStoragePath {
  objectPath: string;        // Bucket-relative path (e.g., "library/backgrounds/raw/image.png")
  proxyUrl: string;          // Frontend-ready URL (e.g., "/api/library-files/:filename")
  originalPath: string;      // The original input path
  format: 'gs' | 'storage_googleapis' | 'firebasestorage' | 'raw' | 'unknown';
}

/**
 * Extracts bucket-relative object path from any storage URL format
 */
export function extractObjectPath(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null;
  
  // gs://bucket-name/path/to/file
  if (rawPath.startsWith('gs://')) {
    const match = rawPath.match(/^gs:\/\/[^/]+\/(.+)$/);
    return match ? match[1] : null;
  }
  
  // https://storage.googleapis.com/bucket-name/path/to/file
  if (rawPath.startsWith('https://storage.googleapis.com/')) {
    const match = rawPath.match(/^https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }
  
  // https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?...
  if (rawPath.startsWith('https://firebasestorage.googleapis.com/')) {
    const match = rawPath.match(/\/o\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
  
  // Already a raw path (not a URL)
  if (!rawPath.startsWith('http://') && !rawPath.startsWith('https://')) {
    return rawPath;
  }
  
  return null;
}

/**
 * Detects the format of a storage path
 */
export function detectPathFormat(rawPath: string | null | undefined): NormalizedStoragePath['format'] {
  if (!rawPath) return 'unknown';
  
  if (rawPath.startsWith('gs://')) return 'gs';
  if (rawPath.startsWith('https://storage.googleapis.com/')) return 'storage_googleapis';
  if (rawPath.startsWith('https://firebasestorage.googleapis.com/')) return 'firebasestorage';
  if (!rawPath.startsWith('http://') && !rawPath.startsWith('https://')) return 'raw';
  
  return 'unknown';
}

/**
 * Generates a proxy URL for frontend consumption
 */
export function generateProxyUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  const filename = objectPath.split('/').pop() || objectPath;
  return `/api/library-files/${encodeURIComponent(filename)}`;
}

/**
 * Full normalization: takes any storage path format and returns normalized result
 */
export function normalizeStoragePath(rawPath: string | null | undefined): NormalizedStoragePath | null {
  if (!rawPath) return null;
  
  const objectPath = extractObjectPath(rawPath);
  if (!objectPath) return null;
  
  return {
    objectPath,
    proxyUrl: generateProxyUrl(objectPath)!,
    originalPath: rawPath,
    format: detectPathFormat(rawPath),
  };
}

/**
 * Adds proxyUrl to an asset object based on its storage path fields
 * Works with any object that has storagePath, storageUrl, or publicUrl
 */
export function addProxyUrlToAsset<T extends Record<string, any>>(asset: T): T & { proxyUrl: string | null } {
  const rawPath = asset.storagePath || asset.storageUrl || asset.publicUrl || null;
  const objectPath = extractObjectPath(rawPath);
  
  return {
    ...asset,
    proxyUrl: objectPath ? generateProxyUrl(objectPath) : null,
  };
}

/**
 * Batch version: adds proxyUrl to multiple assets
 */
export function addProxyUrlToAssets<T extends Record<string, any>>(assets: T[]): Array<T & { proxyUrl: string | null }> {
  return assets.map(addProxyUrlToAsset);
}

/**
 * Validates that a storage path exists in any recognized format
 */
export function isValidStoragePath(rawPath: string | null | undefined): boolean {
  if (!rawPath) return false;
  return extractObjectPath(rawPath) !== null;
}
