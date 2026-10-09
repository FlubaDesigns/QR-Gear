import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalView } from './shapes/ModalView';
import { CreateImageFolderDialog } from './CreateImageFolderDialog';
import { useAdminImageFolders, useAdminImageUpload } from '../adminImageLibrary';
import { useToast } from '@/hooks/use-toast';

export function SaveImageToLibraryDialog({ open, onClose, imageDataUrl }: { open: boolean; onClose: () => void; imageDataUrl: string }) {
  const folders = useAdminImageFolders(open); const upload = useAdminImageUpload(); const { toast } = useToast();
  const [folder, setFolder] = useState(''); const [name, setName] = useState('');
  const [creating, setCreating] = useState(false); const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  useEffect(() => { if (!open) { setFolder(''); setName(''); setError(null); setCreating(false); } }, [open]);
  useEffect(() => { if (open && !folder && folders.data?.length) setFolder(folders.data[0]); }, [open, folder, folders.data]);
  const save = async () => {
    if (!folder || saving.current) return;
    saving.current = true; setError(null);
    try {
      if (!imageDataUrl.startsWith('data:image/')) throw new Error('No generated image is ready to save');
      const blob = await (await fetch(imageDataUrl)).blob();
      const result = await upload.mutateAsync({ files: [{ file: blob, name: name.trim() || 'Saved graphic' }], folder });
      if (result.failed.length) throw new Error(result.failed[0].message);
      toast({ title: 'Image saved to library' }); onClose();
    } catch (failure) { setError((failure as Error).message); }
    finally { saving.current = false; }
  };
  return <>
    <ModalView open={open} onOpenChange={value => { if (!value && !saving.current) onClose(); }} title="Save image to library" showCloseButton={false} maxWidth="max-w-md" className="!overflow-y-auto max-h-[90dvh] [&>button]:h-11 [&>button]:w-11">
      <div className="p-4 pt-14 space-y-4"><label className="block text-sm">Image name<Input className="min-h-[44px]" value={name} onChange={event => setName(event.target.value)} /></label>
        <p className="text-sm font-medium">Folder</p>
        {folders.error && <p role="alert" className="text-destructive">{folders.error.message}</p>}
        <div className="grid grid-cols-2 gap-2">{folders.data?.map(value => <Button key={value} className="min-h-[44px] h-auto whitespace-normal break-words" variant={folder === value ? 'default' : 'outline'} aria-pressed={folder === value} onClick={() => setFolder(value)}>{value}</Button>)}</div>
        <Button variant="outline" className="w-full min-h-[44px]" disabled={upload.isPending} onClick={() => setCreating(true)}>New folder</Button>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button className="w-full min-h-[44px]" disabled={!folder || upload.isPending} onClick={save}>{upload.isPending ? 'Saving…' : 'Save to library'}</Button>
      </div>
    </ModalView>
    <CreateImageFolderDialog open={creating} onClose={() => setCreating(false)} onCreated={setFolder} />
  </>;
}
