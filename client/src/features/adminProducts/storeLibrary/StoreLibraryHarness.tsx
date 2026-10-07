import { StoreLibraryProvider } from './StoreLibraryContext';
import { StoreTypeFilterModule } from './modules/StoreTypeFilterModule';
import { ProductGridModule } from './modules/ProductGridModule';

export function StoreLibraryHarness() {
  return <StoreLibraryProvider><div className="min-w-0 space-y-4" data-testid="container-store-library">
    <section className="glass-card p-4"><StoreTypeFilterModule /></section>
    <ProductGridModule />
  </div></StoreLibraryProvider>;
}
export default StoreLibraryHarness;
