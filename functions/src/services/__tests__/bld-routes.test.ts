import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const store = vi.hoisted(() => new Map<string, any>());
vi.mock('../../core', () => {
  const ref = (path: string): any => ({
    path, id: path.split('/').slice(-1)[0],
    get: async () => ({ id: path.split('/').slice(-1)[0], exists: store.has(path), data: () => store.get(path) }),
    update: async (data: any) => store.set(path, { ...store.get(path), ...data }),
  });
  return {
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'timestamp' } } },
    db: {
      collection: (name: string) => ({
        doc: (id: string) => ref(`${name}/${id}`),
        orderBy: () => ({ get: async () => ({ docs: [...store.entries()].filter(([key]) => key.startsWith(`${name}/`)).map(([key, data]) => ({ id: key.split('/').slice(-1)[0], data: () => data })) }) }),
      }),
      runTransaction: async (fn: any) => fn({
        get: (r: any) => r.get(),
        set: (r: any, data: any) => store.set(r.path, { ...store.get(r.path), ...data }),
        create: (r: any, data: any) => store.set(r.path, data),
      }),
    },
  };
});
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
import { registerBld } from '../../routes/bld';

const app = express();
app.use(express.json());
registerBld(app);
beforeEach(() => store.clear());

describe('BLD HTTP save/load contract', () => {
  it('creates, lists, and loads U-context definitions using layoutMode', async () => {
    const create = await request(app).post('/admin/bld/create').send({ context: 'U', layoutMode: 'V', instances: [{ seq: '01', type: 'vid', playback: 'external', ratio: '16:9' }] });
    expect(create.status).toBe(200);
    expect(create.body.bldId).toBe('BLD-UV1-001');
    const list = await request(app).get('/admin/bld?context=U&layout=V');
    expect(list.body.definitions[0]).toMatchObject({ layoutMode: 'V', validationError: null });
    const load = await request(app).get('/admin/bld/BLD-UV1-001/instances');
    expect(load.status).toBe(200);
    expect(load.body.instances).toEqual([{ seq: '01', type: 'vid', playback: 'external', ratio: '16:9' }]);
  });

  it('saves builder structure without requiring or persisting QRG/packet identity', async () => {
    const result = await request(app).post('/admin/bld').send({ working: { graphics: { content: { graphicLayoutMode: 'zone', headerStyle: { enabled: true, text: 'Keep in Assembly', color: '#fff', fontFamily: 'Oswald' } } } } });
    expect(result.status).toBe(200);
    const saved = store.get(`bld_definitions/${result.body.bldId}`);
    expect(saved.instances).toEqual([{ seq: '01', type: 'qrc', size: 75 }, { seq: '02', type: 'txt', role: 'header', fontFamily: 'Oswald' }]);
    expect(saved).not.toHaveProperty('qrgBlankId');
  });

  it('returns a validation error before allocation when content is embedded', async () => {
    const result = await request(app).post('/admin/bld/create').send({ context: 'S', layoutMode: 'Z', instances: [{ seq: '01', type: 'txt', text: 'invalid here' }] });
    expect(result.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it('rejects an update that would make the encoded count lie', async () => {
    const create = await request(app).post('/admin/bld/create').send({ context: 'S', layoutMode: 'Z', instances: [{ seq: '01', type: 'qrc' }] });
    const update = await request(app).patch(`/admin/bld/${create.body.bldId}`).send({ instances: [{ seq: '01', type: 'qrc' }, { seq: '02', type: 'txt' }] });
    expect(update.status).toBe(400);
    expect(store.get(`bld_definitions/${create.body.bldId}`).instanceCount).toBe(1);
  });

  it('reports invalid beta records instead of converting them into valid inputs', async () => {
    store.set('bld_definitions/BLD-SZ1-001', { bldId: 'BLD-SZ1-001', context: 'S', layoutMode: 'Z', instanceCount: 1, instances: [{ seq: '01', type: 'txt', text: 'old embedded text' }] });
    const list = await request(app).get('/admin/bld');
    expect(list.body.definitions[0].validationError).toContain('text');
    expect((await request(app).get('/admin/bld/BLD-SZ1-001')).status).toBe(409);
  });
});
