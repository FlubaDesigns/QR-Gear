import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Store, Package, Check, Loader2, Plus, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ProductsProvider } from "@/features/adminProducts/ProductsContext";
import { BuilderProvider, useBuilderContext } from "@/features/adminProducts/builder/BuilderContext";
import { ProductsModule } from "@/features/adminProducts/builder/modules/ProductsModule";
import { useProductsContext } from "@/features/adminProducts/ProductsContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import AdminSectionCard from "@/components/admin/AdminSectionCard";

interface StoreData { id: string; name: string; roleType: string; isActive?: boolean; }
interface ProductBlueprint { id: number; title: string; }
interface BlueprintDetails { id: string; colors: Array<{ name: string; hex?: string }>; sizes: string[]; }
interface BareProduct { blueprintId: number; title: string; colors: string[]; sizes: string[]; addedAt: string; imageUrl?: string; }

function BareProductsFulfillmentInner({ store, onClose, onProductAdded }: { store: StoreData; onClose: () => void; onProductAdded: (product: BareProduct) => void }) {
  const { toast } = useToast();
  const { providers, selectedProviders, setSelectedProviders } = useProductsContext();
  const { state } = useBuilderContext();
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());

  const { data: details } = useQuery<BlueprintDetails>({
    queryKey: ["/api/printify/catalog", state.selectedProduct?.id],
    queryFn: async () => { 
      const res = await apiRequest("GET", `/api/printify/catalog/${state.selectedProduct?.id}`); 
      return res.json(); 
    },
    enabled: !!state.selectedProduct?.id,
  });

  useEffect(() => {
    if (details) {
      setSelectedColors(new Set(details.colors.map(c => c.name)));
      setSelectedSizes(new Set(details.sizes));
    }
  }, [details]);

  const toggleColor = (name: string) => setSelectedColors(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const toggleSize = (size: string) => setSelectedSizes(prev => { const next = new Set(prev); next.has(size) ? next.delete(size) : next.add(size); return next; });

  const handleAdd = () => {
    if (!state.selectedProduct || selectedColors.size === 0 || selectedSizes.size === 0) return;
    const product: BareProduct = {
      blueprintId: state.selectedProduct.id,
      title: state.selectedProduct.title,
      colors: Array.from(selectedColors),
      sizes: Array.from(selectedSizes),
      imageUrl: state.selectedProduct.imageUrl || undefined,
      addedAt: new Date().toISOString(),
    };
    onProductAdded(product);
    toast({ title: "Added", description: `${state.selectedProduct.title} added to ${store.name}` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-base truncate">Add Products to: {store.name}</h3>
        <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={onClose} data-testid="button-close-fulfillment"><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg flex-wrap">
        <span className="text-sm text-muted-foreground">Provider:</span>
        <div className="flex gap-2 flex-wrap">
          {providers.filter(p => p.role === "fulfillment").map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProviders([p.id])}
              className={`px-3 py-1.5 rounded text-sm transition-all min-h-[44px] ${
                selectedProviders.includes(p.id) 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80"
              }`}
              data-testid={`provider-${p.id}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <ProductsModule />

      {state.selectedProduct && details && (
        <div className="p-4 border rounded-lg bg-accent/5 space-y-4">
          <div className="flex items-center gap-3">
            {state.selectedProduct.imageUrl && (
              <img src={state.selectedProduct.imageUrl} alt="" className="w-16 h-16 object-cover rounded" />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{state.selectedProduct.title}</p>
              <p className="text-sm text-muted-foreground truncate">{state.selectedProduct.brand}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium">Colors ({selectedColors.size})</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setSelectedColors(new Set(details.colors.map(c => c.name)))}>All</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedColors(new Set())}>None</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {details.colors.map(c => (
                <button
                  key={c.name}
                  onClick={() => toggleColor(c.name)}
                  className={`w-11 h-11 rounded-full border-2 transition-all ${selectedColors.has(c.name) ? "ring-2 ring-primary ring-offset-2" : "opacity-50"}`}
                  style={{ backgroundColor: c.hex || "#ccc" }}
                  title={c.name}
                  data-testid={`color-inner-${c.name}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium">Sizes ({selectedSizes.size})</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setSelectedSizes(new Set(details.sizes))}>All</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedSizes(new Set())}>None</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {details.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => toggleSize(size)}
                  className={`px-3 py-2 rounded border text-sm transition-all min-h-[44px] ${selectedSizes.has(size) ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}
                  data-testid={`size-inner-${size}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button 
            className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full"
            onClick={handleAdd}
            disabled={selectedColors.size === 0 || selectedSizes.size === 0}
            data-testid="button-add-to-store"
          >
            <Plus className="h-5 w-5" />
            Add to Store
          </button>
        </div>
      )}
    </div>
  );
}

function BareProductsFulfillment({ store, onClose }: { store: StoreData; onClose: () => void }) {
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const [addedProducts, setAddedProducts] = useState<BareProduct[]>([]);

  const { data: existingData } = useQuery({
    queryKey: [`${apiBase}/stores`, store.id, "allowed-products"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores/${store.id}/allowed-products`, { headers });
      return res.json();
    },
  });

  useEffect(() => {
    if (existingData?.products) setAddedProducts(existingData.products);
  }, [existingData]);

  const saveMutation = useMutation({
    mutationFn: async (products: BareProduct[]) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores/${store.id}/allowed-products`, { 
        method: "POST", 
        body: JSON.stringify({ products }), 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/stores`, store.id, "allowed-products"] });
    },
  });

  const handleProductAdded = (product: BareProduct) => {
    const updated = [...addedProducts.filter(p => p.blueprintId !== product.blueprintId), product];
    setAddedProducts(updated);
    saveMutation.mutate(updated);
  };

  const handleRemove = (blueprintId: number) => {
    const updated = addedProducts.filter(p => p.blueprintId !== blueprintId);
    setAddedProducts(updated);
    saveMutation.mutate(updated);
  };

  return (
    <ProductsProvider>
      <BuilderProvider>
        <AdminSectionCard title={`Products in ${store.name}`} icon={Package}>
          <BareProductsFulfillmentInner store={store} onClose={onClose} onProductAdded={handleProductAdded} />
          
          {addedProducts.length > 0 && (
            <div className="border-t pt-4 mt-4 space-y-2">
              <p className="text-sm font-medium">In Store ({addedProducts.length})</p>
              {addedProducts.map(p => (
                <div key={p.blueprintId} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-green-500/10 border">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />}
                    <div className="text-sm min-w-0">
                      <p className="font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.colors.length} colors, {p.sizes.length} sizes</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => handleRemove(p.blueprintId)} data-testid={`button-remove-${p.blueprintId}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </AdminSectionCard>
      </BuilderProvider>
    </ProductsProvider>
  );
}

export function StoreManager() {
  const { toast } = useToast();
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreType, setNewStoreType] = useState<string>("member");
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);

  const { data: stores = [], isLoading } = useQuery<StoreData[]>({
    queryKey: [`${apiBase}/stores`],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores`, { headers });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStoreName.trim(), roleType: newStoreType }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Store Created", description: `${data.name} (${data.roleType})` });
      setNewStoreName("");
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/stores`] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores/${storeId}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/stores`] });
    },
  });

  const memberStores = stores.filter(s => s.roleType === "member");
  const otherStores = stores.filter(s => s.roleType !== "member");

  return (
    <div className="space-y-4">
      {editingStore && (
        <BareProductsFulfillment store={editingStore} onClose={() => setEditingStore(null)} />
      )}

      <AdminSectionCard
        title="Manage Stores"
        icon={Users}
        actions={
          !showCreateForm ? (
            <Button size="sm" onClick={() => setShowCreateForm(true)} data-testid="button-show-create">
              <Plus className="h-4 w-4 mr-1" /> New Store
            </Button>
          ) : undefined
        }
      >
        {showCreateForm && (
          <div className="p-4 border rounded-lg bg-accent/5 space-y-3 mb-4">
            <h3 className="font-medium text-sm">Create New Store</h3>
            <Input 
              placeholder="Store name" 
              value={newStoreName} 
              onChange={e => setNewStoreName(e.target.value)} 
              autoFocus
              className="min-h-[48px]"
              data-testid="input-store-name" 
            />
            <Select value={newStoreType} onValueChange={setNewStoreType}>
              <SelectTrigger className="min-h-[48px]" data-testid="select-store-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member Store</SelectItem>
                <SelectItem value="internal">Internal Store</SelectItem>
                <SelectItem value="external">External Store</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <button 
                className="qr-btn qr-btn--primary qr-btn--touch flex-1" 
                onClick={() => createMutation.mutate()} 
                disabled={!newStoreName.trim() || createMutation.isPending} 
                data-testid="button-create-store"
              >
                {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Save Store
              </button>
              <button 
                className="qr-btn qr-btn--outline qr-btn--touch" 
                onClick={() => { setShowCreateForm(false); setNewStoreName(""); }}
                data-testid="button-cancel-create"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {memberStores.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Member Stores ({memberStores.length})</p>
                <div className="space-y-2">
                  {memberStores.map(s => (
                    <div key={s.id} className="p-3 rounded-lg border bg-green-500/10 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{s.name}</span>
                        <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-${s.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <button 
                        className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full text-sm"
                        onClick={() => setEditingStore(s)}
                        data-testid={`button-add-products-${s.id}`}
                      >
                        <Package className="h-4 w-4" />
                        Add Products
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {otherStores.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Other Stores ({otherStores.length})</p>
                <div className="space-y-2">
                  {otherStores.map(s => (
                    <div key={s.id} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate">{s.name} <span className="text-xs text-muted-foreground">({s.roleType})</span></span>
                        <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-${s.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <button 
                        className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full text-sm"
                        onClick={() => setEditingStore(s)}
                        data-testid={`button-add-products-${s.id}`}
                      >
                        <Package className="h-4 w-4" />
                        Add Products
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stores.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No stores created yet</p>
            )}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
