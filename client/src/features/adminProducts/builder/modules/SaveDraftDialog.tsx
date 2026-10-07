import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalView } from '@/features/shared/components/views/ModalView';
import { useToast } from '@/hooks/use-toast';
import { useBuilderContext } from '../BuilderContext';

export function SaveDraftDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, saveDraft } = useBuilderContext();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => { if (open) setName(state.draftName || ''); }, [open, state.activeSessionId, state.draftName]);
  const save = async () => {
    if (savingRef.current || !name.trim()) return;
    savingRef.current = true; setSaving(true);
    try {
      await saveDraft(name);
      onOpenChange(false);
      toast({ title: 'Draft saved', description: `“${name.trim()}” is available in Resume.` });
    } catch (error: any) {
      toast({ title: 'Could not save draft', description: error.message, variant: 'destructive' });
    } finally { savingRef.current = false; setSaving(false); }
  };
  return <ModalView open={open} onOpenChange={value => { if (!savingRef.current) onOpenChange(value); }} title="Save Draft">
    <form className="p-4 space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="block space-y-2">Draft name
        <Input autoFocus value={name} onChange={event => setName(event.target.value)} disabled={saving} data-testid="input-draft-name" />
      </label>
      <Button type="submit" className="w-full" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save Draft'}</Button>
    </form>
  </ModalView>;
}
