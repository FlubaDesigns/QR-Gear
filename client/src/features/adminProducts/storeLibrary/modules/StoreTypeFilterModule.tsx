import { Button } from '@/components/ui/button';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { STORE_ROLES } from '@shared/storeRoles';
import { useStoreLibraryContext } from '../StoreLibraryContext';

export function StoreTypeFilterModule() {
  const ctx = useStoreLibraryContext();
  return <div className="min-w-0 space-y-3" data-testid="module-store-type-filter">
    <div className="grid grid-cols-2 gap-2">{STORE_ROLES.map(role => <Button key={role.id}
      className="min-h-12 h-auto whitespace-normal" variant={ctx.selectedType === role.id ? 'default' : 'outline'}
      aria-pressed={ctx.selectedType === role.id} onClick={() => ctx.setSelectedType(role.id)} data-testid={`button-type-${role.id}`}>
      {role.name}
    </Button>)}</div>
    <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="min-w-0"><p className="text-sm mb-2">Store</p><CustomDropdown value={ctx.selectedStore?.id || ''}
        options={ctx.stores.map(s => ({value:s.id,label:s.name}))} loading={ctx.loadingStores}
        onChange={id => ctx.setSelectedStore(ctx.stores.find(s => s.id === id) || null)} placeholder="Choose a store…" data-testid="dropdown-store" /></div>
      {ctx.selectedStore && <div className="min-w-0"><p className="text-sm mb-2">Channel</p><CustomDropdown value={ctx.selectedChannel?.id || ''}
        options={[{value:'',label:'All channels'},...ctx.channels.map(c => ({value:c.id,label:c.name}))]} loading={ctx.loadingChannels}
        onChange={id => ctx.setSelectedChannel(ctx.channels.find(c => c.id === id) || null)} placeholder="All channels" data-testid="dropdown-channel" /></div>}
    </div>
    {ctx.destinationError && <div role="alert" className="space-y-2"><p>{ctx.destinationError}</p><Button className="h-12" variant="outline" onClick={ctx.retryDestinations}>Retry</Button></div>}
    {!ctx.loadingStores && !ctx.destinationError && !ctx.stores.length && <p className="text-sm text-muted-foreground">No stores for this role yet.</p>}
  </div>;
}
