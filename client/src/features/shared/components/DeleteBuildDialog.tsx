import type { BuildTarget } from '@shared/buildLifecycle';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Preview = { token: string; targets: { path: string; id: string; kind: string; name: string }[]; retained: { id: string; name: string }[]; fileCount: number; buildCount: number };
type Result = { success: boolean; cleanupPending: boolean; remainingFiles: number; operationId: string };
const CLEANUP_KEY = ['admin', 'graphics', 'deletions'] as const;

export function DeleteBuildDialog({ target, onClose, onDeleted }: { target: BuildTarget | null; onClose: () => void; onDeleted?: () => void }) {
  const { toast } = useToast();
  const client = useQueryClient();
  const preview = useQuery({ queryKey: ['admin', 'graphics', 'deletion-preview', target], enabled: !!target,
    queryFn: () => adminFetch<Preview>(`/${target!.kind}/${target!.id}/deletion-preview`), refetchOnMount: 'always' });
  const deletion = useMutation({
    mutationFn: () => adminFetch<Result>(`/${target!.kind}/${target!.id}`, { method: 'DELETE', json: { token: preview.data!.token } }),
    onSuccess: result => {
      client.invalidateQueries();
      toast(result.cleanupPending ? { title: 'Records deleted; file cleanup needs attention', description: `${result.remainingFiles} files remain. Use Finish cleanup in the Library.`, variant: 'destructive' } : { title: 'Deletion complete' });
      onDeleted?.();
      onClose();
    },
    onError: (error: Error) => { toast({ title: 'Deletion needs attention', description: error.message, variant: 'destructive' }); client.invalidateQueries(); preview.refetch(); },
  });
  const data = preview.data;
  return <AlertDialog open={!!target} onOpenChange={open => { if (!open && !deletion.isPending) onClose(); }}>
    <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
      <AlertDialogHeader>
        <AlertDialogTitle>{data?.buildCount ? 'Delete this item and its affected builds?' : 'Delete this item?'}</AlertDialogTitle>
        <AlertDialogDescription>{data?.buildCount ? 'This item is used by the items below. Confirming deletes those complete builds and their files that are no longer used elsewhere.' : 'This permanently deletes the listed records and files that are no longer used elsewhere.'}</AlertDialogDescription>
      </AlertDialogHeader>
      {preview.isFetching && <p role="status">Checking uses…</p>}
      {preview.error && <p role="alert" className="text-destructive">{preview.error.message}</p>}
      {data && <>
        <ul className="space-y-2 max-h-[35dvh] overflow-y-auto text-sm">{data.targets.map(item => <li key={item.path} className="break-words">{item.name}<span className="block text-xs text-muted-foreground">{item.id}</span></li>)}</ul>
        <p className="text-sm">{data.targets.length} records · {data.fileCount} files will be deleted.</p>
        {!!data.retained.length && <div className="text-sm"><p>Still used elsewhere and will be kept:</p><ul>{data.retained.map(item => <li key={item.id}>{item.name} ({item.id})</li>)}</ul></div>}
      </>}
      <AlertDialogFooter>
        <AlertDialogCancel className="min-h-[44px]" disabled={deletion.isPending}>Cancel</AlertDialogCancel>
        <AlertDialogAction className="min-h-[44px]" disabled={deletion.isPending || preview.isFetching || !!preview.error || !data?.targets.length} onClick={event => { event.preventDefault(); deletion.mutate(); }}>
          {deletion.isPending ? 'Deleting…' : data?.buildCount ? 'Delete item and listed builds' : 'Delete listed items'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

/** Failed file removals stay accounted for and visible after closing or reloading. */
export function PendingAssetDeletions() {
  const client = useQueryClient();
  const pending = useQuery({ queryKey: CLEANUP_KEY, queryFn: () => adminFetch<{ operationId: string; target: BuildTarget; remainingFiles: number }[]>('/graphics/deletions/pending') });
  const retry = useMutation({ mutationFn: (id: string) => adminFetch<Result>(`/graphics/deletions/${id}/retry`, { method: 'POST' }), onSuccess: () => client.invalidateQueries({ queryKey: CLEANUP_KEY }) });
  if (!pending.data?.length && !pending.error) return null;
  return <div className="border border-destructive rounded-md p-3 mb-4 space-y-2">
    {pending.error && <p role="alert">Could not check unfinished file cleanup: {pending.error.message}</p>}
    {pending.data?.map(job => <div key={job.operationId} className="flex flex-wrap items-center gap-2"><span className="text-sm break-all">{job.target.id}: {job.remainingFiles} files awaiting cleanup</span><Button className="min-h-[44px]" disabled={retry.isPending} onClick={() => retry.mutate(job.operationId)}>Finish cleanup</Button></div>)}
    {retry.error && <p role="alert">{retry.error.message}</p>}
  </div>;
}
