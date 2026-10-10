import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { memberFetch } from '@/lib/memberFetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Slot { packetId: string; durationSeconds: number; order: number }
interface Instance { id: string; title?: string; qrgBaseCode: string; composeMode: string; slots: Slot[]; sourcePacketIds?: string[]; hostingExpiresAt?: string }

function ExperienceEditor({ item, choices, onSaved }: { item: Instance; choices: any[]; onSaved: () => Promise<unknown> }) {
  const [slots, setSlots] = useState<Slot[]>([...item.slots].sort((a, b) => a.order - b.order));
  const [mode, setMode] = useState(item.composeMode);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const name = (id: string) => choices.find(p => (p.productionPacketId || p.id) === id)?.title || 'Included content';
  const move = (index: number, delta: number) => setSlots(old => {
    const next = [...old], target = index + delta;
    if (target < 0 || target >= next.length) return old;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      await apiRequest('PUT', `/api/dynamics/instances/${encodeURIComponent(item.id)}/slots`, {
        slots: slots.map((slot, index) => ({ ...slot, order: index + 1 })), composeMode: mode,
      });
      await onSaved(); setMessage('Saved. Your printed QR stays the same.'); setOpen(false);
    } catch (error: any) { setMessage(error.message || 'Could not save your QR experience.'); }
    finally { setSaving(false); }
  };
  return <Card className="min-w-0 bg-slate-800/50 border-slate-700 text-white">
    <CardHeader><CardTitle className="text-lg break-words">{item.title || 'Your QR experience'}</CardTitle>
      <p className="text-sm break-all text-slate-300">{item.qrgBaseCode}</p>
      {item.hostingExpiresAt && <p className="text-sm text-slate-300">Hosting through {new Date(item.hostingExpiresAt).toLocaleDateString()}</p>}
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={saving} onClick={() => { setOpen(!open); setMessage(''); if (!open) { setSlots([...item.slots].sort((a, b) => a.order - b.order)); setMode(item.composeMode); } }}>{open ? 'Close' : 'Manage content'}</Button>
        <Button asChild variant="outline"><a href={`/qr/d/${encodeURIComponent(item.id)}`} target="_blank" rel="noopener noreferrer">Open QR experience</a></Button>
      </div>
      {open && <fieldset disabled={saving} className="space-y-4">
        <label className="block space-y-2"><span>Playback</span>
          <select className="w-full min-h-12 rounded border border-slate-600 bg-slate-900 p-2" value={mode} onChange={e => setMode(e.target.value)}>
            <option value="auto-rotate">Change on a schedule</option><option value="scan-to-reveal">Show the next item on each scan</option>
          </select>
        </label>
        {mode === 'scan-to-reveal' && <p className="text-sm text-slate-300">Each browser keeps its own place in the sequence.</p>}
        {slots.map((slot, index) => <div key={slot.packetId} className="space-y-2 border border-slate-600 rounded p-3">
          <p className="break-words">{index + 1}. {name(slot.packetId)}</p>
          {mode === 'auto-rotate' && <label className="block space-y-1"><span className="text-sm">Duration in seconds</span><Input type="number" min={1} max={31536000} value={slot.durationSeconds}
            onChange={e => setSlots(old => old.map((s, i) => i === index ? { ...s, durationSeconds: Number(e.target.value) } : s))} /></label>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={index === 0} onClick={() => move(index, -1)}>Move up</Button>
            <Button variant="outline" disabled={index === slots.length - 1} onClick={() => move(index, 1)}>Move down</Button>
            <Button variant="outline" disabled={slots.length === 1} onClick={() => setSlots(old => old.filter((_, i) => i !== index))}>Remove</Button></div>
        </div>)}
        <label className="block space-y-2"><span>Add your published content</span>
          <select value="" className="w-full min-h-12 rounded border border-slate-600 bg-slate-900 p-2" onChange={e => { if (e.target.value) setSlots(old => [...old, { packetId: e.target.value, durationSeconds: 86400, order: old.length + 1 }]); }}>
            <option value="">Choose a Canvas or Play item</option>
            {choices.filter(p => !slots.some(s => s.packetId === (p.productionPacketId || p.id))).map(p => <option key={p.id} value={p.productionPacketId || p.id}>{p.title}</option>)}
          </select>
        </label>
        <Button disabled={saving || !slots.length || slots.some(s => !Number.isSafeInteger(s.durationSeconds) || s.durationSeconds < 1 || s.durationSeconds > 31536000)} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </fieldset>}
      {message && <p role="status" className="text-sm break-words">{message}</p>}
    </CardContent>
  </Card>;
}

export function MemberDynamics({ memberId }: { memberId: string }) {
  const cache = useQueryClient();
  const key = ['/api/dynamics/instances', memberId];
  const instances = useQuery<{ instances: Instance[] }>({ queryKey: key, enabled: !!memberId,
    queryFn: async () => (await apiRequest('GET', '/api/dynamics/instances')).json() });
  const choices = useQuery<any>({ queryKey: ['/api/members', memberId, 'published-items', 'dynamics'], enabled: !!memberId,
    queryFn: () => memberFetch(`/${memberId}/published-items?types=qr-canvas,qr-play`) });
  return <section className="row space-y-4">
    <div><h2 className="text-xl font-semibold text-white">QR Dynamics</h2><p className="text-slate-300">Manage the content behind your items.</p></div>
    {instances.isLoading || choices.isLoading ? <p role="status">Loading your QR experiences…</p> :
      instances.isError || choices.isError ? <div role="alert"><p>Could not load your QR experiences.</p><Button onClick={() => { instances.refetch(); choices.refetch(); }}>Try again</Button></div> :
      !instances.data?.instances.length ? <p className="text-slate-300">Your published Canvas, Play and Compose experiences, and purchased QR items, will appear here.</p> :
      <div className="layout__split-2">{instances.data.instances.map(item => <ExperienceEditor key={item.id} item={item} choices={choices.data?.items || []} onSaved={() => cache.invalidateQueries({ queryKey: key })} />)}</div>}
  </section>;
}
