import { BuilderProvider } from "./BuilderContext";
import { SourceModule } from "./modules/SourceModule";
import { FulfillmentModule } from "./modules/FulfillmentModule";
import { CategoryModule } from "./modules/CategoryModule";
import { ProductsModule } from "./modules/ProductsModule";

export function BuilderHarness() {
  return (
    <BuilderProvider>
      <div className="space-y-4">
        <SourceModule />
        <FulfillmentModule />
        <CategoryModule />
        <ProductsModule />
      </div>
    </BuilderProvider>
  );
}
