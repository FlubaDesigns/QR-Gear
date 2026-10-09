import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import { useToast } from '@/hooks/use-toast';
import { TEMPLATE_LIBRARY_QK } from '../templateLibrary';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function DeleteTemplateDialog({ templateId, onClose, onDeleted }: {
  templateId: string | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deletion = useMutation({
    mutationFn: (id: string) => adminFetch(`/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_LIBRARY_QK });
      toast({ title: 'Template deleted' });
      onDeleted?.(id);
      onClose();
    },
    onError: (error: Error) => toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }),
  });
  return (
    <AlertDialog open={!!templateId} onOpenChange={open => { if (!open && !deletion.isPending) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this template?</AlertDialogTitle>
          <AlertDialogDescription>The saved template will be permanently removed. Existing product packets, store listings, and artwork will remain.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-[44px]" disabled={deletion.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="min-h-[44px] bg-destructive hover:bg-destructive/90" disabled={deletion.isPending} onClick={event => {
            event.preventDefault();
            if (templateId) deletion.mutate(templateId);
          }}>{deletion.isPending ? 'Deleting…' : 'Delete template'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
