/**
 * Environment Config Mapper - Standalone config translation
 * Maps between dev (Replit/PostgreSQL) and production (Firebase) environments
 */

export interface DevConfig {
  databaseUrl: string;
  storageBucket: string;
  apiBase: string;
  storageMode: 'postgres-only' | 'dual-write' | 'firestore-only';
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
  databaseUrl: string | null;
  firestoreProjectId: string | null;
  storageBucket: string;
  apiBase: string;
  storageMode: 'postgres-only' | 'dual-write' | 'firestore-only';
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
    databaseUrl: process.env.DATABASE_URL || null,
    firestoreProjectId: process.env.FIREBASE_PROJECT_ID || 'qrgear-c1ffd',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'qrgear-c1ffd.firebasestorage.app',
    apiBase: env === 'production' ? '/api' : '/api',
    storageMode: (process.env.STORAGE_MODE as UnifiedConfig['storageMode']) || 'dual-write',
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
  return '/api/background-files';
}

export function buildProxyUrl(objectPath: string): string {
  return `${getProxyEndpoint()}?path=${encodeURIComponent(objectPath)}`;
}
