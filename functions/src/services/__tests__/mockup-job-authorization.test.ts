import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, uid: 'member', generate: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a), batch: () => m.db.batch() }, admin: { auth: () => ({ verifyIdToken: async () => ({ uid: m.uid }) }), firestore: { FieldValue: { serverTimestamp: () => 'now' } } } }));
vi.mock('../mockup-generator', () => ({ generateMockupFromPrintful: m.generate }));
import { enqueueAuthorizedMockupJob, recheckMockupJob } from '../mockup-job-authorization';
import { processQueueInBackground } from '../../routes/file-routes';
import { register } from '../../routes/am-utility';
let store: Map<string, any>;
const payload = () => ({ productId: 'packet_p', colorName: 'Black', status: 'pending', jobData: { blueprintId: 5, printProviderId: 39, artworkUrl: 'https://fixture.invalid/art.png' } });
beforeEach(() => {
  vi.clearAllMocks(); m.uid = 'member'; const fixture = database({ 'users/member': {}, 'users/admin': { isAdmin: true }, 'productPackets/p': {} }); m.db = fixture.db; store = fixture.store;
  m.db.batch = () => { const writes: any[] = []; return { set: (r: any, d: any) => writes.push([r, d]), commit: async () => { for (const [r, d] of writes) await r.set(d); } }; };
  m.generate.mockResolvedValue({ mockupUrl: 'https://fixture.invalid/mockup.png' });
});
afterEach(() => vi.useRealTimers());
it('denies member batch intake and prioritization before touching the queue', async () => {
  const a = express(); a.use(express.json()); register(a);
  for (const path of ['/mockup-jobs/batch', '/mockup-jobs/prioritize']) {
    expect((await request(a).post(path).send({ jobs: [payload()], jobId: 'p' })).status).toBe(401);
    expect((await request(a).post(path).set('Authorization', 'Bearer valid').send({ jobs: [payload()], jobId: 'p' })).status).toBe(403);
  }
  expect([...store.keys()].some(k => k.startsWith('mockup_jobs/'))).toBe(false);
});
it('allows admin intake and creates a separate server-only target authorization', async () => {
  m.uid = 'admin'; const a = express(); a.use(express.json()); register(a);
  const result = await request(a).post('/mockup-jobs/batch').set('Authorization', 'Bearer valid').send({ jobs: [payload()] });
  expect(result.status).toBe(200); const id = result.body.created[0].id;
  expect(store.get(`mockup_jobs/${id}/authorization/v1`).uid).toBe('admin');
});
it('rejects old unapproved jobs even if the job itself claims to be admin-authorized', async () => {
  store.set('mockup_jobs/untrusted', { ...payload(), authorizedBy: 'admin', authorization: { uid: 'admin' } });
  await processQueueInBackground(); expect(m.generate).not.toHaveBeenCalled();
  expect(store.get('mockup_jobs/untrusted')).toMatchObject({ status: 'failed' }); expect(store.get('mockup_jobs/untrusted').error).toContain('not authorized');
});
it('rejects changed targets and revoked administrators before provider work', async () => {
  const ref = await enqueueAuthorizedMockupJob(payload(), 'admin');
  store.get(ref.path).productId = 'packet_victim'; await processQueueInBackground(); expect(m.generate).not.toHaveBeenCalled();
  const second = await enqueueAuthorizedMockupJob(payload(), 'admin'); store.set('users/admin', {});
  await expect(recheckMockupJob(second, payload())).rejects.toThrow('no longer has access');
});
it('processes approved unchanged jobs and verifies the destination before writeback', async () => {
  vi.useFakeTimers(); const ref = await enqueueAuthorizedMockupJob(payload(), 'admin');
  const running = processQueueInBackground(); await vi.runAllTimersAsync(); await running;
  expect(m.generate).toHaveBeenCalledTimes(1); expect(store.get(ref.path).status).toBe('completed');
  expect(store.get('productPackets/p').mockupsByColor.black.front.large).toBe('https://fixture.invalid/mockup.png');
});
