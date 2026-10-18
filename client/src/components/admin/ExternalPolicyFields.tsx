import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

type Policy = { id: string; name: string; status: string };
export function ExternalPolicyFields({ pricingId, revenueId, onChange, inherited = false }: {
 pricingId: string; revenueId: string; onChange: (kind: 'pricing' | 'revenue', id: string) => void; inherited?: boolean;
}) {
 const pricing = useQuery<Policy[]>({ queryKey: ['/api/admin/external/pricing-policies'] });
 const revenue = useQuery<Policy[]>({ queryKey: ['/api/admin/external/revenue-splits'] });
 if (pricing.isError || revenue.isError) return <div role="alert">Policy assignments could not be loaded. <Button type="button" onClick={() => { void pricing.refetch(); void revenue.refetch(); }}>Retry</Button></div>;
 return <div className="space-y-3">
  {([['pricing', 'Pricing policy', pricingId, pricing], ['revenue', 'Revenue split', revenueId, revenue]] as const).map(([kind, label, value, query]) => <label key={kind} className="block text-sm">{label}
   <select className="block w-full rounded border bg-background p-2" value={value} disabled={query.isLoading} onChange={e => onChange(kind, e.target.value)}>
    <option value="">{query.isLoading ? 'Loading…' : inherited ? 'Use host default' : 'No default assigned'}</option>
    {value && !query.data?.some(p => p.id === value) && <option value={value}>Unavailable policy ({value}) — choose another</option>}
    {query.data?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.status})</option>)}
   </select>
  </label>)}
  <p className="text-xs text-muted-foreground">These assignments configure legacy embeds. Legacy embed checkout is disabled.</p>
 </div>;
}
