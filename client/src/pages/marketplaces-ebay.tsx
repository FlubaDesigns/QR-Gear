import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { EbaySellerSettings, EbaySetupOptions, MarketplaceListing } from '@shared/surfaces';

type Setup = { options: EbaySetupOptions; variants: Array<{ size: string; color: string; sku: string }>; settings: Partial<EbaySellerSettings>; categoryId: string; itemSpecifics: Record<string, string> };
const empty: EbaySellerSettings = { fulfillmentPolicyId: '', paymentPolicyId: '', returnPolicyId: '', merchantLocationKey: '' };

export function EbaySetupDialog({ listing, onClose }: { listing: MarketplaceListing; onClose: () => void }) {
  const { toast } = useToast();
  const initialized = useRef(false);
  const [settings, setSettings] = useState<EbaySellerSettings>(empty);
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState(listing.title || '');
  const [specifics, setSpecifics] = useState<Record<string, string>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [location, setLocation] = useState({ name: '', postalCode: '', country: '' });
  const [dirty, setDirty] = useState(false);
  const [lookedUp, setLookedUp] = useState<Setup | null>(null);
  const endpoint = `/api/admin/surfaces/listings/${listing.id}/ebay-setup`;
  const initial = useQuery<Setup>({ queryKey: [endpoint], queryFn: async () => (await apiRequest('GET', endpoint)).json(), retry: false, refetchOnWindowFocus: false });
  const data = lookedUp || initial.data;
  useEffect(() => {
    if (initial.data && !initial.isFetching && !initialized.current) {
      initialized.current = true;
      setSettings({ ...empty, ...initial.data.settings }); setCategoryId(initial.data.categoryId); setSpecifics(initial.data.itemSpecifics);
    }
  }, [initial.data, initial.isFetching]);
  const lookup = useMutation({ mutationFn: async (query: { categoryId: string; q: string }) => (await apiRequest('GET', `${endpoint}?${new URLSearchParams(query)}`)).json() as Promise<Setup>, onSuccess: setLookedUp });
  const createLocation = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/admin/surfaces/listings/${listing.id}/ebay-location`, location)).json(),
    onSuccess: result => { setSettings(current => ({ ...current, merchantLocationKey: result.merchantLocationKey })); setDirty(true); setShowLocation(false); lookup.mutate({ categoryId, q: '' }); },
  });
  const save = useMutation({
    mutationFn: async () => (await apiRequest('PATCH', endpoint, { categoryId, settings, itemSpecifics: specifics })).json(),
    onSuccess: () => {
      for (const key of [endpoint, '/api/admin/surfaces', `/api/admin/surfaces/${listing.surfaceId}`, '/api/admin/surfaces/listings']) queryClient.invalidateQueries({ queryKey: [key] });
      toast({ title: 'eBay setup saved', description: 'Use Publish or Sync when ready to send the item.' }); onClose();
    },
    onError: (error: Error) => toast({ title: 'Could not save eBay setup', description: error.message, variant: 'destructive' }),
  });
  const close = () => { if (!save.isPending && !createLocation.isPending && (!dirty || window.confirm('Discard unsaved eBay setup changes?'))) onClose(); };
  const setField = (key: Exclude<keyof EbaySellerSettings, 'variationValues'>, value: string) => { setDirty(true); setSettings(current => ({ ...current, [key]: value })); };
  const fields: Array<{ key: Exclude<keyof EbaySellerSettings, 'variationValues'>; label: string; rows: any[] }> = data ? [
    { key: 'fulfillmentPolicyId', label: 'Shipping policy', rows: data.options.fulfillmentPolicies },
    { key: 'paymentPolicyId', label: 'Payment policy', rows: data.options.paymentPolicies },
    { key: 'returnPolicyId', label: 'Return policy', rows: data.options.returnPolicies },
    { key: 'merchantLocationKey', label: 'Inventory location', rows: data.options.locations },
  ] : [];
  const variantAspect = (name: string) => data?.variants.length && ['Size', 'Color'].includes(name);
  const variantFields = data ? (['Size', 'Color'] as const).flatMap(name => {
    const aspect = data.options.aspects.find(aspect => aspect.name === name);
    return Array.from(new Set(data.variants.map(row => name === 'Size' ? row.size : row.color))).map(value => ({ name, value, aspect, selected: settings.variationValues?.[name]?.[value] || value }));
  }) : [];
  const variantsComplete = variantFields.every(field => field.aspect?.mode !== 'SELECTION_ONLY' || field.aspect.values.includes(field.selected));
  const complete = variantsComplete && !!data && data.categoryId === categoryId && categoryId && fields.every(field => field.rows.some(row => row[field.key] === settings[field.key])) && data.options.aspects.every(aspect => !aspect.required || variantAspect(aspect.name) || specifics[aspect.name]?.trim());
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto [&>button]:left-4 [&>button]:right-auto [&>button]:h-12 [&>button]:w-12">
    <DialogHeader><DialogTitle className="pl-12">eBay Setup</DialogTitle></DialogHeader>
    <p className="text-sm">{listing.title} · eBay US · Fixed price</p>
    {initial.isLoading && <p>Loading your seller policies and item requirements…</p>}
    {initial.error && <div role="alert"><p>{initial.error.message}</p><Button className="min-h-12" onClick={() => initial.refetch()}>Retry</Button></div>}
    {data && <div className="space-y-4">
      {fields.map(field => <div key={field.key} className="space-y-1"><Label htmlFor={`ebay-${field.key}`}>{field.label}</Label>
        <select id={`ebay-${field.key}`} className="min-h-12 w-full rounded-md border bg-background px-3" value={settings[field.key]} onChange={event => setField(field.key, event.target.value)} data-testid={`ebay-${field.key}`}>
          <option value="">Choose {field.label.toLowerCase()}</option>
          {settings[field.key] && !field.rows.some(row => row[field.key] === settings[field.key]) && <option value={settings[field.key]}>Saved selection unavailable — choose another</option>}
          {field.rows.map(row => <option key={row[field.key]} value={row[field.key]}>{row.name}</option>)}
        </select>{!field.rows.length && <p className="text-sm text-destructive">{field.key === 'merchantLocationKey' ? 'Add an inventory location below.' : 'Create this policy in your eBay seller account, then reload setup.'}</p>}
      </div>)}
      <Button className="min-h-12 w-full" variant="outline" onClick={() => setShowLocation(value => !value)} disabled={createLocation.isPending}>{showLocation ? 'Hide new location' : 'Add inventory location'}</Button>
      {showLocation && <div className="space-y-2 rounded-md border p-3"><p className="text-sm">Where this product ships from. This creates a location in the connected eBay seller account.</p>
        {(['name', 'postalCode', 'country'] as const).map(field => <div key={field}><Label htmlFor={`location-${field}`}>{field === 'name' ? 'Location name' : field === 'postalCode' ? 'Postal code' : 'Country code (e.g. US)'}</Label><Input id={`location-${field}`} value={location[field]} onChange={event => setLocation(current => ({ ...current, [field]: event.target.value }))} maxLength={field === 'country' ? 2 : 100} /></div>)}
        <Button className="min-h-12 w-full" onClick={() => createLocation.mutate()} disabled={createLocation.isPending || !location.name.trim() || !location.postalCode.trim() || location.country.length !== 2}>Create location on eBay</Button>
      </div>}
      {createLocation.error && <p role="alert" className="text-destructive">{createLocation.error.message}</p>}
      <div className="space-y-2"><Label htmlFor="ebay-category-search">Find an eBay category</Label>
        <Input id="ebay-category-search" value={search} onChange={event => setSearch(event.target.value)} />
        <Button className="min-h-12 w-full" variant="outline" disabled={lookup.isPending || !search.trim()} onClick={() => lookup.mutate({ categoryId, q: search })}>Search categories</Button>
        {data.options.categories.length > 0 && <select aria-label="Category suggestions" className="min-h-12 w-full border rounded-md bg-background px-3" value={categoryId} onChange={event => { setCategoryId(event.target.value); setDirty(true); lookup.mutate({ categoryId: event.target.value, q: search }); }}>
          <option value="">Choose category</option>{data.options.categories.map(category => <option value={category.categoryId} key={category.categoryId}>{category.categoryName} ({category.categoryId})</option>)}
        </select>}
        <Label htmlFor="ebay-category-id">Category ID</Label><Input id="ebay-category-id" value={categoryId} onChange={event => { setCategoryId(event.target.value); setDirty(true); }} />
        <Button className="min-h-12 w-full" variant="outline" disabled={lookup.isPending || !categoryId} onClick={() => lookup.mutate({ categoryId, q: '' })}>Load category requirements</Button>
      </div>
      {lookup.error && <p role="alert" className="text-destructive">{lookup.error.message}</p>}
      {data.options.aspects.filter(aspect => !variantAspect(aspect.name) && (aspect.required || specifics[aspect.name] || showOptional)).map(aspect => <div key={aspect.name} className="space-y-1"><Label htmlFor={`aspect-${aspect.name}`}>{aspect.name}{aspect.required ? ' *' : ''}</Label>
        {aspect.mode === 'SELECTION_ONLY' ? <select id={`aspect-${aspect.name}`} className="min-h-12 w-full border rounded-md bg-background px-3" value={specifics[aspect.name] || ''} onChange={event => { setDirty(true); setSpecifics(current => ({ ...current, [aspect.name]: event.target.value })); }}>
          <option value="">Choose a value</option>{specifics[aspect.name] && !aspect.values.includes(specifics[aspect.name]) && <option value={specifics[aspect.name]}>Unsupported saved value: {specifics[aspect.name]}</option>}{aspect.values.map(value => <option key={value} value={value}>{value}</option>)}
        </select> : <Input id={`aspect-${aspect.name}`} value={specifics[aspect.name] || ''} onChange={event => { setDirty(true); setSpecifics(current => ({ ...current, [aspect.name]: event.target.value })); }} />}
      </div>)}
      <Button className="min-h-12 w-full" variant="outline" onClick={() => setShowOptional(value => !value)}>{showOptional ? 'Hide optional item details' : 'Show optional item details'}</Button>
      {variantFields.filter(field => field.aspect?.mode === 'SELECTION_ONLY').map(field => <div key={`${field.name}-${field.value}`}><Label htmlFor={`variant-${field.name}-${field.value}`}>eBay {field.name} for {field.value}</Label>
        <select id={`variant-${field.name}-${field.value}`} className="min-h-12 w-full border rounded-md bg-background px-3" value={field.selected} onChange={event => { const value = event.target.value; setDirty(true); setSettings(current => ({ ...current, variationValues: { ...current.variationValues, [field.name]: { ...current.variationValues?.[field.name], [field.value]: value } } })); }}>
          {!field.aspect!.values.includes(field.selected) && <option value={field.selected}>Choose an eBay value for {field.value}</option>}{field.aspect!.values.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>)}
      {data.variants.length > 0 && <div><p className="font-medium">{data.variants.length} saved product variations</p><p className="text-sm">{data.variants.map(row => `${row.size} / ${row.color}`).join(' · ')}</p><p className="text-xs text-muted-foreground">Change sizes and colors on the built product. Item Setup controls the price and quantity per variation.</p></div>}
      <p className="text-sm">Category and item details are shared by this product’s eBay listings. Seller policies belong to this account.</p>
    </div>}
    <DialogFooter className="gap-2 [&>button]:min-h-12"><Button variant="outline" onClick={close} disabled={save.isPending}>Cancel</Button><Button data-testid="button-save-ebay-setup" onClick={() => save.mutate()} disabled={!complete || lookup.isPending || save.isPending || createLocation.isPending}>{save.isPending ? 'Saving…' : 'Save eBay Setup'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
