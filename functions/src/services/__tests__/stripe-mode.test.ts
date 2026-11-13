import { afterEach, expect, it, vi } from 'vitest';
import { assertLiveStripeKey, assertLiveStripeObject } from '../stripe-mode';
afterEach(() => vi.unstubAllEnvs());
it('requires explicit live evidence rather than trusting paid status or truthy values', () => {
  for (const livemode of [false, undefined, null, 1, 'true']) {
    expect(() => assertLiveStripeObject({ livemode } as any)).toThrow('cannot fund Main');
  }
  expect(() => assertLiveStripeObject({ livemode: true })).not.toThrow();
});
it('rejects missing/test/malformed credentials without including them in errors', () => {
  for (const key of [undefined, '', 'sk_test_sensitive', 'rk_test_sensitive', 'sk_live_', 'pk_live_sensitive']) {
    try { assertLiveStripeKey(key); throw new Error('Expected rejection'); }
    catch (error: any) { expect(error.status).toBe(503); expect(error.message).not.toContain('sensitive'); }
  }
  expect(() => assertLiveStripeKey('sk_live_fixture')).not.toThrow();
  expect(() => assertLiveStripeKey('rk_live_fixture')).not.toThrow();
  expect(() => assertLiveStripeKey('pk_live_fixture', 'publishable')).not.toThrow();
  expect(() => assertLiveStripeKey('pk_test_fixture', 'publishable')).toThrow('administrator attention');
});
it('does not allow live credentials or live evidence to enable sandbox commerce', () => {
  vi.stubEnv('QRGEAR_ENVIRONMENT', 'sandbox');
  expect(() => assertLiveStripeKey('sk_live_fixture')).toThrow('disabled');
  expect(() => assertLiveStripeObject({ livemode: true })).toThrow('disabled');
});
