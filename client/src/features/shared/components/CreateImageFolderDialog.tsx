import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IMAGE_FOLDER_MAX_LENGTH } from '@shared/imageLibrary';
import { useCreateImageFolder } from '../adminImageLibrary';

export function CreateImageFolderDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (folder: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const creating = useRef(false);
  const mutation = useCreateImageFolder();
  const close = () => { if (!creating.current) { setName(''); setError(null); onClose(); } };
  const create = async () => {
    if (creating.current || !name.trim()) return;
    creating.current = true; setError(null);
    try {
      const result = await mutation.mutateAsync(name);
      onCreated(result.folder); setName(''); onClose();
    } catch (failure) { setError((failure as Error).message); }
    finally { creating.current = false; }
  };
  return <Dialog open={open} onOpenChange={value => { if (!value) close(); }}><DialogContent className="max-w-sm [&>button]:h-11 [&>button]:w-11">
    <DialogHeader><DialogTitle>Create folder</DialogTitle></DialogHeader>
    <Input aria-label="Folder name" className="min-h-[44px]" maxLength={IMAGE_FOLDER_MAX_LENGTH} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void create(); } }} disabled={mutation.isPending} />
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" className="min-h-[44px]" onClick={close} disabled={mutation.isPending}>Cancel</Button><Button className="min-h-[44px]" onClick={create} disabled={!name.trim() || mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Create'}</Button></div>
  </DialogContent></Dialog>;
}
