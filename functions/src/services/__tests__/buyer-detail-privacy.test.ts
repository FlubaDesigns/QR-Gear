import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, uid: 'owner' }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a) }, admin: { auth: () => ({ verifyIdToken: async () => ({ uid: m.uid }) }) } }));
import { register } from '../../routes/dynamics';
beforeEach(() => { m.uid = 'owner'; m.db = database({ 'buyer_instances/i': { buyerUserId: 'owner', buyerEmail: 'private@example.invalid', privateNote: 'do not expose', hostingExpiresAt: '2099-01-01T00:00:00.000Z', destinationUrl: 'https://example.invalid' } }).db; });
const app = () => { const a = express(); a.use(express.json()); register(a); return a; };
it('requires the buyer for full details', async () => {
  expect((await request(app()).get('/buyer/instances/i')).status).toBe(401);
  m.uid = 'other'; expect((await request(app()).get('/buyer/instances/i').set('Authorization', 'Bearer valid')).status).toBe(403);
  m.uid = 'owner'; const result = await request(app()).get('/buyer/instances/i').set('Authorization', 'Bearer valid');
  expect(result.status).toBe(200); expect(result.body.instance.buyerEmail).toBe('private@example.invalid'); expect(result.headers['cache-control']).toContain('no-store');
});
it('keeps public renewal and resolution usable without disclosing customer fields', async () => {
  const renewal = await request(app()).get('/buyer/instances/i/public');
  expect(renewal.status).toBe(200); expect(renewal.body).toEqual({ instance: { id: 'i', hostingExpiresAt: '2099-01-01T00:00:00.000Z' }, isActive: true });
  const resolution = await request(app()).get('/resolve/i'); expect(resolution.body.destinationUrl).toBe('https://example.invalid');
  expect(JSON.stringify(resolution.body)).not.toContain('private');
});
