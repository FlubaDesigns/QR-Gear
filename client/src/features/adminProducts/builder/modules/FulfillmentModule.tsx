import { useEffect } from "react";
import { Package, CheckCircle, Store, Layers } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Badge } from "@/components/ui/badge";
import { useBuilderContext } from "../BuilderContext";
import { useProductsContext } from "../../ProductsContext";

export function FulfillmentModule() {
  const { state, setSourceType, setFulfillmentProvider } = useBuilderContext();
  const { selectedStore, selectedChannel } = useProductsContext();

  useEffect(() => {
    if (!state.sourceType) {
      setSourceType("custom");
    }
  }, [state.sourceType, setSourceType]);

  useEffect(() => {
    if (state.sourceType === "custom" && !state.fulfillmentProvider) {
      setFulfillmentProvider("printify");
    }
  }, [state.sourceType, state.fulfillmentProvider, setFulfillmentProvider]);

  if (state.sourceType !== "custom") {
    return null;
  }

  return (
    <CollapsibleModule
      title="Fulfillment Center"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-2">
        {selectedStore && (
          <div className="flex items-center gap-2 p-3 bg-accent/10 rounded-md border">
            <Store className="h-4 w-4 text-accent-foreground" />
            <span className="font-medium">{selectedStore.name}</span>
            <Badge variant="outline" className="ml-auto">Store</Badge>
          </div>
        )}
        
        {selectedChannel && (
          <div className="flex items-center gap-2 p-3 bg-accent/10 rounded-md border">
            <Layers className="h-4 w-4 text-accent-foreground" />
            <span className="font-medium">{selectedChannel.name}</span>
            <Badge variant="outline" className="ml-auto">Channel</Badge>
          </div>
        )}

        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-md border">
          <CheckCircle className="h-4 w-4 text-primary" />
          <span className="font-medium">Printify</span>
          <Badge variant="secondary" className="ml-auto">Fulfillment</Badge>
        </div>
      </div>
    </CollapsibleModule>
  );
}
