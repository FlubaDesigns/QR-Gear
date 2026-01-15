import { BuilderProvider } from "./BuilderContext";
import { SourceModule } from "./modules/SourceModule";
import { FulfillmentModule } from "./modules/FulfillmentModule";
import { CategoryModule } from "./modules/CategoryModule";
import { ProductsModule } from "./modules/ProductsModule";
import { StateModule } from "./modules/StateModule";
import { ContentModule } from "./modules/ContentModule";

export function BuilderHarness() {
  return (
    <BuilderProvider>
      <div className="space-y-4">
        <SourceModule />
        <FulfillmentModule />
        <CategoryModule />
        <ProductsModule />
        <StateModule />
        <ContentModule />
      </div>
    </BuilderProvider>
  );
}
