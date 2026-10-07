import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { InstanceCard, type AdminInstance } from '../../storeManager/StoreManagerTab';
import { refreshStoreViews } from '@/features/storeBuilder/storeQueries';
import { useStoreLibraryContext } from '../StoreLibraryContext';
import { PublishStatusBadge } from '../components/PublishStatusBadge';

type StoreProduct = AdminInstance & { printifyProductId?: string; publishStatus?: 'synced' | 'pending' | 'error'; lastPublishedAt?: string; publishError?: string };
function PublishStatus({ product }: { product: StoreProduct }) {
  const client = useQueryClient(), { toast } = useToast(), lock = useRef(false);
  const publish = useMutation({ mutationFn: () => adminFetch(`/qrg/republish/${encodeURIComponent(product.id)}`, {method:'POST'}),
    onSuccess: async () => { await refreshStoreViews(client); toast({title:'Product synced to Printify'}); },
    onError: (error: Error) => toast({title:'Republish failed',description:error.message,variant:'destructive'}),
    onSettled: () => { lock.current = false; },
  });
  if (!product.printifyProductId) return null;
  return <div className="rounded-md border p-3 space-y-2"><p className="text-sm">Printify</p><PublishStatusBadge {...product}
    onRepublish={() => { if (!lock.current) { lock.current = true; publish.mutate(); } }} isRepublishing={publish.isPending} /></div>;
}
export function ProductGridModule() {
  const { selectedStore, selectedChannel, destinationError, loadingChannels } = useStoreLibraryContext();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const query = useQuery<{instances:StoreProduct[]}>({
    queryKey:['admin-instances',selectedStore?.id,selectedChannel?.id ?? null,null],
    enabled:!!selectedStore && !destinationError && !loadingChannels,
    queryFn:async () => {
      const params = new URLSearchParams({storeId:selectedStore!.id});
      if (selectedChannel) params.set('channelId',selectedChannel.id);
      const data = await adminFetch<{instances:StoreProduct[]}>(`/catalog-instances?${params}`);
      if (!Array.isArray(data.instances)) throw new Error('Invalid product response'); return data;
    },
  });
  if (!selectedStore) return <p className="text-sm text-muted-foreground">Choose a store to see its saved products.</p>;
  if (destinationError) return null;
  if (loadingChannels || query.isLoading) return <p role="status">Loading products…</p>;
  if (query.error) return <div role="alert" className="space-y-2"><p>Could not load store products.</p><Button className="h-12" onClick={() => query.refetch()}>Retry</Button></div>;
  const products = query.data?.instances || [];
  const visible = products.filter(p => `${p.resolved?.title || ''} ${p.id} ${p.collectionName || ''}`.toLowerCase().includes(search.toLowerCase()));
  const refresh = () => { void refreshStoreViews(client); };
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold [overflow-wrap:anywhere]">{selectedStore.name}{selectedChannel ? ` / ${selectedChannel.name}` : ' / All channels'}</h2><Button variant="outline" className="h-12" disabled={query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? 'Refreshing…' : 'Refresh'}</Button></div>
    <Input className="h-12 text-base" aria-label="Find store products" placeholder="Find a product…" value={search} onChange={e => setSearch(e.target.value)} />
    <p className="text-sm text-muted-foreground">{visible.length} product{visible.length === 1 ? '' : 's'}</p>
    {!products.length ? <p>No products assigned here yet.</p> : !visible.length ? <p>No products match your search.</p> :
      <div className="grid min-w-0 grid-cols-1 xl:grid-cols-2 gap-4">{visible.map(product => <div key={product.id} className="min-w-0 space-y-2">
        {!selectedChannel && <p className="text-sm [overflow-wrap:anywhere]">{product.channelName || 'Needs a channel'}{product.collectionName ? ` / ${product.collectionName}` : ''}</p>}
        <InstanceCard instance={product} onDeleted={refresh} onMoved={refresh} /><PublishStatus product={product} />
      </div>)}</div>}
  </div>;
}
