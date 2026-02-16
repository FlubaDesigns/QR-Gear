import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Store, Plus, Loader2, Shield } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreBuilderContext } from "../StoreBuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

interface PartnerStore {
  id: string;
  name: string;
  isInternal: boolean;
  isActive: boolean;
  availableSegments: string[];
}

export function StorePickerModule() {
  const { step, currentStore, setCurrentStore, setCurrentChannel, setStep } = useStoreBuilderContext();
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const { toast } = useToast();
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");

  const { data: stores = [], isLoading } = useQuery<PartnerStore[]>({
    queryKey: [`${apiBase}/partner-stores`],
  });

  const createStoreMutation = useMutation({
    mutationFn: async (name: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name, roleType: "internal" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create store");
      }
      return res.json();
    },
    onSuccess: (newStore) => {
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/partner-stores`] });
      setCurrentStore({
        id: newStore.id,
        name: newStore.name,
        permissions: [],
        productLimit: 50,
        products: [],
      });
      setCurrentChannel(null);
      setNewStoreName("");
      setShowAddStore(false);
      if (step === "store") setStep("channel");
      toast({ title: "Store created", description: `"${newStore.name}" is ready to use.` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create store", description: error.message, variant: "destructive" });
    },
  });

  const handleStoreSelect = (store: PartnerStore) => {
    if (currentStore?.id === store.id) {
      setCurrentStore(null);
      setCurrentChannel(null);
    } else {
      setCurrentStore({
        id: store.id,
        name: store.name,
        permissions: store.availableSegments || [],
        productLimit: 50,
        products: [],
      });
      setCurrentChannel(null);
      if (step === "store") setStep("channel");
    }
  };

  const handleAddStore = () => {
    if (!newStoreName.trim()) return;
    createStoreMutation.mutate(newStoreName.trim());
  };

  return (
    <CollapsibleModule
      title="Select Store"
      icon={<Store className="h-4 w-4" />}
      defaultOpen={step === "store" || !currentStore}
      badge={currentStore ? <Badge variant="secondary">{currentStore.name}</Badge> : undefined}
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
                const isSelected = currentStore?.id === store.id;
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
                    {store.isInternal && (
                      <Shield className="h-3 w-3 text-primary" />
                    )}
                    {store.availableSegments?.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {store.availableSegments.length}
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

          {currentStore && currentStore.permissions.length > 0 && (
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Available Segments:</p>
              <div className="flex flex-wrap gap-1">
                {currentStore.permissions.map(seg => (
                  <Badge key={seg} variant="outline" className="text-xs">{seg}</Badge>
                ))}
              </div>
            </div>
          )}

          {showAddStore && (
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
              <Input
                type="text"
                inputMode="text"
                placeholder="Store name..."
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                className="max-w-xs"
                onKeyDown={(e) => e.key === "Enter" && handleAddStore()}
                data-testid="input-store-name"
              />
              <Button
                size="sm"
                onClick={handleAddStore}
                disabled={!newStoreName.trim() || createStoreMutation.isPending}
                data-testid="button-save-store"
              >
                {createStoreMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
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
