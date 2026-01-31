import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Store, Plus, Loader2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useProductsContext } from "../ProductsContext";
import type { Store as StoreType } from "../shared/types";

export function StoreModule() {
  const { 
    api, 
    selectedRole, 
    selectedStore, 
    setSelectedStore, 
    setSelectedChannel,
    roles 
  } = useProductsContext();
  
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");

  const { data: stores = [], isLoading } = useQuery<StoreType[]>({
    queryKey: ["stores", selectedRole],
    queryFn: () => selectedRole ? api.fetchStores(selectedRole) : Promise.resolve([]),
    enabled: !!selectedRole,
  });

  const handleStoreSelect = (store: StoreType) => {
    if (selectedStore?.id === store.id) {
      setSelectedStore(null);
      setSelectedChannel(null);
    } else {
      setSelectedStore(store);
      setSelectedChannel(null);
    }
  };

  const handleAddStore = () => {
    if (!newStoreName.trim()) return;
    console.log("TODO: Add store", newStoreName, selectedRole);
    setNewStoreName("");
    setShowAddStore(false);
  };

  if (!selectedRole) {
    return null;
  }

  const roleName = roles.find(r => r.id === selectedRole)?.name || selectedRole;

  return (
    <CollapsibleModule
      title={`${roleName} Stores`}
      icon={<Store className="h-4 w-4" />}
      defaultOpen={true}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading stores...</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stores yet</p>
            ) : (
              stores.map((store) => {
                const isSelected = selectedStore?.id === store.id;
                return (
                  <Button
                    key={store.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleStoreSelect(store)}
                    data-testid={`button-store-${store.id}`}
                  >
                    <Store className="h-3 w-3" />
                    <span>{store.name}</span>
                    {store.channelCount !== undefined && store.channelCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {store.channelCount}
                      </Badge>
                    )}
                  </Button>
                );
              })
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => setShowAddStore(!showAddStore)}
              data-testid="button-add-store"
            >
              <Plus className="h-3 w-3" />
              Add Store
            </Button>
          </div>

          {showAddStore && (
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
              <Input
                placeholder="Store name..."
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                className="max-w-xs"
                data-testid="input-store-name"
              />
              <Button
                size="sm"
                onClick={handleAddStore}
                disabled={!newStoreName.trim()}
                data-testid="button-save-store"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddStore(false);
                  setNewStoreName("");
                }}
                data-testid="button-cancel-store"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </CollapsibleModule>
  );
}

export default StoreModule;
