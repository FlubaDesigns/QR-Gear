import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const m = vi.hoisted(() => ({ secret: 'sk_live_fixture' }));
vi.mock('../../core', () => ({ db: {}, admin: {} }));
vi.mock('../fluba-provider-keys', () => ({ readFlubaProviderKey: async () => m.secret }));
import { register } from '../../routes/core-routes';
const app = express(); register(app);
beforeEach(() => { m.secret = 'sk_live_fixture'; vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_live_fixture'); });
afterEach(() => vi.unstubAllEnvs());
it('returns only the current live public key with no caching', async () => {
 const result = await request(app).get('/stripe/publishable-key');
 expect(result.status).toBe(200); expect(result.body).toEqual({publishableKey:'pk_live_fixture'});
 expect(result.headers['cache-control']).toBe('no-store');
});
it.each(['public', 'secret'])('fails closed for test-mode %s configuration without disclosing keys', async kind => {
 if (kind === 'public') vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_sensitive');
 else m.secret = 'sk_test_sensitive';
 const result = await request(app).get('/stripe/publishable-key');
 expect(result.status).toBe(503); expect(result.body.error).toContain('administrator attention');
 expect(JSON.stringify(result.body)).not.toContain('sensitive'); expect(result.body.publishableKey).toBeUndefined();
});
