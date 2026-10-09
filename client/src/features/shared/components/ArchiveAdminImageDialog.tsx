import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import { ADMIN_IMAGES_QK } from '../adminImageLibrary';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function ArchiveAdminImageDialog({ imageId, onClose, onArchived }: { imageId: string | null; onClose: () => void; onArchived: (id: string) => void }) {
  const queryClient = useQueryClient(); const { toast } = useToast();
  const archive = useMutation({
    // The existing DELETE endpoint archives the record; it does not delete the file.
    mutationFn: (id: string) => adminFetch(`/images/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: (_, id) => { queryClient.invalidateQueries({ queryKey: ADMIN_IMAGES_QK }); onArchived(id); onClose(); toast({ title: 'Image archived' }); },
    onError: (error: Error) => toast({ title: 'Archive failed', description: error.message, variant: 'destructive' }),
  });
  return <AlertDialog open={!!imageId} onOpenChange={open => { if (!open && !archive.isPending) onClose(); }}><AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>Archive this image?</AlertDialogTitle><AlertDialogDescription>Hide it from image lists and pickers. The stored file and existing uses in products and websites will remain.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel className="min-h-[44px]" disabled={archive.isPending}>Cancel</AlertDialogCancel><AlertDialogAction className="min-h-[44px]" disabled={archive.isPending} onClick={event => { event.preventDefault(); if (imageId) archive.mutate(imageId); }}>{archive.isPending ? 'Archiving…' : 'Archive image'}</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
