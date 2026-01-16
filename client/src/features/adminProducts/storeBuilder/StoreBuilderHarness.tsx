import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store } from "lucide-react";
import { StoreBuilderProvider, useStoreBuilderContext } from "./StoreBuilderContext";
import { StorePickerModule } from "./modules/StorePickerModule";
import { ChannelPickerModule } from "./modules/ChannelPickerModule";
import { CatalogBrowserModule } from "./modules/CatalogBrowserModule";
import { ProductConfigureModule } from "./modules/ProductConfigureModule";
import { AssignmentModule } from "./modules/AssignmentModule";

function StoreBuilderInner() {
  const { currentStore, currentChannel, configuredProducts } = useStoreBuilderContext();

  return (
    <Card data-testid="card-store-builder">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2" data-testid="title-store-builder">
          <Store className="h-5 w-5" />
          Store Builder
          {configuredProducts.length > 0 && (
            <Badge variant="default" className="ml-auto">
              {configuredProducts.length} product{configuredProducts.length !== 1 ? 's' : ''} ready
            </Badge>
          )}
        </CardTitle>
        {(currentStore || currentChannel) && (
          <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
            {currentStore && <span>{currentStore.name}</span>}
            {currentChannel && <span>→ {currentChannel.name}</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <StorePickerModule />
        <ChannelPickerModule />
        <CatalogBrowserModule />
        <ProductConfigureModule />
        <AssignmentModule />
      </CardContent>
    </Card>
  );
}

export function StoreBuilderHarness() {
  return (
    <StoreBuilderProvider>
      <StoreBuilderInner />
    </StoreBuilderProvider>
  );
}

export default StoreBuilderHarness;
