import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveGrfDialog } from '@/features/shared/components/ArchiveGrfDialog';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), invalidate: vi.fn(), toast: vi.fn(), pending: false, options: null as any }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: mocks.fetch }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@tanstack/react-query', () => ({
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
beforeEach(() => { vi.clearAllMocks(); mocks.pending = false; mocks.fetch.mockResolvedValue({ success: true }); });
describe('shared library archive confirmation', () => {
  it('does not send a request when opened or canceled', () => {
    const onClose = vi.fn(); const tree = ArchiveGrfDialog({ grfId: 'GRF-11431-000012', onClose, queryKey: ['backgrounds'] });
    expect(mocks.fetch).not.toHaveBeenCalled(); tree.props.onOpenChange(false);
    expect(onClose).toHaveBeenCalledOnce(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('confirms through the archive endpoint, then refreshes the owning tab', async () => {
    const onClose = vi.fn(); const key = ['admin', 'graphics', '4', '3'];
    const tree = ArchiveGrfDialog({ grfId: 'GRF-11431-000012', onClose, queryKey: key });
    const preventDefault = vi.fn(); element(tree, 'confirm').props.onClick({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledWith('/graphics/GRF-11431-000012/archive', { method: 'PATCH' });
    expect(onClose).not.toHaveBeenCalled(); mocks.options.onSuccess();
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: key }); expect(onClose).toHaveBeenCalledOnce();
  });
  it('keeps a failed archive open and reports the failure', () => {
    const onClose = vi.fn(); ArchiveGrfDialog({ grfId: 'GRF-11411-000001', onClose, queryKey: ['source'] });
    mocks.options.onError(new Error('Offline'));
    expect(onClose).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Archive failed', description: 'Offline' }));
  });
  it('disables cancellation and confirmation during the request', () => {
    mocks.pending = true; const onClose = vi.fn();
    const tree = ArchiveGrfDialog({ grfId: 'GRF-11431-000012', onClose, queryKey: ['backgrounds'] });
    expect(element(tree, 'confirm').props.disabled).toBe(true); expect(element(tree, 'cancel').props.disabled).toBe(true);
    tree.props.onOpenChange(false); expect(onClose).not.toHaveBeenCalled();
  });
});
