import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { useCreatePacket } from '@/features/adminProducts/builder/modules/useCreatePacket';
import { GRAPHICS_QK, ORIGINALS_QK } from '@/features/adminLibrary/shared/grfQueryKeys';
const m = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), state: vi.fn(), begin: vi.fn(), finish: vi.fn(), client: null as any }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: m.api }));
vi.mock('@/lib/queryClient', () => ({ get queryClient() { return m.client; } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock('wouter', () => ({ useLocation: () => ['/', vi.fn()] }));
vi.mock('@/features/adminProducts/builder/BuilderContext', () => ({ useBuilderContext: () => ({ setActiveSession: m.state, beginBuildActivity: m.begin }) }));
vi.mock('@/features/shared/graphics/productGraphicRenderer', () => ({ renderProductGraphic: vi.fn() }));
vi.mock('@/features/shared/graphics/landingPageRenderer', () => ({ renderLandingPage: vi.fn() }));
vi.mock('@/features/shared/components/wizardSteps/wizardTypes', () => ({ generateQRCodeUrl: vi.fn() }));
let tree: ReactTestRenderer, hook: ReturnType<typeof useCreatePacket>;
const keys = [GRAPHICS_QK, ORIGINALS_QK, ['/api/admin/bld'], ['/api/admin/assemblies', 'channel=one']];
function Probe() {
  hook = useCreatePacket({ state: { activeSessionId: 'draft', sessionStatus: 'artifact_ready' }, selectedRole: null, selectedStore: null, selectedChannel: null, selectedCollection: null, loadGraphic: vi.fn(), resetBuilder: vi.fn(), pricingSettings: undefined });
  return null;
}
beforeEach(() => {
  vi.clearAllMocks(); m.client = new QueryClient(); m.begin.mockReturnValue(m.finish);
  keys.forEach(key => m.client.setQueryData(key, [])); m.client.setQueryData(['unrelated'], []);
  m.api.mockResolvedValue({ instanceId: 'instance', sessionId: 'draft', packetId: 'packet' });
});
afterEach(() => { if (tree) act(() => tree.unmount()); m.client.clear(); });
it('refreshes previously visited Library tabs after a successful commit and guards the handoff', async () => {
  await act(async () => { tree = create(React.createElement(Probe)); });
  await act(async () => { await hook.handleCommitSession(); });
  keys.forEach(key => expect(m.client.getQueryState(key)?.isInvalidated).toBe(true));
  expect(m.client.getQueryState(['unrelated'])?.isInvalidated).toBe(false);
  expect(m.begin).toHaveBeenCalledOnce(); expect(m.finish).toHaveBeenCalledOnce();
  expect(m.state).toHaveBeenCalledWith('draft', 'committed', 'instance');
});
it('retains the draft and releases the activity guard when commit fails', async () => {
  m.api.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => { tree = create(React.createElement(Probe)); });
  await act(async () => { await hook.handleCommitSession(); });
  expect(m.state).not.toHaveBeenCalled(); expect(m.finish).toHaveBeenCalledOnce();
  expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Commit Failed' }));
});
it('does not commit while a different builder activity owns the guard', async () => {
  m.begin.mockImplementationOnce(() => { throw new Error('Busy'); });
  await act(async () => { tree = create(React.createElement(Probe)); });
  await act(async () => { await hook.handleCommitSession(); });
  expect(m.api).not.toHaveBeenCalled();
});
