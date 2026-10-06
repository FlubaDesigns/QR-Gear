import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerAuthorizationEngineAuth } from '../../routes/authorization-engine-auth';
const origin = 'https://qrgear-c1ffd.web.app';
const principal = 'engine@engine-project.iam.gserviceaccount.com';
let clock: number, rows: Map<string, any>, app: express.Express, auth: any, verify: any;
function setup(config: any = { origin, principal, projectId: 'qrgear-c1ffd' }) {
  clock = Date.now(); rows = new Map();
  auth = { getUser: vi.fn(async () => ({ uid: 'existing-owner', disabled: false })), createCustomToken: vi.fn(async () => 'private-fixture') };
  verify = vi.fn(async () => ({ email: principal, email_verified: true, iat: Math.floor(clock / 1000) }));
  let queue = Promise.resolve();
  const db: any = { collection: () => ({ doc: (id: string) => id }), runTransaction: (fn: any) => {
    const task = queue.then(() => fn({
      get: async (id: string) => ({ data: () => rows.get(id) }),
      set: (id: string, data: any) => rows.set(id, data),
      create: (id: string, data: any) => rows.set(id, data),
      update: (id: string, data: any) => rows.set(id, { ...rows.get(id), ...data }),
    })); queue = task.catch(() => {}); return task;
  } };
  app = express(); app.use(express.json());
  registerAuthorizationEngineAuth(app, { db, auth, ownerIds: ['existing-owner'], projectId: 'qrgear-c1ffd', config: JSON.stringify(config), verifyIdentity: verify, now: () => clock });
}
async function start() {
  const response = await request(app).post('/auth/engine/session').set('Origin', origin);
  expect(response.status).toBe(201);
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  return { id: response.body.requestId, cookie, response };
}
const approve = (id: string) => request(app).post(`/auth/engine/session/${id}/approve`).set('Authorization', 'Bearer private-identity-fixture');
const poll = (id: string, cookie: string) => request(app).post(`/auth/engine/session/${id}`).set('Origin', origin).set('Cookie', cookie);
beforeEach(() => { setup(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
describe('Authorization Engine browser boundary', () => {
  it('binds one approval to one browser and the existing owner', async () => {
    const a = await start(), b = await start();
    expect(a.response.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(a.response.headers['set-cookie'][0]).toMatch(/Secure/);
    expect(a.response.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    expect((await poll(a.id, a.cookie)).status).toBe(202);
    expect(auth.createCustomToken).not.toHaveBeenCalled();
    expect((await approve(a.id)).status).toBe(200);
    expect(verify).toHaveBeenCalledWith('private-identity-fixture', origin + '/api/auth/engine/session');
    expect((await poll(a.id, b.cookie)).status).toBe(403);
    const results = await Promise.all([poll(a.id, a.cookie), poll(a.id, a.cookie)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 410]);
    expect(auth.createCustomToken).toHaveBeenCalledTimes(1);
    expect(auth.createCustomToken).toHaveBeenCalledWith('existing-owner', { authorizationEngineSession: a.id });
    expect((await approve(a.id)).status).toBe(410);
    expect(JSON.stringify([...rows.values()])).not.toContain('private-fixture');
  });
  it('rejects cross-origin starts and polls, missing proof, and unapproved requests', async () => {
    expect((await request(app).post('/auth/engine/session').set('Origin', 'https://other.example')).status).toBe(403);
    const a = await start();
    expect((await request(app).post(`/auth/engine/session/${a.id}`).set('Cookie', a.cookie)).status).toBe(403);
    expect((await poll(a.id, '')).status).toBe(403);
    expect((await request(app).post(`/auth/engine/session/${a.id}/approve`)).status).toBe(401);
    expect(auth.createCustomToken).not.toHaveBeenCalled();
  });
  it('rejects other principals, unverified identities and stale identity tokens', async () => {
    const a = await start();
    for (const payload of [
      { email: 'other@engine-project.iam.gserviceaccount.com', email_verified: true, iat: clock/1000 },
      { email: principal, email_verified: false, iat: clock/1000 },
      { email: principal, email_verified: true, iat: clock/1000 - 301 },
    ]) { verify.mockResolvedValue(payload); expect((await approve(a.id)).status).toBe(403); }
    verify.mockRejectedValue(new Error('private-provider-error'));
    const failed = await approve(a.id);
    expect(failed.status).toBe(401); expect(JSON.stringify(failed.body)).not.toContain('private-provider-error');
    expect(auth.createCustomToken).not.toHaveBeenCalled();
  });
  it('rejects expired requests and a disabled owner before token creation', async () => {
    const a = await start(); clock += 600001;
    expect((await approve(a.id)).status).toBe(410);
    expect((await poll(a.id, a.cookie)).status).toBe(410);
    const b = await start(); auth.getUser.mockResolvedValue({ uid: 'existing-owner', disabled: true });
    expect((await approve(b.id)).status).toBe(403);
    expect(auth.createCustomToken).not.toHaveBeenCalled();
  });
  it('fails closed without canonical matching configuration and rate limits starts', async () => {
    setup({ origin, principal, projectId: 'different-project' });
    expect((await request(app).post('/auth/engine/session').set('Origin', origin)).status).toBe(404);
    setup(); for (let i=0; i<5; i++) await start();
    expect((await request(app).post('/auth/engine/session').set('Origin', origin)).status).toBe(429);
  });
});
