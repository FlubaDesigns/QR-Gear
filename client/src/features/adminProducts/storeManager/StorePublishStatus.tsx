import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import { useToast } from '@/hooks/use-toast';
import { refreshStoreViews } from '@/features/storeBuilder/storeQueries';
import type { AdminInstance } from './StoreManagerTab';
import { PublishStatusBadge } from './PublishStatusBadge';

export function StorePublishStatus({ product }: { product: AdminInstance }) {
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
