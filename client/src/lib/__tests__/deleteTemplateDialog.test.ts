import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteTemplateDialog } from '@/features/shared/components/DeleteTemplateDialog';
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
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === type) return node;
  for (const child of [node.props?.children].flat()) { const found = element(child, type); if (found) return found; }
}
beforeEach(() => { vi.clearAllMocks(); mocks.pending = false; mocks.fetch.mockResolvedValue({ success: true }); });
describe('shared template deletion', () => {
  it('does not delete anything on open or cancel', () => {
    const onClose = vi.fn(); const tree = DeleteTemplateDialog({ templateId: 'template', onClose });
    tree.props.onOpenChange(false); expect(onClose).toHaveBeenCalledOnce(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('deletes only the selected template and refreshes both consumers after success', () => {
    const onClose = vi.fn(), onDeleted = vi.fn(); const tree = DeleteTemplateDialog({ templateId: 'template', onClose, onDeleted });
    const preventDefault = vi.fn(); element(tree, 'confirm').props.onClick({ preventDefault });
    expect(mocks.fetch.mock.calls).toEqual([['/templates/template', { method: 'DELETE' }]]);
    expect(onClose).not.toHaveBeenCalled(); expect(onDeleted).not.toHaveBeenCalled();
    mocks.options.onSuccess({}, 'template');
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['/api/admin/templates'] });
    expect(onDeleted).toHaveBeenCalledWith('template'); expect(onClose).toHaveBeenCalledOnce();
  });
  it('keeps failures open without claiming success', () => {
    const onClose = vi.fn(); DeleteTemplateDialog({ templateId: 'template', onClose });
    mocks.options.onError(new Error('Offline'));
    expect(onClose).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete failed' }));
  });
  it('blocks repeat confirmation and cancellation during deletion', () => {
    mocks.pending = true; const onClose = vi.fn(); const tree = DeleteTemplateDialog({ templateId: 'template', onClose });
    expect(element(tree, 'confirm').props.disabled).toBe(true); expect(element(tree, 'cancel').props.disabled).toBe(true);
    tree.props.onOpenChange(false); expect(onClose).not.toHaveBeenCalled();
  });
});
