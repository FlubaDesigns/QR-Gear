import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteBuildDialog } from '@/features/shared/components/DeleteBuildDialog';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), invalidate: vi.fn(), toast: vi.fn(), pending: false, options: null as any, loading: false, refetch: vi.fn(), preview: { token: "reviewed", targets: [{ path: "grf_assets/asset", id: "asset", kind: "grf_assets", name: "Asset" }], retained: [], fileCount: 1, buildCount: 0 } }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: mocks.fetch }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mocks.preview, isFetching: mocks.loading, refetch: mocks.refetch }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  useMutation: (options: any) => { mocks.options = options; return { isPending: mocks.pending, mutate: (id: string) => options.mutationFn(id) }; },
}));
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: 'dialog', AlertDialogAction: 'confirm', AlertDialogCancel: 'cancel', AlertDialogContent: 'content',
  AlertDialogDescription: 'description', AlertDialogFooter: 'footer', AlertDialogHeader: 'header', AlertDialogTitle: 'title',
}));
function element(node: any, type: string): any {
  if (!node || typeof node !== "object") return undefined;
  if (node?.type === type) return node;
  for (const child of [node?.props?.children].flat()) { const found = element(child, type); if (found) return found; }
}
beforeEach(() => { vi.clearAllMocks(); mocks.pending = false; mocks.loading = false; mocks.fetch.mockResolvedValue({ success: true }); });
describe('shared library deletion confirmation', () => {
  it('requires a finished impact check before enabling deletion', () => {
    mocks.loading = true;
    const tree = DeleteBuildDialog({ target: { kind: 'graphics', id: 'GRF-11431-000012' }, onClose: vi.fn() });
    expect(element(tree, 'confirm').props.disabled).toBe(true);
  });
  it('does not send a request when opened or canceled', () => {
    const onClose = vi.fn(); const tree = DeleteBuildDialog({ target: { kind: 'graphics', id: 'GRF-11431-000012' }, onClose });
    expect(mocks.fetch).not.toHaveBeenCalled(); tree.props.onOpenChange(false);
    expect(onClose).toHaveBeenCalledOnce(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('confirms the reviewed deletion plan and refreshes affected data', async () => {
    const onClose = vi.fn(); const key = ['admin', 'graphics', '4', '3'];
    const tree = DeleteBuildDialog({ target: { kind: 'graphics', id: 'GRF-11431-000012' }, onClose });
    const preventDefault = vi.fn(); element(tree, 'confirm').props.onClick({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledWith('/graphics/GRF-11431-000012', { method: 'DELETE', json: { token: 'reviewed' } });
    expect(onClose).not.toHaveBeenCalled(); mocks.options.onSuccess({ success: true });
    expect(mocks.invalidate).toHaveBeenCalledWith(); expect(onClose).toHaveBeenCalledOnce();
  });
  it('keeps a failed deletion open and refreshes the impact', () => {
    const onClose = vi.fn(); DeleteBuildDialog({ target: { kind: 'graphics', id: 'GRF-11411-000001' }, onClose });
    mocks.options.onError(new Error('Offline'));
    expect(onClose).not.toHaveBeenCalled(); expect(mocks.refetch).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Deletion needs attention', description: 'Offline' }));
  });
  it('disables cancellation and confirmation during the request', () => {
    mocks.pending = true; const onClose = vi.fn();
    const tree = DeleteBuildDialog({ target: { kind: 'graphics', id: 'GRF-11431-000012' }, onClose });
    expect(element(tree, 'confirm').props.disabled).toBe(true); expect(element(tree, 'cancel').props.disabled).toBe(true);
    tree.props.onOpenChange(false); expect(onClose).not.toHaveBeenCalled();
  });
});
