import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerFontRoutes } from '../font-settings';
import { DEFAULT_FONTS } from '../../../../shared/fonts';
function fixture(prefix: string, initial: any = { fonts: ['Georgia', 'Oswald'] }) {
  let saved = initial;
  const get = vi.fn(async () => ({ exists: saved !== null, data: () => saved }));
  const set = vi.fn(async (data: any) => { saved = data; });
  const doc = vi.fn(() => ({ get, set })); const collection = vi.fn(() => ({ doc }));
  const app = express(); app.use(express.json());
  registerFontRoutes(app, prefix, (req: any, res: any, next: any) => req.headers.authorization === 'owner' ? next() : res.status(401).end(), () => ({ collection }));
  return { app, get, set, doc, collection };
}
describe.each(['', '/api'])('Font settings adapter %s', prefix => {
  it('reads and saves the production-authoritative record and preserves order', async () => {
    const f = fixture(prefix);
    expect((await request(f.app).get(`${prefix}/fonts`)).body.fonts).toEqual(['Georgia', 'Oswald']);
    const result = await request(f.app).put(`${prefix}/admin/fonts`).set('Authorization', 'owner').send({ fonts: [' oswald ', 'arial', 'Arial'], injected: true });
    expect(result.status).toBe(200); expect(result.body.fonts).toEqual(['Oswald', 'Arial']);
    expect(f.collection).toHaveBeenCalledWith('config'); expect(f.doc).toHaveBeenCalledWith('fonts');
    expect(f.set.mock.calls[0][0]).toEqual({ fonts: ['Oswald', 'Arial'], updatedAt: expect.any(String) });
    expect((await request(f.app).get(`${prefix}/fonts`)).body.fonts).toEqual(['Oswald', 'Arial']);
  });
  it('uses defaults only for a missing record, never for failed reads', async () => {
    const f = fixture(prefix, null);
    expect((await request(f.app).get(`${prefix}/fonts`)).body.fonts).toEqual(DEFAULT_FONTS);
    f.get.mockRejectedValueOnce(new Error('Offline'));
    const failed = await request(f.app).get(`${prefix}/fonts`);
    expect(failed.status).toBe(500); expect(failed.body).toEqual({ error: 'Offline' });
  });
  for (const fonts of [[], [''], ['Not a real font'], [12], 'Arial']) it(`rejects ${JSON.stringify(fonts)} without writing`, async () => {
    const f = fixture(prefix);
    expect((await request(f.app).put(`${prefix}/admin/fonts`).set('Authorization', 'owner').send({ fonts })).status).toBe(400);
    expect(f.set).not.toHaveBeenCalled();
  });
  it('retains authentication and exposes write failures', async () => {
    const f = fixture(prefix);
    expect((await request(f.app).put(`${prefix}/admin/fonts`).send({ fonts: ['Arial'] })).status).toBe(401);
    f.set.mockRejectedValueOnce(new Error('Write failed'));
    expect((await request(f.app).put(`${prefix}/admin/fonts`).set('Authorization', 'owner').send({ fonts: ['Arial'] })).status).toBe(500);
  });
  it('reports a corrupt saved record instead of substituting defaults', async () => {
    const f = fixture(prefix, { fonts: 'bad' }); expect((await request(f.app).get(`${prefix}/fonts`)).status).toBe(500);
  });
});
