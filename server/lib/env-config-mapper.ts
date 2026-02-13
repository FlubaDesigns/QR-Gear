/**
 * Environment Config Mapper - Standalone config translation
 */

export interface DevConfig {
  storageBucket: string;
  apiBase: string;
  storageMode: 'firestore-only';
}

export interface ProdConfig {
  firestoreProjectId: string;
  storageBucket: string;
  apiBase: string;
  region: string;
}

export interface UnifiedConfig {
  isDev: boolean;
  isProd: boolean;
  firestoreProjectId: string | null;
  storageBucket: string;
  apiBase: string;
  storageMode: 'firestore-only';
}

export function getEnvironment(): 'development' | 'production' {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function isDev(): boolean {
  return getEnvironment() === 'development';
}

export function isProd(): boolean {
  return getEnvironment() === 'production';
}

export function getUnifiedConfig(): UnifiedConfig {
  const env = getEnvironment();
  
  return {
    isDev: env === 'development',
    isProd: env === 'production',
    firestoreProjectId: process.env.FIREBASE_PROJECT_ID || 'qrgear-c1ffd',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'qrgear-c1ffd.firebasestorage.app',
    apiBase: '/api',
    storageMode: 'firestore-only' as const,
  };
}

export function getStorageBasePath(assetType: 'source' | 'cropped' | 'template' | 'background'): string {
  const pathMap: Record<string, string> = {
    source: 'library/backgrounds/raw',
    cropped: 'library/backgrounds/cropped',
    template: 'library/templates',
    background: 'library/backgrounds',
  };
  return pathMap[assetType] || 'library';
}

export function getProxyEndpoint(): string {
  return '/api/library-files';
}

export function buildProxyUrl(objectPath: string): string {
  const filename = objectPath.split('/').pop() || objectPath;
  return `${getProxyEndpoint()}/${encodeURIComponent(filename)}`;
}
