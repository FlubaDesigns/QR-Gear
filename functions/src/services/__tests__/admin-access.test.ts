import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { configuredAdminIds, hasAdminAccess } from '../../../../shared/adminAccess';
const m = vi.hoisted(() => ({ verify: vi.fn(), get: vi.fn() }));
vi.mock('../../core', () => ({ admin: { auth: () => ({ verifyIdToken: m.verify }) }, db: { collection: () => ({ doc: () => ({ get: m.get }) }) } }));
import { requireAdmin, requireAuth } from '../../middleware';
function app() {
  const a = express(); a.use('/admin', requireAdmin);
  a.all('/admin/private', requireAdmin, (_req, res) => res.json({ private: true }));
  a.get('/account', requireAuth, (_req, res) => res.json({ ok: true }));
  a.use((_: any, _req: any, res: any, _next: any) => res.status(503).json({ error: 'Access check unavailable' }));
  return a;
}
beforeEach(() => { vi.clearAllMocks(); m.verify.mockResolvedValue({ uid: 'ordinary-user' }); m.get.mockResolvedValue({ data: () => ({ isAdmin: false }) }); });
afterEach(() => vi.unstubAllEnvs());
describe('admin authorization', () => {
  it('denies absent and invalid tokens even when the old bypass flag is set', async () => {
    vi.stubEnv('ADMIN_BYPASS', 'true');
    for (const path of ['/admin/private', '/account']) expect((await request(app()).get(path)).status).toBe(401);
    m.verify.mockRejectedValue(new Error('invalid'));
    expect((await request(app()).get('/admin/private').set('Authorization', 'Bearer bad')).status).toBe(401);
  });
  it('blocks ordinary users on reads and writes', async () => {
    for (const method of ['get','post','put','patch','delete'] as const) {
      expect((await request(app())[method]('/admin/private').set('Authorization', 'Bearer valid')).status).toBe(403);
    }
    expect(m.verify).toHaveBeenCalledWith('valid', true);
  });
  it('requires a true boolean admin flag and fails closed when profile storage fails', async () => {
    m.get.mockResolvedValue({ data: () => ({ isAdmin: 'true' }) });
    expect((await request(app()).get('/admin/private').set('Authorization','Bearer valid')).status).toBe(403);
    m.get.mockRejectedValue(new Error('offline'));
    expect((await request(app()).get('/admin/private').set('Authorization','Bearer valid')).status).toBe(503);
  });
  it('preserves authorized owner access and does not repeat checks within one request', async () => {
    m.get.mockResolvedValue({ data: () => ({ isAdmin: true }) });
    const r = await request(app()).get('/admin/private').set('Authorization','Bearer owner');
    expect(r.status).toBe(200); expect(r.headers['cache-control']).toBe('private, no-store'); expect(m.verify).toHaveBeenCalledTimes(1);
  });
  it('uses explicit owner configuration without granting everyone access when it is empty', () => {
    expect(configuredAdminIds(' owner, ,other ')).toEqual(['owner','other']);
    expect(hasAdminAccess('visitor', undefined, configuredAdminIds(undefined))).toBe(false);
    expect(hasAdminAccess('owner', undefined, configuredAdminIds('owner'))).toBe(true);
    expect(hasAdminAccess(undefined, { isAdmin: true }, [])).toBe(false);
  });
});
