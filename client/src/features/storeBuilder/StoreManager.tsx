import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminFetch } from '@/lib/adminFetch';
import { STORE_ROLES, type StoreRole } from '@shared/storeRoles';
import { AllowedProductsEditor } from './AllowedProductsEditor';
import { refreshStoreViews } from './storeQueries';
import { X } from 'lucide-react';

export function StoreManager({ storeId, createOnly = false }: { storeId?: string; createOnly?: boolean }) {
  const client = useQueryClient();
  const stores = useQuery<any[]>({ queryKey: ['/api/admin/stores'], queryFn: () => adminFetch('/stores') });
  const [name, setName] = useState(''), [role, setRole] = useState<StoreRole>('member');
  const [editing, setEditing] = useState<string | null>(null), [confirm, setConfirm] = useState<string | null>(null);
  const [channelName, setChannelName] = useState(''), [channelStore, setChannelStore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const lock = useRef(false);
  async function change(task: () => Promise<unknown>, done: () => void) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage('');
    try { await task(); done(); await refreshStoreViews(client); setMessage('Saved'); }
    catch (e: any) { setMessage(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  if (stores.error) return <div role="alert" className="space-y-3"><p>Could not load stores.</p><Button className="h-12" onClick={() => stores.refetch()}>Retry</Button></div>;
  if (stores.isLoading) return <p role="status">Loading stores…</p>;
  return <div className="min-w-0 space-y-4">
    {createOnly && <section className="rounded-lg border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Create a store</h2>
      <fieldset disabled={busy} className="space-y-3 min-w-0">
        <Input className="h-12 text-base" aria-label="Store name" placeholder="Store name" value={name} onChange={e => setName(e.target.value)} />
        <select aria-label="Store role" className="h-12 w-full rounded-md border bg-background px-3 text-base" value={role} onChange={e => setRole(e.target.value as StoreRole)}>{STORE_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <Button className="h-12 w-full" disabled={!name.trim() || busy} onClick={() => change(() => adminFetch('/stores', { method: 'POST', json: { name: name.trim(), roleType: role } }), () => setName(''))}>Create store</Button>
      </fieldset>
    </section>}
    {message && <p role={message === 'Saved' ? 'status' : 'alert'} className="[overflow-wrap:anywhere]">{message}</p>}

    {stores.data?.filter(store => !createOnly && store.id === storeId).map(store => <section key={store.id} className="min-w-0 rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold [overflow-wrap:anywhere]">{store.name}</h3><p className="text-sm text-muted-foreground">{STORE_ROLES.find(r => r.id === store.roleType)?.name || store.roleType} · {store.channelCount || 0} channels</p>
      <div className="flex flex-wrap gap-2">
        <Button className="h-12" variant="outline" disabled={busy} onClick={() => setEditing(editing === store.id ? null : store.id)}>Product choices</Button>
        <Button className="h-12" variant="outline" disabled={busy} onClick={() => { setChannelStore(store.id); setChannelName(''); }}>Add channel</Button>
        <Button className="h-12" variant="outline" disabled={busy} onClick={() => setConfirm(store.id)}>Delete store</Button>
      </div>
      {channelStore === store.id && <fieldset disabled={busy} className="min-w-0 space-y-2"><Input className="h-12 text-base" aria-label="Channel name" placeholder="Channel name" value={channelName} onChange={e => setChannelName(e.target.value)} /><div className="flex flex-wrap gap-2"><Button className="h-12" disabled={!channelName.trim() || busy} onClick={() => change(() => adminFetch(`/stores/${store.id}/channels`, { method: 'POST', json: { name: channelName.trim() } }), () => setChannelStore(null))}>Save channel</Button><Button className="h-12" variant="outline" onClick={() => setChannelStore(null)}>Cancel</Button></div></fieldset>}
      {confirm === store.id && <div className="space-y-2 rounded-md border border-destructive p-3"><p>Delete “{store.name}” and its channels? All listings in this store will be archived and hidden. Build files are retained.</p><div className="flex flex-wrap gap-2"><Button className="h-12" variant="outline" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button className="h-12" variant="destructive" disabled={busy} onClick={() => change(() => adminFetch(`/stores/${store.id}`, { method: 'DELETE' }), () => { setConfirm(null); setEditing(null); })}>Delete store</Button></div></div>}
      {editing === store.id && <div className="space-y-3 border-t pt-3"><Button className="h-12" variant="outline" onClick={() => { if (window.confirm("Close product choices? Any unsaved changes will be lost.")) setEditing(null); }}><X className="mr-2 h-5 w-5" />Close product choices</Button><AllowedProductsEditor key={store.id} storeId={store.id} /></div>}
    </section>)}
  </div>;
}
