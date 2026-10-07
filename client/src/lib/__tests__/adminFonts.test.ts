import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import AdminFonts from '@/pages/admin-fonts';
import { FONTS_QUERY_KEY, DEFAULT_FONTS } from '@shared/fonts';
const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn(), load: vi.fn() }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: mocks.save }));
vi.mock('@/lib/fontLoader', () => ({ loadGoogleFont: mocks.load, loadGoogleFonts: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/AdminShell', () => ({ default: ({ children, actions }: any) => React.createElement('main', null, actions, children) }));
vi.mock('@/components/admin/AdminSectionSubNav', () => ({ default: () => null }));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: any) => React.createElement('div', null, children) }));
let tree: ReactTestRenderer, client: QueryClient;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const get = (id: string) => tree.root.findAll(node => node.props['data-testid'] === id).at(-1)!;
const shown = (font: string) => tree.root.findAll(node => node.props['data-testid'] === `font-item-${font.toLowerCase()}`).length > 0;
async function mount(fonts: string[] | null = ['Arial', 'Georgia']) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (fonts) client.setQueryData(FONTS_QUERY_KEY, { fonts });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(AdminFonts))); await flush(); });
}
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue(undefined); mocks.save.mockImplementation((_url, options) => Promise.resolve({ success: true, fonts: options.json.fonts })); });
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); vi.unstubAllGlobals(); });
describe('Fonts management saved source and editing', () => {
  it('saves ordered edits and updates the cache used by the text editor', async () => {
    await mount(); act(() => get('button-move-up-georgia').props.onClick());
    await act(async () => { get('button-save-fonts').props.onClick(); await flush(); });
    expect(mocks.save).toHaveBeenCalledWith('/fonts', { method: 'PUT', json: { fonts: ['Georgia', 'Arial'] } });
    expect(client.getQueryData(FONTS_QUERY_KEY)).toEqual({ fonts: ['Georgia', 'Arial'] });
    expect(get('button-save-fonts').props.disabled).toBe(true);
  });
  it('does not let a refreshed query replace unsaved edits', async () => {
    await mount(); act(() => get('button-remove-georgia').props.onClick());
    await act(async () => { client.setQueryData(FONTS_QUERY_KEY, { fonts: ['Arial', 'Georgia', 'Oswald'] }); await flush(); });
    expect(shown('Georgia')).toBe(false); expect(shown('Oswald')).toBe(false); expect(get('button-save-fonts').props.disabled).toBe(false);
  });
  it('locks duplicate saves and edits during a pending save', async () => {
    let finish: any; mocks.save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await mount(); act(() => get('button-remove-georgia').props.onClick());
    await act(async () => { const save = get('button-save-fonts').props.onClick; save(); save(); await flush(); });
    expect(mocks.save).toHaveBeenCalledOnce(); expect(get('button-reset-fonts').props.disabled).toBe(true);
    act(() => get('button-reset-fonts').props.onClick());
    await act(async () => { finish({ success: true, fonts: ['Arial'] }); await flush(); });
    expect(shown('Georgia')).toBe(false); expect(client.getQueryData(FONTS_QUERY_KEY)).toEqual({ fonts: ['Arial'] });
  });
  it('keeps failed saves dirty and supports retry', async () => {
    mocks.save.mockRejectedValueOnce(new Error('Offline')); await mount(); act(() => get('button-remove-georgia').props.onClick());
    await act(async () => { get('button-save-fonts').props.onClick(); await flush(); });
    expect(get('button-save-fonts').props.disabled).toBe(false); expect(shown('Georgia')).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Save failed' }));
    await act(async () => { get('button-save-fonts').props.onClick(); await flush(); });
    expect(get('button-save-fonts').props.disabled).toBe(true);
  });
  it('uses the shared defaults, touch previews and left-hand 48px removal', async () => {
    await mount(); expect(mocks.load).toHaveBeenCalledWith('Arial');
    expect(get('button-remove-georgia').props.className).toContain('order-first h-12 w-12');
    act(() => get('button-reset-fonts').props.onClick());
    await act(async () => { get('button-save-fonts').props.onClick(); await flush(); });
    expect((client.getQueryData(FONTS_QUERY_KEY) as any).fonts).toEqual(DEFAULT_FONTS);
  });
  it('shows a read error and disables saving instead of showing defaults', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Offline' }) }));
    await mount(null); await act(async () => { await flush(); await flush(); });
    expect(tree.root.findByProps({ role: 'alert' }).findByType('p').children.join('')).toBe('Could not load font settings: Offline'); expect(shown('Arial')).toBe(false); expect(get('button-save-fonts').props.disabled).toBe(true);
  });
});
