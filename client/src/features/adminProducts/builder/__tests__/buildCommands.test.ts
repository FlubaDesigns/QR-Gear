import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BuilderProvider, useBuilderContext } from '../BuilderContext';
const m = vi.hoisted(() => ({ api: vi.fn(), context: {} as any, fetch: vi.fn() }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: m.api }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} } }));
vi.mock('../../ProductsContext', () => ({ useProductsContext: () => m.context }));
let value: ReturnType<typeof useBuilderContext>, tree: ReactTestRenderer;
function Probe() { value = useBuilderContext(); return null; }
function Harness() {
  const [selectedProviders, setSelectedProviders] = React.useState(['printful']);
  m.context = { ...m.context, selectedProviders, setSelectedProviders };
  return React.createElement(BuilderProvider, null, React.createElement(Probe));
}
const product = { docId: 'qrg_11001', qrgBlankId: '11001', title: 'Shirt', id: 71, blueprintId: 71, printfulId: 99,
  fulfillmentProvider: 'both', providerMappings: { printify: { blueprintId: 71 }, printful: { productId: 99 } } };
const working = () => ({ graphics: { content: { graphicLayoutMode: 'freeform', url: 'saved content' } },
  qrConfig: { qrProductState: 'qr_basics' }, layoutConfig: { selectedPlacements: [], placementConfig: {}, placementSizes: {}, placementMethods: {} },
  metadata: { selectedProductDocId: 'qrg_11001', fulfillmentProvider: 'printful', selectedRole: 'internal', selectedStore: { id: 'shop' }, selectedChannel: { id: 'channel', storeId: 'shop' }, selectedCollection: { name: 'Folder' } } });
