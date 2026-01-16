import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Library, ArrowRight } from "lucide-react";
import { StoreLibraryProvider, useStoreLibraryContext, ProductInfo } from "./StoreLibraryContext";
import { StoreTypeFilterModule } from "./modules/StoreTypeFilterModule";
import { StoreListModule } from "./modules/StoreListModule";
import { ChannelListModule } from "./modules/ChannelListModule";
import { ProductGridModule } from "./modules/ProductGridModule";
import { SharedLightbox, LightboxItem, LightboxAction } from "@/features/shared/components/SharedLightbox";
import { useToast } from "@/hooks/use-toast";

function productToLightboxItem(product: ProductInfo): LightboxItem {
  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    subtitle: product.enabledColors?.length 
      ? `${product.enabledColors.length} colors` 
      : undefined,
  };
}

function StoreLibraryInner() {
  const { 
    selectedType, 
    selectedStore, 
    selectedChannel, 
    selectedProducts,
    removeFromSelection,
    clearSelection,
  } = useStoreLibraryContext();
  const { toast } = useToast();

  const lightboxItems = selectedProducts.map(productToLightboxItem);

  const handleMove = (items: LightboxItem[]) => {
    toast({
      title: "Move action triggered",
      description: `Moving ${items.length} product(s) to target store`,
    });
  };

  const actions: LightboxAction[] = [
    {
      id: "move",
      label: "Move to Target Store",
      icon: <ArrowRight className="w-4 h-4" />,
      variant: "default",
      onClick: handleMove,
    },
  ];

  return (
    <div className="flex gap-4" data-testid="container-store-library">
      <Card className="flex-1" data-testid="card-store-library">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" data-testid="title-store-library">
            <Library className="h-5 w-5" />
            Store Library
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
          <ChannelListModule />
          <ProductGridModule />
        </CardContent>
      </Card>

      <SharedLightbox
        items={lightboxItems}
        onRemoveItem={removeFromSelection}
        onClearAll={clearSelection}
        actions={actions}
        title="Selected Products"
        emptyMessage="Click products to select them"
        className="w-72 min-h-[400px]"
      />
    </div>
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
