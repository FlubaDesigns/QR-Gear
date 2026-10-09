import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createGrfRegistrar } from '../grf-store';
import { registerGrfRoutes } from '../admin-grf-routes';
import { decodeVideoUpload } from '../video-validation';
import { GRF_VIDEO_MAX_BYTES, videoGrfParams, validateVideoUpload, parseGrfId } from '../../../../shared/GRF_engine';
function fixture() {
  const docs = new Map<string, any>();
  const files = new Map<string, { bytes: Buffer; mime: string }>();
  const ref = (path: string): any => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }), set: async (value: any) => docs.set(path, value) });
  let tail = Promise.resolve();
  const db: any = {
    collection: (collection: string) => ({ doc: (id: string) => ref(`${collection}/${id}`), where: (field: string, _op: string, value: any) => ({ get: async () => ({ docs: [...docs.entries()].filter(([path, data]) => path.startsWith(collection + '/') && data[field] === value).map(([, data]) => ({ data: () => data })) }) }) }),
    runTransaction: (fn: any) => {
      const run = tail.then(() => fn({ get: (r: any) => r.get(), set: (r: any, value: any) => docs.set(r.path, { ...docs.get(r.path), ...value }), create: (r: any, value: any) => { if (docs.has(r.path)) throw new Error('collision'); docs.set(r.path, value); } }));
      tail = run.catch(() => {}); return run;
    },
  };
  const registrar = createGrfRegistrar({ db, now: () => 'now', bucket: () => ({ name: 'test', file: (path: string) => ({ save: async (bytes: Buffer, opts: any) => files.set(path, { bytes: Buffer.from(bytes), mime: opts.metadata.contentType }), makePublic: async () => {} }) }) });
  return { ...registrar, docs, files };
}

const mp4 = Buffer.from([0,0,0,24, ...Buffer.from('ftypisom'), 0,0,0,0, ...Buffer.from('isommp42')]);
const webm = Buffer.from([0x1a,0x45,0xdf,0xa3, ...Buffer.from('webm')]);
const uri = (bytes: Buffer, mime: string) => `data:${mime};base64,${bytes.toString('base64')}`;
describe('Video library shared upload contract', () => {
  it.each([['video/mp4', mp4, '1'], ['video/webm', webm, '2']] as const)('registers %s with the correct identity and unchanged bytes', async (mimeType, bytes, format) => {
    const f = fixture();
    const params = validateVideoUpload(mimeType, bytes.length);
    const input = { ...params, ...decodeVideoUpload(uri(bytes, mimeType), mimeType), name: 'Clip' };
    const first = await f.registerGrfAsset(input); const second = await f.registerGrfAsset(input);
    expect(first.grfId).toBe(second.grfId); expect(parseGrfId(first.grfId).format).toBe(format);
    expect(f.files.size).toBe(1); expect([...f.files.values()][0]).toEqual({ bytes, mime: mimeType });
    expect(f.docs.get(`grf_assets/${first.grfId}`).registrationState).toBe('ready');
  });
  it('rejects MOV, empty files, and oversize files with the same browser policy', () => {
    expect(() => validateVideoUpload('video/quicktime', 100)).toThrow('Unsupported');
    expect(() => validateVideoUpload('video/mp4', 0)).toThrow('empty');
    expect(() => validateVideoUpload('video/mp4', GRF_VIDEO_MAX_BYTES + 1)).toThrow('20 MB');
    expect(validateVideoUpload('video/mp4', GRF_VIDEO_MAX_BYTES).format).toBe('1');
  });
  it('rejects wrong containers and format metadata before writing records or files', async () => {
    const f = fixture();
    await expect(f.registerGrfAsset({ ...videoGrfParams('video/mp4'), mimeType: 'video/mp4', imageData: webm.toString('base64') })).rejects.toThrow('bytes do not match');
    await expect(f.registerGrfAsset({ ...videoGrfParams('video/mp4'), mimeType: 'video/webm', imageData: webm.toString('base64') })).rejects.toThrow('MIME type');
    expect(f.docs.size).toBe(0); expect(f.files.size).toBe(0);
  });
  it('rejects MIME spoofing, malformed base64 and disguised MOV', () => {
    expect(() => decodeVideoUpload(uri(mp4, 'video/webm'), 'video/mp4')).toThrow('upload type');
    expect(() => decodeVideoUpload('%%%=', 'video/mp4')).toThrow('encoding');
    const mov = Buffer.from(mp4); mov.write('qt  ', 8);
    expect(() => decodeVideoUpload(uri(mov, 'video/mp4'), 'video/mp4')).toThrow('bytes do not match');
  });
  it('handles a file at the limit and rejects excess before storage', () => {
    const bytes = Buffer.alloc(GRF_VIDEO_MAX_BYTES); mp4.copy(bytes);
    expect(decodeVideoUpload(bytes.toString('base64'), 'video/mp4').mimeType).toBe('video/mp4');
    expect(() => decodeVideoUpload('A'.repeat(Math.ceil(GRF_VIDEO_MAX_BYTES / 3) * 4 + 4), 'video/mp4')).toThrow('20 MB');
  });
  it.each(['/admin', '/api/admin'])('enforces validation through the %s HTTP adapter', async prefix => {
    const app = express(); app.use(express.json()); const collection = vi.fn();
    registerGrfRoutes(app, prefix, (_req: any, _res: any, next: any) => next(), { db: () => ({ collection }), bucket: vi.fn(), now: () => 'now' });
    const res = await request(app).post(`${prefix}/graphics/save-grf`).send({ ...videoGrfParams('video/mp4'), mimeType: 'video/mp4', imageUrl: uri(webm, 'video/mp4') });
    expect(res.status).toBe(400); expect(res.body.error).toContain('bytes do not match'); expect(collection).not.toHaveBeenCalled();
  });
});
