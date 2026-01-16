import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Library } from "lucide-react";
import { StoreLibraryProvider, useStoreLibraryContext } from "./StoreLibraryContext";
import { StoreTypeFilterModule } from "./modules/StoreTypeFilterModule";
import { StoreListModule } from "./modules/StoreListModule";

function StoreLibraryInner() {
  const { selectedType, selectedStore, selectedChannel, selectedProducts } = useStoreLibraryContext();

  return (
    <Card data-testid="card-store-library">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2" data-testid="title-store-library">
          <Library className="h-5 w-5" />
          Store Library
          {selectedProducts.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {selectedProducts.length} selected
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
          <Badge variant="outline" className="capitalize">{selectedType}</Badge>
          {selectedStore && <span>→ {selectedStore.name}</span>}
          {selectedChannel && <span>→ {selectedChannel.name}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StoreTypeFilterModule />
        <StoreListModule />
      </CardContent>
    </Card>
  );
}

export function StoreLibraryHarness() {
  return (
    <StoreLibraryProvider>
      <StoreLibraryInner />
    </StoreLibraryProvider>
  );
}

export default StoreLibraryHarness;
