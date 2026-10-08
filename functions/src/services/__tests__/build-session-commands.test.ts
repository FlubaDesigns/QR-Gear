import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const m = vi.hoisted(() => ({ collection: vi.fn(), add: vi.fn(), update: vi.fn(), batchUpdate: vi.fn(), sessions: [] as any[], masterExists: true, saved: {} as any }));
vi.mock('../../core', () => ({ db: { collection: m.collection, batch: () => ({ update: m.batchUpdate, commit: async () => {} }) }, storage: {} }));
vi.mock('../../middleware', () => ({ requireAdmin: (req: any, _res: any, next: any) => { req.user = { uid: 'owner' }; next(); } }));
vi.mock('../../services/composite-image', () => ({}));
vi.mock('../../services/qrg-instance-allocator', () => ({}));
vi.mock('../../services/bld-builder', () => ({}));
vi.mock('../../services/assembly-store', () => ({}));
vi.mock('../../services/build-session-state', () => ({}));
import { registerAdminBuildSessions } from '../../routes/admin-build-sessions';
const app = express(); app.use(express.json()); registerAdminBuildSessions(app);
const snapshot = () => ({ graphics: { content: { graphicLayoutMode: 'freeform', url: 'Template text' } }, qrConfig: {},
  layoutConfig: { selectedPlacements: [] }, metadata: { selectedProductDocId: 'qrg_11001', fulfillmentProvider: 'printful' } });
beforeEach(() => {
  vi.clearAllMocks(); m.masterExists = true; m.saved = { status: 'working' };
  m.sessions = [{ id: 'old', data: () => ({ status: 'working', working: { title: 'Keep me' }, draftName: 'Saved draft' }), ref: { update: m.update } }];
  m.add.mockImplementation(async (data: any) => { m.saved = data; return { id: 'new' }; });
  m.collection.mockImplementation((name: string) => {
    const query: any = { where: () => query, limit: () => query, get: async () => ({ docs: m.sessions, size: m.sessions.length }), add: m.add,
      doc: () => ({ get: async () => name === 'master_catalog'
        ? { exists: m.masterExists, id: 'qrg_11001', data: () => ({ title: 'Shirt', qrgBlankId: '11001' }) }
        : { exists: true, data: () => m.saved }, update: m.update }) };
    return query;
  });
});
afterEach(() => vi.unstubAllEnvs());
describe('production build-session command routes', () => {
  it('preserves select-to-resume behavior for existing callers', async () => {
    const res = await request(app).post('/admin/build-sessions/from-master').send({ sourceMasterId: 'qrg_11001' });
    expect(res.status).toBe(200); expect(res.body.sessionId).toBe('old'); expect(res.body.isExisting).toBe(true); expect(m.add).not.toHaveBeenCalled();
  });
  it('New creates a fresh draft for the same QRG blank without modifying the old one', async () => {
    const res = await request(app).post('/admin/build-sessions/from-master').send({ sourceMasterId: 'qrg_11001', forceNew: true });
    expect(res.status).toBe(200); expect(res.body.sessionId).toBe('new'); expect(res.body.isExisting).toBe(false);
    expect(m.saved.status).toBe('working'); expect(m.saved.generated.packetId).toBeNull(); expect(m.update).not.toHaveBeenCalled();
  });
  it('atomically seeds a new template draft with its canonical working snapshot', async () => {
    const res = await request(app).post('/admin/build-sessions/from-master').send({ sourceMasterId: 'qrg_11001', forceNew: true, initialWorking: snapshot() });
    expect(res.status).toBe(200); expect(m.saved.working.graphics.content.url).toBe('Template text');
    expect(m.saved.working.metadata.fulfillmentProvider).toBe('printful'); expect(m.update).not.toHaveBeenCalled();
  });
  it.each([{ forceNew: false, initialWorking: snapshot() }, { forceNew: true, initialWorking: {} },
    { forceNew: true, initialWorking: { ...snapshot(), metadata: { selectedProductDocId: 'qrg_11002' } } }, { forceNew: 'yes' }])('rejects invalid creation input without writing', async payload => {
    const res = await request(app).post('/admin/build-sessions/from-master').send({ sourceMasterId: 'qrg_11001', ...payload });
    expect(res.status).toBe(400); expect(m.add).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it('returns a missing-master error instead of claiming template success', async () => {
    m.masterExists = false;
    const res = await request(app).post('/admin/build-sessions/from-master').send({ sourceMasterId: 'qrg_11001', forceNew: true });
    expect(res.status).toBe(404); expect(m.add).not.toHaveBeenCalled();
  });
  it('saves content and a trimmed persistent name', async () => {
    const res = await request(app).patch('/admin/build-sessions/old').send({ working: snapshot(), draftName: '  Keep this  ' });
    expect(res.status).toBe(200); expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ draftName: 'Keep this', expiresAt: null, working: expect.objectContaining({ graphics: snapshot().graphics }) }));
  });
  it('keeps named drafts during stale-session cleanup', async () => {
    m.sessions.push({ data: () => ({ status: 'working', draftName: null }), ref: { id: 'unnamed' } });
    const res = await request(app).post('/admin/build-sessions/cleanup');
    expect(res.status).toBe(200); expect(res.body.cleaned).toBe(1); expect(m.batchUpdate).toHaveBeenCalledWith({ id: 'unnamed' }, { status: 'abandoned' });
  });
  it('still blocks content writes to committed sessions', async () => {
    m.saved.status = 'committed';
    const res = await request(app).patch('/admin/build-sessions/old').send({ working: snapshot(), draftName: 'Not yet' });
    expect(res.status).toBe(409); expect(m.update).not.toHaveBeenCalled();
  });
});

describe('persistent sandbox drafts', () => {
  it('keeps unnamed new drafts without expiration', async () => {
    vi.stubEnv('QRGEAR_ENVIRONMENT', 'sandbox');
    const res = await request(app).post('/admin/build-sessions/from-master').send({ sourceMasterId: 'qrg_11001', forceNew: true });
    expect(res.status).toBe(200); expect(m.saved.expiresAt).toBeNull();
  });
  it('clears old expiration when a draft is autosaved', async () => {
    vi.stubEnv('QRGEAR_ENVIRONMENT', 'sandbox');
    const res = await request(app).patch('/admin/build-sessions/old').send({ working: snapshot() });
    expect(res.status).toBe(200); expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: null }));
  });
  it('rejects age-based cleanup without changing any draft', async () => {
    vi.stubEnv('QRGEAR_ENVIRONMENT', 'sandbox');
    const res = await request(app).post('/admin/build-sessions/cleanup');
    expect(res.status).toBe(409); expect(m.batchUpdate).not.toHaveBeenCalled();
  });
});
