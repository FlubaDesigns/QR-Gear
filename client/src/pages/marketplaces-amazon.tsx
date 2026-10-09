import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { amazonManagedAttribute, type AmazonSellerSettings, type MarketplaceListing } from '@shared/surfaces';

type Schema = Record<string, any>;
type Setup = { productType: string; settings: AmazonSellerSettings; variants: Array<{ variantKey: string; size: string; color: string; sku: string }>; options: { productTypes: Array<{ name: string; displayName: string }>; schema?: Schema; parentSchema?: Schema } };
const empty: AmazonSellerSettings = { productType: '', quantity: 0, attributes: {}, parentAttributes: {}, variantAttributes: {} };
const selectStyle = 'min-h-12 w-full rounded-md border bg-background px-3';
function resolve(schema: Schema, root: Schema): Schema {
  if (!schema.$ref?.startsWith('#/')) return schema;
  const target = schema.$ref.slice(2).split('/').reduce((obj: any, key: string) => obj?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], root);
  return target ? { ...target, ...schema, $ref: undefined } : schema;
}
function seed(schema: Schema, root: Schema, name = ''): any {
  const node = resolve(schema, root);
  if (name === 'marketplace_id') return 'ATVPDKIKX0DER';
  if (name === 'language_tag') return 'en_US';
  if (node.const !== undefined) return node.const;
  if (node.properties) return Object.fromEntries(Object.entries(node.properties).filter(([key, child]: [string, any]) => ['marketplace_id', 'language_tag'].includes(key) || child.const !== undefined).map(([key, child]) => [key, seed(child as Schema, root, key)]));
  return undefined;
}
/** Native, labelled controls for Amazon's nested attribute schema; no raw JSON entry. */
export function AmazonSchemaInput({ schema, root, value, onChange, name, depth = 0 }: { schema: Schema; root: Schema; value: any; onChange: (value: any) => void; name: string; depth?: number }) {
  const node = resolve(schema, root);
  if (depth > 12 || node.$ref) return <p role="alert">This field needs a schema format this editor does not support. Complete it in <a href="https://sellercentral.amazon.com/inventory" target="_blank" rel="noopener noreferrer" className="underline">Seller Central</a>.</p>;
  if (['marketplace_id', 'language_tag'].includes(name) || node.const !== undefined) return <p className="text-xs text-muted-foreground">{node.title || name}: {String(seed(node, root, name))}</p>;
  if (node.type === 'array' || node.items) {
    const rows = Array.isArray(value) ? value : [];
    return <div className="space-y-2">{rows.map((row, i) => <div key={i} className="rounded border p-3 space-y-2"><AmazonSchemaInput schema={node.items || {}} root={root} name={`${name}-${i}`} value={row} depth={depth + 1} onChange={next => onChange(rows.map((old, index) => index === i ? next : old))} /><Button variant="outline" className="min-h-12" onClick={() => onChange(rows.filter((_, index) => index !== i))}>Remove value {i + 1}</Button></div>)}<Button className="min-h-12 w-full" variant="outline" disabled={rows.length >= (node.maxItems || 100)} onClick={() => onChange([...rows, seed(node.items || {}, root) ?? ''])}>Add {node.title || name.replace(/_/g, ' ')}</Button></div>;
  }
  if (node.type === 'object' || node.properties) return <div className="space-y-3">{Object.entries(node.properties || {}).map(([key, child]: [string, any]) => <div key={key}><Label>{child.title || key.replace(/_/g, ' ')}{node.required?.includes(key) ? ' *' : ''}</Label><AmazonSchemaInput schema={child} root={root} value={value?.[key]} name={key} depth={depth + 1} onChange={next => { const updated = { ...(seed(node, root) || {}), ...(value || {}), [key]: next }; if (next === undefined) delete updated[key]; onChange(updated); }} /></div>)}</div>;
  const enums = node.enum || (node.type === 'boolean' ? [true, false] : null);
  if (enums) return <select aria-label={node.title || name} className={selectStyle} value={value === undefined ? '' : String(value)} onChange={event => onChange(enums.find((item: any) => String(item) === event.target.value))}><option value="">Choose a value</option>{value !== undefined && !enums.includes(value) && <option value={String(value)}>Unsupported saved value: {String(value)}</option>}{enums.map((item: any, i: number) => <option key={String(item)} value={String(item)}>{node.enumNames?.[i] || String(item)}</option>)}</select>;
  return <Input className="min-h-12" aria-label={node.title || name} type={['integer', 'number'].includes(node.type) ? 'number' : 'text'} step={node.type === 'integer' ? 1 : 'any'} value={value ?? ''} onChange={event => onChange(event.target.value === '' ? undefined : ['integer', 'number'].includes(node.type) ? Number(event.target.value) : event.target.value)} />;
}
function AttributeForm({ schema, attributes, onChange }: { schema: Schema; attributes: Record<string, any>; onChange: (attrs: Record<string, any>) => void }) {
  const [search, setSearch] = useState('');
  const [optional, setOptional] = useState(false);
  const names = Object.keys(schema.properties || {}).filter(name => !amazonManagedAttribute(name));
  return <div className="space-y-3"><Input aria-label="Find Amazon detail" placeholder="Find a detail (size, color, barcode…)" value={search} onChange={event => setSearch(event.target.value)} />
    {names.filter(name => (search ? `${name} ${schema.properties[name].title || ''}`.toLowerCase().includes(search.toLowerCase()) : optional || schema.required?.includes(name) || attributes[name] !== undefined)).map(name => <details key={name} className="rounded border p-3"><summary className="min-h-12 cursor-pointer py-3">{schema.properties[name].title || name.replace(/_/g, ' ')}{schema.required?.includes(name) ? ' *' : ''}{attributes[name] !== undefined ? ' · Set' : ''}</summary><p className="text-sm mb-2">{schema.properties[name].description}</p><AmazonSchemaInput schema={schema.properties[name]} root={schema} name={name} value={attributes[name]} onChange={value => { const next = { ...attributes }; if (value === undefined || Array.isArray(value) && !value.length) delete next[name]; else next[name] = value; onChange(next); }} /><Button className="min-h-12 mt-2" variant="outline" onClick={() => { const next = { ...attributes }; delete next[name]; onChange(next); }}>Clear this detail</Button></details>)}
    <Button className="min-h-12 w-full" variant="outline" onClick={() => setOptional(current => !current)}>{optional ? 'Show required and saved details' : 'Show all Amazon details'}</Button><p className="text-sm">Amazon may require additional details depending on your answers. Use Check requirements to see what is still needed.</p>
  </div>;
}
export function AmazonSetupDialog({ listing, onClose }: { listing: MarketplaceListing; onClose: () => void }) {
  const { toast } = useToast();
  const initialized = useRef(false);
  const [settings, setSettings] = useState<AmazonSellerSettings>(empty);
  const [search, setSearch] = useState(listing.title || '');
  const [dirty, setDirty] = useState(false);
  const [lookedUp, setLookedUp] = useState<Setup | null>(null);
  const [previewResult, setPreviewResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const endpoint = `/api/admin/surfaces/listings/${listing.id}/amazon-setup`;
  const initial = useQuery<Setup>({ queryKey: [endpoint], queryFn: async () => (await apiRequest('GET', endpoint)).json(), retry: false, refetchOnWindowFocus: false });
  const data = lookedUp || initial.data;
  useEffect(() => { if (initial.data && !initial.isFetching && !initialized.current) { initialized.current = true; setSettings({ ...empty, ...initial.data.settings }); } }, [initial.data, initial.isFetching]);
  const change = (next: AmazonSellerSettings) => { setDirty(true); setSettings(next); setPreviewResult(null); };
  const lookup = useMutation({ mutationFn: async (query: { productType: string; q: string }) => (await apiRequest('GET', `${endpoint}?${new URLSearchParams(query)}`)).json() as Promise<Setup>, onSuccess: setLookedUp });
  const preview = useMutation({ mutationFn: async () => (await apiRequest('POST', `/api/admin/surfaces/listings/${listing.id}/amazon-preview`, { settings })).json(), onSuccess: setPreviewResult });
  const save = useMutation({ mutationFn: async () => (await apiRequest('PATCH', endpoint, { settings })).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: [endpoint] }); queryClient.invalidateQueries({ queryKey: ['/api/admin/surfaces/listings'] }); toast({ title: 'Amazon setup saved', description: 'Use Publish or Sync when ready. Amazon validates every item before submission.' }); onClose(); } });
  const busy = save.isPending || preview.isPending || lookup.isPending;
  const close = () => { if (!busy && (!dirty || window.confirm('Discard unsaved Amazon setup changes?'))) onClose(); };
  const schema = data?.productType === settings.productType ? data?.options.schema : undefined;
  const themes: string[] = schema?.properties?.variation_theme?.items?.properties?.name?.enum || [];
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto [&>button]:left-4 [&>button]:right-auto [&>button]:h-12 [&>button]:w-12"><DialogHeader><DialogTitle className="pl-12">Amazon Setup</DialogTitle></DialogHeader>
    <p>{listing.title} · Amazon US · Seller fulfilled</p>
    {initial.isLoading && <p>Loading your Amazon requirements…</p>}
    {initial.error && <div role="alert"><p>{initial.error.message}</p><Button className="min-h-12" onClick={() => initial.refetch()}>Retry</Button></div>}
    {data && <fieldset disabled={busy} className="space-y-4 min-w-0">
      <Label htmlFor="amazon-product-search">Find an Amazon product type</Label><Input id="amazon-product-search" value={search} onChange={event => setSearch(event.target.value)} /><Button className="min-h-12 w-full" variant="outline" onClick={() => lookup.mutate({ productType: settings.productType, q: search })} disabled={!search.trim()}>Search product types</Button>
      <select className={selectStyle} aria-label="Amazon product type" value={settings.productType} onChange={event => { const productType = event.target.value; if (settings.productType && !window.confirm('Changing product type clears its saved Amazon details. Continue?')) return; change({ ...empty, productType }); if (productType) lookup.mutate({ productType, q: search }); }}><option value="">Choose product type</option>{settings.productType && !data.options.productTypes.some(row => row.name === settings.productType) && <option value={settings.productType}>{settings.productType.replace(/_/g, ' ')}</option>}{data.options.productTypes.map(row => <option key={row.name} value={row.name}>{row.displayName}</option>)}</select>
      {settings.productType && !schema && <Button className="min-h-12 w-full" onClick={() => lookup.mutate({ productType: settings.productType, q: '' })}>Load requirements</Button>}
      <Label htmlFor="amazon-quantity">Available quantity per variation</Label><Input className="min-h-12" id="amazon-quantity" type="number" min={0} step={1} value={settings.quantity} onChange={event => change({ ...settings, quantity: Number(event.target.value) })} /><p className="text-sm">Zero keeps offers out of stock. Set the quantity you can fulfill. Title, price and images come from Item Setup.</p>
      {Object.keys(settings.variantAttributes || {}).some(key => !data.variants.some(variant => variant.variantKey === key)) && <Button className="min-h-12 w-full" variant="outline" onClick={() => change({ ...settings, variantAttributes: Object.fromEntries(Object.entries(settings.variantAttributes || {}).filter(([key]) => data.variants.some(variant => variant.variantKey === key))) })}>Remove details for unselected variations</Button>}
      {schema && <><p className="font-medium">Details shared by sellable items</p><AttributeForm schema={schema} attributes={settings.attributes} onChange={attributes => change({ ...settings, attributes })} />
        {!!data.variants.length && <><Label htmlFor="amazon-theme">Variation theme</Label><select id="amazon-theme" className={selectStyle} value={settings.variationTheme || ''} onChange={event => change({ ...settings, variationTheme: event.target.value })}><option value="">Choose how these items vary</option>{themes.map(theme => <option key={theme} value={theme}>{theme.replace(/_/g, ' ')}</option>)}</select>
          <p className="text-sm">{data.variants.length} saved size/color combinations. Enter Amazon size and color details for each combination below. Barcode or ASIN values must belong to that exact item. Per-item details override shared details.</p>
          {data.options.parentSchema && <details className="rounded border p-3"><summary className="min-h-12 py-3">Parent listing details</summary><p className="text-sm mb-3">The parent groups the variations; it has no price or stock.</p><AttributeForm schema={data.options.parentSchema} attributes={settings.parentAttributes || {}} onChange={parentAttributes => change({ ...settings, parentAttributes })} /></details>}
          {data.variants.map(variant => <details key={variant.variantKey} className="rounded border p-3"><summary className="min-h-12 py-3">{variant.size} / {variant.color}</summary><AttributeForm schema={schema} attributes={settings.variantAttributes?.[variant.variantKey] || {}} onChange={attrs => change({ ...settings, variantAttributes: { ...settings.variantAttributes, [variant.variantKey]: attrs } })} /></details>)}
        </>}
      </>}
    </fieldset>}
    {[lookup.error, preview.error, save.error].filter(Boolean).map((error: any, i) => <p role="alert" className="text-destructive" key={i}>{error.message}</p>)}
    {previewResult && <div role="status">{previewResult.valid ? 'Amazon validation passed for these values. Publishing will validate again; final catalog approval happens afterward.' : <><p>Amazon needs these changes:</p><ul className="list-disc pl-5">{previewResult.errors.map((error, i) => <li key={i}>{error}</li>)}</ul></>}</div>}
    <Button className="min-h-12 w-full" variant="outline" data-testid="button-amazon-preview" disabled={!schema || busy} onClick={() => preview.mutate()}>{preview.isPending ? 'Checking with Amazon…' : 'Check requirements with Amazon'}</Button>
    <DialogFooter className="gap-2 [&>button]:min-h-12"><Button variant="outline" onClick={close} disabled={busy}>Cancel</Button><Button data-testid="button-save-amazon-setup" onClick={() => save.mutate()} disabled={!schema || busy}>{save.isPending ? 'Saving…' : 'Save Amazon Setup'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
