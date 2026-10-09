import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ETSY_WHO_MADE, ETSY_WHEN_MADE, validateEtsySettings, type EtsySellerSettings, type EtsySetupOptions } from '@shared/etsy';
import type { MarketplaceListing } from '@shared/surfaces';

type Setup = { options: EtsySetupOptions; settings: Partial<EtsySellerSettings>; shopName: string; variants: Array<{ sku: string; size: string; color: string }> };
const selectStyle = 'min-h-12 w-full rounded-md border bg-background px-3';
export function EtsySetupDialog({ listing, onClose }: { listing: MarketplaceListing; onClose: () => void }) {
  const initialized = useRef(false);
  const [settings, setSettings] = useState<Partial<EtsySellerSettings>>({ quantity: 0, autoRenew: false, productionPartnerIds: [] });
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const endpoint = `/api/admin/surfaces/listings/${listing.id}/etsy-setup`;
  const load = useQuery<Setup>({ queryKey: [endpoint], queryFn: async () => (await apiRequest('GET', endpoint)).json(), retry: false, refetchOnWindowFocus: false });
  useEffect(() => { if (load.data && !load.isFetching && !initialized.current) { initialized.current = true; setSettings({ quantity: 0, autoRenew: false, productionPartnerIds: [], ...load.data.settings }); } }, [load.data, load.isFetching]);
  const change = (patch: Partial<EtsySellerSettings>) => { setDirty(true); setSettings(value => ({ ...value, ...patch })); };
  const save = useMutation({ mutationFn: async () => (await apiRequest('PATCH', endpoint, { settings: validateEtsySettings(settings) })).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: [endpoint] }); queryClient.invalidateQueries({ queryKey: ['/api/admin/surfaces/listings'] }); onClose(); } });
  const close = () => { if (!save.isPending && (!dirty || window.confirm('Discard unsaved Etsy setup changes?'))) onClose(); };
  const choices = (key: 'taxonomyId' | 'shippingProfileId' | 'readinessStateId' | 'returnPolicyId', label: string, rows: Array<{ id: number; name: string }>) => <div className="space-y-1"><Label htmlFor={`etsy-${key}`}>{label}</Label><select id={`etsy-${key}`} className={selectStyle} value={settings[key] || ''} onChange={e => change({ [key]: e.target.value ? Number(e.target.value) : undefined })}><option value="">Choose {label.toLowerCase()}</option>{settings[key] && !rows.some(row => row.id === settings[key]) && <option value={settings[key]}>Saved choice — refresh to verify</option>}{rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{!rows.length && <p className="text-sm">No matching choices. Create shop profiles in Etsy, then reload setup.</p>}</div>;
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto [&>button]:left-4 [&>button]:right-auto [&>button]:h-12 [&>button]:w-12"><DialogHeader><DialogTitle className="pl-12">Etsy Setup</DialogTitle></DialogHeader>
    <p>{listing.title}{load.data?.shopName ? ` · ${load.data.shopName}` : ''}</p>
    {load.isLoading && <p>Loading your Etsy shop choices…</p>}
    {load.error && <div role="alert"><p>{load.error.message}</p><Button className="min-h-12" onClick={() => load.refetch()}>Retry</Button></div>}
    {load.data && <fieldset disabled={save.isPending} className="space-y-4 min-w-0">
      <Label htmlFor="etsy-category-search">Find category</Label><Input id="etsy-category-search" value={search} onChange={e => setSearch(e.target.value)} />
      {choices('taxonomyId', 'Category', load.data.options.categories.filter(row => row.id === settings.taxonomyId || row.name.toLowerCase().includes(search.toLowerCase())))}
      {choices('shippingProfileId', 'Shipping profile', load.data.options.shippingProfiles)}
      {choices('readinessStateId', 'Processing profile', load.data.options.processingProfiles)}
      {choices('returnPolicyId', 'Return policy', load.data.options.returnPolicies)}
      <div><Label htmlFor="etsy-who">Who made the item?</Label><select id="etsy-who" className={selectStyle} value={settings.whoMade || ''} onChange={e => change({ whoMade: e.target.value as EtsySellerSettings['whoMade'] })}><option value="">Choose maker</option>{ETSY_WHO_MADE.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></div>
      <div><Label htmlFor="etsy-when">When was it made?</Label><select id="etsy-when" className={selectStyle} value={settings.whenMade || ''} onChange={e => change({ whenMade: e.target.value as EtsySellerSettings['whenMade'] })}><option value="">Choose period</option>{ETSY_WHEN_MADE.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></div>
      <div><Label htmlFor="etsy-quantity">Available quantity per variation</Label><Input className="min-h-12" id="etsy-quantity" type="number" min={0} max={999} step={1} value={settings.quantity ?? ''} onChange={e => change({ quantity: e.target.value === '' ? undefined : Number(e.target.value) })} /><p className="text-sm">Set what you can fulfill. A new Etsy listing requires a positive quantity.</p></div>
      <label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={settings.autoRenew === true} onChange={e => change({ autoRenew: e.target.checked })} />Automatically renew on Etsy (Etsy charges apply)</label>
      <div><p className="font-medium">Production partners</p>{load.data.options.productionPartners.map(row => <label key={row.id} className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={settings.productionPartnerIds?.includes(row.id) || false} onChange={e => change({ productionPartnerIds: e.target.checked ? [...(settings.productionPartnerIds || []), row.id] : settings.productionPartnerIds?.filter(id => id !== row.id) })} />{row.name}</label>)}<a href="https://www.etsy.com/your/shops/me/dashboard" target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center underline">Open Etsy shop settings</a></div>
      <p className="text-sm">{load.data.variants.length || 1} saved product combination(s). Size, color, price and images come from your product and Item Setup. Shop currency: {load.data.options.currency}.</p>
      {load.data.variants.length > 0 && <details><summary className="min-h-12 py-3">View saved sizes and colors</summary>{load.data.variants.map(row => <p key={row.sku}>{row.size} / {row.color}</p>)}</details>}
      <p className="text-sm">Etsy does not provide a complete pre-sale fee estimate here. Fees remain unavailable until a supported marketplace response supplies them.</p>
    </fieldset>}
    {save.error && <p role="alert" className="text-destructive">{save.error.message}</p>}
    <DialogFooter className="gap-2 [&>button]:min-h-12"><Button variant="outline" onClick={close} disabled={save.isPending}>Cancel</Button><Button data-testid="button-save-etsy-setup" disabled={!load.data || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save Etsy Setup'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
