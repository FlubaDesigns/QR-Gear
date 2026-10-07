import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminVideosPage from '@/pages/admin-videos';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn(), invalidate: vi.fn(), assets: [] as any[] }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'owner' } }) }));
vi.mock('wouter', () => ({ useLocation: () => ['', vi.fn()] }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: mocks.fetch }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mocks.assets }), useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('@/components/AdminShell', () => ({ default: ({ children, actions }: any) => React.createElement('main', null, actions, children) }));
vi.mock('@/components/admin/AdminSectionSubNav', () => ({ default: () => null }));
vi.mock('@/features/shared/components/DeleteBuildDialog', () => ({ DeleteBuildDialog: 'delete-dialog', PendingAssetDeletions: 'pending-cleanup' }));
vi.mock('@/components/ui/dialog', () => ({ Dialog: ({ open, children, ...props }: any) => React.createElement('dialog', props, open ? children : null), DialogContent: 'dialog-content', DialogHeader: 'dialog-header', DialogTitle: 'dialog-title', DialogFooter: 'dialog-footer', DialogClose: 'dialog-close' }));
let tree: ReactTestRenderer;
const get = (id: string) => tree.root.findAll(node => node.props['data-testid'] === id).at(-1)!;
const choose = (type = 'video/mp4', size = 24) => act(() => get('input-video-file').props.onChange({ target: { files: [{ type, size, name: 'clip.mp4' }], value: 'clip.mp4' } }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.assets = []; mocks.fetch.mockResolvedValue({ success: true });
  vi.stubGlobal('FileReader', class { result = 'data:video/mp4;base64,AAAA'; onload: any; readAsDataURL() { this.onload(); } });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { if (tree) act(() => tree.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const open = () => { act(() => { tree = create(React.createElement(AdminVideosPage)); }); act(() => get('button-add-video').props.onClick()); };
describe('Videos upload and mobile lifecycle', () => {
  it('rejects MOV and oversize selection without sending requests', () => {
    open(); choose('video/quicktime'); choose('video/mp4', 21 * 1024 * 1024);
    expect(mocks.toast).toHaveBeenCalledTimes(2); expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('releases temporary previews on replacement, close, and unmount', () => {
    open(); choose(); choose(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    act(() => tree.root.findByType('dialog').props.onOpenChange(false)); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    act(() => get('button-add-video').props.onClick()); choose(); act(() => tree.unmount()); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });
  it('uses the shared GRF payload and refreshes library data after upload', async () => {
    open(); choose(); act(() => get('input-video-name').props.onChange({ target: { value: 'Clip' } }));
    await act(async () => get('button-save-video').props.onClick());
    expect(mocks.fetch).toHaveBeenCalledWith('/graphics/save-grf', expect.objectContaining({ json: expect.objectContaining({ assetClass: '1', mediaType: '2', channel: '3', purpose: '2', format: '1', name: 'Clip' }) }));
    expect(mocks.invalidate).toHaveBeenCalledOnce(); expect(tree.root.findAllByType('dialog-content')).toHaveLength(0);
  });
  it('keeps failed uploads open for correction and retry', async () => {
    mocks.fetch.mockRejectedValue(new Error('Storage unavailable')); open(); choose();
    act(() => get('input-video-name').props.onChange({ target: { value: 'Clip' } }));
    await act(async () => get('button-save-video').props.onClick());
    expect(get('button-save-video').props.disabled).toBe(false); expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed', description: 'Storage unavailable' }));
  });
  it('offers touch playback, a left close button, and the existing deletion/cleanup controls', () => {
    mocks.assets = [{ grfId: 'GRF-12321-000001', name: 'Clip', publicUrl: 'https://example.com/clip.mp4', mimeType: 'video/mp4' }];
    act(() => { tree = create(React.createElement(AdminVideosPage)); });
    expect(tree.root.findByType('video').props.controls).toBe(true); expect(tree.root.findByType('video').props.playsInline).toBe(true);
    act(() => get('button-view-video-GRF-12321-000001').props.onClick());
    expect(get('button-close-video').props.className).toContain('left-3'); expect(get('button-close-video').props.className).toContain('h-12');
    expect(get('input-video-name').props.readOnly).toBe(true); expect(tree.root.findAll(node => node.props['data-testid'] === 'button-save-video')).toHaveLength(0);
    act(() => tree.root.findByType('dialog').props.onOpenChange(false)); act(() => get('button-delete-video-GRF-12321-000001').props.onClick());
    expect(tree.root.findByType('delete-dialog' as any).props.target).toEqual({ kind: 'graphics', id: 'GRF-12321-000001' });
    expect(tree.root.findAllByType('pending-cleanup' as any)).toHaveLength(1);
  });
});
