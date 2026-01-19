import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Store, CheckCircle2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreLibraryContext, StoreInfo } from "../StoreLibraryContext";

export function StoreListModule() {
  const { selectedType, selectedStore, setSelectedStore, apiBase } = useStoreLibraryContext();

  const { data: stores = [], isLoading, error } = useQuery<StoreInfo[]>({
    queryKey: [`${apiBase}/stores`, selectedType],
  });

  const handleSelectStore = (store: StoreInfo) => {
    setSelectedStore(store);
  };

  return (
    <CollapsibleModule
      title="Select Store"
      badge={selectedStore?.name}
      defaultOpen={true}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4" data-testid="loader-stores">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive p-2" data-testid="error-stores">
          Failed to load stores
        </div>
      ) : stores.length === 0 ? (
        <div className="text-sm text-muted-foreground p-2" data-testid="empty-stores">
          No {selectedType} stores found
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="list-stores">
          {stores.map((store) => (
            <Button
              key={store.id}
              variant={selectedStore?.id === store.id ? "default" : "outline"}
              className="justify-start h-auto py-2"
              onClick={() => handleSelectStore(store)}
              data-testid={`button-store-${store.id}`}
            >
              {selectedStore?.id === store.id ? (
                <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" />
              ) : (
                <Store className="h-4 w-4 mr-2 shrink-0" />
              )}
              <div className="text-left">
                <div className="font-medium">{store.name}</div>
                {store.description && (
                  <div className="text-xs opacity-70">{store.description}</div>
                )}
              </div>
            </Button>
          ))}
        </div>
      )}
    </CollapsibleModule>
  );
}
