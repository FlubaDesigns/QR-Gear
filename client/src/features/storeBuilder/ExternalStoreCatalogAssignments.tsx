import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import { Button } from '@/components/ui/button';
import { AllowedProductsEditor } from './AllowedProductsEditor';

/** Catalog assignments and Store Builder edit the same store-owned reference. */
export function ExternalStoreCatalogAssignments() {
  const [storeId, setStoreId] = useState('');
  const stores = useQuery<Array<{ id: string; name: string; isActive: boolean }>>({
    queryKey: ['/api/admin/stores?roleType=external'],
    queryFn: () => adminFetch('/stores?roleType=external'),
  });
  return <div className="row space-y-3 border-t pt-4">
    <h3 className="text-lg font-medium">External store catalogs</h3>
    <p className="text-base text-muted-foreground">Assign a catalog to one named store.</p>
    {stores.error ? <div role="alert"><p>Could not load external stores.</p><Button onClick={() => void stores.refetch()}>Retry</Button></div>
      : stores.isLoading ? <p role="status">Loading external stores…</p>
      : <>
        <label className="block space-y-2"><span>External store</span>
          <select aria-label="External store catalog destination" className="h-12 w-full rounded-md border bg-background px-3 text-base" value={storeId} disabled={!!storeId} onChange={e => setStoreId(e.target.value)}>
            <option value="">Choose a store</option>
            {(stores.data || []).map(store => <option key={store.id} value={store.id}>{store.name}{store.isActive === false ? ' (inactive)' : ''}</option>)}
          </select>
        </label>
        {!stores.data?.length && <p>No external stores have been created.</p>}
        {storeId && <AllowedProductsEditor key={storeId} storeId={storeId} onClose={() => setStoreId('')} />}
      </>}
  </div>;
}
