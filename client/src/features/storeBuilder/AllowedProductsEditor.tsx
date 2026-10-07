import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminFetch } from '@/lib/adminFetch';
import { apiRequest } from '@/lib/queryClient';
import { catalogToSelectItem } from '@shared/adapters/catalog.adapter';
import { refreshStoreViews } from './storeQueries';

type Selection = { canonicalBlankKey: string; colors?: string[]; sizes?: string[] };
export function AllowedProductsEditor({ storeId }: { storeId: string }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<Selection[]>([]);
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [search, setSearch] = useState('');
  const lock = useRef(false), edited = useRef(false);
  const master = useQuery<any[]>({ queryKey: ['/api/master-catalog'], queryFn: async () => {
    const data = await (await apiRequest('GET', '/api/master-catalog')).json();
    if (!Array.isArray(data)) throw new Error('Invalid master catalog response'); return data;
  } });
  const key = ['/api/admin/stores', storeId, 'allowed-products'];
  const saved = useQuery<{products: any[]}>({ queryKey: key, queryFn: () => adminFetch(`/stores/${storeId}/allowed-products`) });
  useEffect(() => {
    if (!saved.data || edited.current) return;
    setSelected(saved.data.products.map(p => ({ canonicalBlankKey: p.canonicalBlankKey, ...(p.selectedColors !== undefined ? { colors: p.selectedColors } : {}), ...(p.selectedSizes !== undefined ? { sizes: p.selectedSizes } : {}) })));
  }, [saved.data]);
  const items = Array.from(new Map((master.data || []).flatMap(c => c.items || []).map(p => [p.docId, catalogToSelectItem(p)])).values());
  function edit(next: Selection[]) { if (lock.current) return; edited.current = true; setDirty(true); setSelected(next); setMessage(''); }
  async function save() {
    if (lock.current || saved.error || master.error) return;
    lock.current = true; setSaving(true); setMessage('');
    try {
      await client.cancelQueries({ queryKey: key });
      await adminFetch(`/stores/${storeId}/allowed-products`, { method: 'POST', json: { products: selected } });
      // Preserve the exact saved choices while refreshing all consumers.
      setDirty(false); edited.current = false; setMessage('Saved');
      await refreshStoreViews(client);
    } catch (e: any) { setMessage(`Save failed: ${e.message}`); }
    finally { lock.current = false; setSaving(false); }
  }
  if (master.error || saved.error) return <div role="alert" className="space-y-3"><p>Could not load product choices. Your saved list has not been changed.</p><Button className="h-12" onClick={() => { void master.refetch(); void saved.refetch(); }}>Retry</Button></div>;
  if (master.isLoading || saved.isLoading) return <p role="status">Loading product choices…</p>;
  return <div className="min-w-0 space-y-3">
    <p className="text-sm text-muted-foreground">Choose QRG blanks from Printful and Printify. Save applies the selections below.</p>
    <div className="sticky top-[122px] z-20 flex flex-wrap gap-2 rounded-md border bg-background p-2">
      <Button className="h-12" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : `Save (${selected.length})`}</Button>
      <Button className="h-12" variant="outline" disabled={saving} onClick={() => edit([])}>Clear choices</Button>
      {message && <p role={message.startsWith('Save failed') ? 'alert' : 'status'} className="w-full text-sm [overflow-wrap:anywhere]">{message}</p>}
    </div>
    <Input className="h-12 text-base" aria-label="Find a blank" placeholder="Find a blank…" value={search} onChange={e => setSearch(e.target.value)} />
    <fieldset disabled={saving} className="min-w-0 space-y-2">
      {items.filter(item => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase())).map(item => {
        const choice = selected.find(s => s.canonicalBlankKey === item.id);
        return <div key={item.id} className="min-w-0 rounded-md border p-3 space-y-2">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 [overflow-wrap:anywhere]">
            <input type="checkbox" className="h-6 w-6 shrink-0" checked={!!choice} onChange={() => edit(choice ? selected.filter(s => s !== choice) : [...selected, { canonicalBlankKey: item.id }])} />
            <span className="min-w-0">{item.name}<span className="block text-xs text-muted-foreground">{item.id}</span></span>
          </label>
          {choice && <details><summary className="min-h-12 cursor-pointer py-3">Colors and sizes</summary>
            {(['colors', 'sizes'] as const).map(field => {
              const values = field === 'colors' ? item.availableColors.map(c => c.name) : item.availableSizes;
              const enabled = choice[field] ?? values;
              return <div key={field} className="space-y-2"><p className="text-sm capitalize">{field}</p><div className="flex flex-wrap gap-2">{values.map(value => <Button key={value} className="min-h-12 h-auto whitespace-normal" variant={enabled.includes(value) ? 'default' : 'outline'} aria-pressed={enabled.includes(value)} onClick={() => edit(selected.map(s => s === choice ? { ...s, [field]: enabled.includes(value) ? enabled.filter(v => v !== value) : [...enabled, value] } : s))}>{value}</Button>)}</div></div>;
            })}
          </details>}
        </div>;
      })}
    </fieldset>
    {!items.length && <p>No QRG blanks are available yet.</p>}
  </div>;
}
