import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function ArchiveGrfDialog({ grfId, onClose, queryKey }: {
  grfId: string | null;
  onClose: () => void;
  queryKey: readonly unknown[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const archive = useMutation({
    mutationFn: (id: string) => adminFetch(`/graphics/${id}/archive`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Image archived" });
      onClose();
    },
    onError: (error: Error) => toast({ title: "Archive failed", description: error.message, variant: "destructive" }),
  });
  return (
    <AlertDialog open={!!grfId} onOpenChange={open => { if (!open && !archive.isPending) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this image?</AlertDialogTitle>
          <AlertDialogDescription>It will be hidden from this library tab. The stored file, existing crops, and uses in products or websites will remain.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-[44px]" disabled={archive.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="min-h-[44px]" disabled={archive.isPending} onClick={event => {
            event.preventDefault();
            if (grfId) archive.mutate(grfId);
          }}>{archive.isPending ? 'Archiving…' : 'Archive image'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
