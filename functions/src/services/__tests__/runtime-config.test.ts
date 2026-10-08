import { afterEach, expect, it, vi } from 'vitest';
import { resolveRuntimeConfig, requireLiveCommerce } from '../../runtime-config';
afterEach(() => vi.unstubAllEnvs());
it('refuses a sandbox pointed at Main', () => {
  expect(() => resolveRuntimeConfig({ GCLOUD_PROJECT: 'qrgear-c1ffd', QRGEAR_ENVIRONMENT: 'sandbox' })).toThrow('Main');
  expect(() => resolveRuntimeConfig({ GCLOUD_PROJECT: 'qr-gear-sandbox', FIREBASE_CONFIG: JSON.stringify({ storageBucket: 'qrgear-c1ffd.firebasestorage.app' }) })).toThrow('different project');
});
it('does not guess a project if configuration is missing', () => {
  expect(() => resolveRuntimeConfig({})).toThrow('required');
});
it('resolves storage and links inside sandbox', () => {
  expect(resolveRuntimeConfig({ GCLOUD_PROJECT: 'qr-gear-sandbox' })).toEqual({ projectId: 'qr-gear-sandbox', storageBucket: 'qr-gear-sandbox.firebasestorage.app', origin: 'https://qr-gear-sandbox.web.app', sandbox: true });
});
it('blocks live commerce even if credentials were accidentally supplied', () => {
  vi.stubEnv('GCLOUD_PROJECT', 'qr-gear-sandbox');
  vi.stubEnv('PRINTIFY_API_KEY', 'test-only-not-a-credential');
  expect(() => requireLiveCommerce('Supplier orders')).toThrow('disabled');
});