function deferred() { let resolve!: (v?: any) => void, reject!: (e: Error) => void; const promise = new Promise<any>((y,n) => { resolve=y; reject=n; }); return { promise, resolve, reject }; }
async function mount() { await act(async () => { tree = create(React.createElement(Harness)); }); }
async function active() { await act(async () => { value.loadFromWorkingState(working(), { ...product, fulfillmentProvider: 'printful' } as any); value.setActiveSession('old', 'working', null, 'Old draft'); value.setContent({ url: 'latest edit' }); }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() }); vi.stubGlobal('fetch', m.fetch);
  m.context = { api: {}, selectedRole: null, selectedStore: null, selectedChannel: null, selectedCollection: null,
    setSelectedRole: vi.fn(), setSelectedStore: vi.fn(), setSelectedChannel: vi.fn(), setSelectedCollection: vi.fn() };
  m.fetch.mockResolvedValue({ ok: true, json: async () => [{ items: [product] }] });
  m.api.mockImplementation(async (path: string, options?: any) => {
    if (path.includes('/options?')) return { availableColors: [], availableSizes: [], printLocations: [] };
    if (path === '/build-sessions/from-master') return { sessionId: 'new' };
    if (options?.method === 'PATCH') return { success: true };
    if (path === '/build-sessions/saved') return { session: { id: 'saved', status: 'working', sourceMasterId: product.docId, draftName: 'Saved draft', working: working() } };
    throw new Error('Unexpected request '+path);
  });
});
afterEach(() => { if (tree) act(() => tree.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('safe builder commands', () => {
  it('New waits for the latest edit to save, then clears the build and requests a fresh session with the same supplier', async () => {
    await mount(); await active(); const pending = deferred();
    m.api.mockImplementationOnce(() => pending.promise);
    let action!: Promise<void>;
    await act(async () => { action = value.resetBuilder(); });
    expect(value.state.activeSessionId).toBe('old'); expect(value.busy).toBeTruthy();
    expect(m.api.mock.calls.at(-1)?.[1].json.working.graphics.content.url).toBe('latest edit');
    await act(async () => { pending.resolve(); await action; });
    expect(value.state.activeSessionId).toBeNull(); expect(value.state.selectedProduct).toBeNull();
    expect(value.state.forceNewSession).toBe(true); expect(value.state.fulfillmentProvider).toBe('printful'); expect(value.state.draftName).toBeNull();
  });
  it('keeps the draft if saving fails and blocks double commands', async () => {
    await mount(); await active(); const pending = deferred(); m.api.mockImplementationOnce(() => pending.promise);
    let action!: Promise<void>; await act(async () => { action = value.resetBuilder(); });
    await expect(value.resumeSession('saved')).rejects.toThrow('wait');
    await act(async () => { pending.reject(new Error('Save failed')); await expect(action).rejects.toThrow('Save failed'); });
    expect(value.state.activeSessionId).toBe('old'); expect(value.state.content.url).toBe('latest edit'); expect(value.busy).toBeNull();
  });
  it('Resume saves current edits, restores named drafts in place, and requests the saved supplier options', async () => {
    await mount(); await active(); await act(async () => { await value.resumeSession('saved'); });
    expect(value.state.activeSessionId).toBe('saved'); expect(value.state.draftName).toBe('Saved draft'); expect(value.state.content.url).toBe('saved content');
    expect(value.state.selectedProduct?.blueprintId).toBe(99);
    const calls = m.api.mock.calls.map(c => c[0]); expect(calls.indexOf('/build-sessions/old')).toBeLessThan(calls.indexOf('/build-sessions/saved'));
    expect(calls).toContain('/master-catalog/products/qrg_11001/options?provider=printful');
    expect(m.context.setSelectedChannel).toHaveBeenCalledWith({ id: 'channel', storeId: 'shop' });
  });
  it('Templates persist their snapshot in a fresh session without overwriting the prior draft', async () => {
    await mount(); await active(); await act(async () => { await value.startFromTemplate({ packet: { builderSnapshot: working() } }); });
    const create = m.api.mock.calls.find(c => c[0] === '/build-sessions/from-master')!;
    expect(create[1].json).toMatchObject({ forceNew: true, sourceMasterId: product.docId, initialWorking: { metadata: { selectedProductDocId: product.docId, selectedProductBlueprintId: 99 } } });
    expect(value.state.activeSessionId).toBe('new'); expect(value.state.activePacketId).toBeNull(); expect(value.state.draftName).toBeNull();
    expect(m.api.mock.calls.filter(c => c[0] === '/build-sessions/old')).toHaveLength(1);
  });
  it('uses the saved template snapshot even if its old packet is no longer available', async () => {
    await mount();
    await act(async () => { await value.startFromTemplate({ builderSnapshot: working(), packetId: 'deleted-packet' }); });
    expect(value.state.activeSessionId).toBe('new'); expect(value.state.content.url).toBe('saved content');
    expect(m.api.mock.calls.some(c => c[0] === '/packets/deleted-packet')).toBe(false);
  });
  it('keeps the old build on template creation or catalog failures and rejects incomplete templates before writing a session', async () => {
    await mount(); await active();
    await act(async () => { await expect(value.startFromTemplate({ packet: {} })).rejects.toThrow('incomplete'); });
    expect(m.api.mock.calls.some(c => c[0] === '/build-sessions/from-master')).toBe(false);
    m.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await act(async () => { await expect(value.startFromTemplate({ packet: { builderSnapshot: working() } })).rejects.toThrow('503'); });
    const implementation = m.api.getMockImplementation()!;
    m.api.mockImplementation((p: string, o: any) => p === '/build-sessions/from-master' ? Promise.reject(new Error('Create failed')) : implementation(p,o));
    await act(async () => { await expect(value.startFromTemplate({ packet: { builderSnapshot: working() } })).rejects.toThrow('Create failed'); });
    expect(value.state.activeSessionId).toBe('old'); expect(value.state.content.url).toBe('latest edit');
  });
  it('shares a guarded full-snapshot save and keeps its name tied to the active session', async () => {
    await mount(); await active(); await act(async () => { await value.saveDraft('  Named draft  '); });
    expect(m.api.mock.calls.find(c => c[1]?.json?.draftName)?.[1].json).toMatchObject({ draftName: 'Named draft', working: { graphics: { content: { url: 'latest edit' } } } });
    expect(value.state.draftName).toBe('Named draft');
    await act(async () => { value.setActiveSession('committed', 'committed', 'instance'); });
    await expect(value.saveDraft('No')).rejects.toThrow('Update Saved Item');
    expect(value.state.draftName).toBeNull();
  });
  it('does not allow a late restore to install after the builder unmounts', async () => {
    await mount(); const pending = deferred(); m.fetch.mockReturnValueOnce(pending.promise);
    let action!: Promise<void>; await act(async () => { action = value.resumeSession('saved'); });
    const optionCalls = m.api.mock.calls.filter(c => c[0].includes('/options?')).length;
    act(() => tree.unmount());
    await act(async () => { pending.resolve({ ok: true, json: async () => [{ items: [product] }] }); await action; });
    expect(m.api.mock.calls.filter(c => c[0].includes('/options?'))).toHaveLength(optionCalls);
  });
});
