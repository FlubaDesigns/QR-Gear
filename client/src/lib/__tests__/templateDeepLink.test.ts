import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DraftResumeHandler } from '@/features/adminProducts/builder/modules/DraftResumeHandler';
const m = vi.hoisted(() => ({ start: vi.fn(), resume: vi.fn(), fetch: vi.fn(), toast: vi.fn(), replace: vi.fn() }));
vi.mock('wouter', () => ({ useSearch: () => '?template=chosen' }));
vi.mock('@/features/adminProducts/builder/BuilderContext', () => ({ useBuilderContext: () => ({ resumeSession: m.resume, startFromTemplate: m.start }) }));
vi.mock('@/features/shared/templateLibrary', () => ({ fetchTemplateLibrary: m.fetch }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
let tree: ReactTestRenderer | undefined;
const chosen = { id: 'chosen', packetId: null, builderSnapshot: { saved: true } };
beforeEach(() => {
  vi.clearAllMocks(); m.fetch.mockResolvedValue([{ id: 'other' }, chosen]); m.start.mockResolvedValue(undefined);
  vi.stubGlobal('window', { location: { href: 'https://example.com/admin/products?template=chosen' }, history: { replaceState: m.replace } });
});
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; vi.unstubAllGlobals(); });
async function mount() { await act(async () => { tree = create(React.createElement(DraftResumeHandler)); }); }
describe('template Library link', () => {
  it('passes the selected saved template to the existing builder command exactly once', async () => {
    await mount(); expect(m.start).toHaveBeenCalledExactlyOnceWith(chosen); expect(m.resume).not.toHaveBeenCalled();
    expect(m.replace).toHaveBeenCalledWith({}, '', '/admin/products');
    await act(async () => tree!.update(React.createElement(DraftResumeHandler)));
    expect(m.start).toHaveBeenCalledOnce();
  });
  it('does not open a different template or treat the ID as a packet when missing', async () => {
    m.fetch.mockResolvedValue([{ id: 'other' }]); await mount();
    expect(m.start).not.toHaveBeenCalled(); expect(m.resume).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
    expect(tree!.root.findByProps({ role: 'alert' })).toBeTruthy();
  });
  it('keeps failed loading retryable and clears the link only after success', async () => {
    m.start.mockRejectedValueOnce(new Error('Could not save current draft')); await mount();
    expect(m.replace).not.toHaveBeenCalled();
    await act(async () => tree!.root.findByType('button').props.onClick());
    expect(m.start).toHaveBeenCalledTimes(2); expect(m.replace).toHaveBeenCalledOnce();
  });
});
