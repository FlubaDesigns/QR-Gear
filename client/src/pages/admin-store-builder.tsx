import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Store, Package, DollarSign, QrCode, Layers, Image, ChevronDown, ChevronUp, Check, Save, Loader2, Plus, Trash2, Users, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { StoreBuilderHarness } from "@/features/storeBuilder/StoreBuilderHarness";
import { ProductsProvider } from "@/features/adminProducts/ProductsContext";
import { BuilderProvider, useBuilderContext } from "@/features/adminProducts/builder/BuilderContext";
import { ProductsModule } from "@/features/adminProducts/builder/modules/ProductsModule";
import { useProductsContext } from "@/features/adminProducts/ProductsContext";

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
      const res = await fetch(`/api/printify/catalog/${state.selectedProduct?.id}`); 
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
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg">Add Products to: {store.name}</h3>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

{/* Simple provider toggle */}
      <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
        <span className="text-sm text-muted-foreground">Provider:</span>
        <div className="flex gap-2">
          {providers.filter(p => p.role === "fulfillment").map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProviders([p.id])}
              className={`px-3 py-1.5 rounded text-sm transition-all ${
                selectedProviders.includes(p.id) 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80"
              }`}
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
            <div>
              <p className="font-medium">{state.selectedProduct.title}</p>
              <p className="text-sm text-muted-foreground">{state.selectedProduct.brand}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Colors ({selectedColors.size})</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedColors(new Set(details.colors.map(c => c.name)))}>All</Button>
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedColors(new Set())}>None</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {details.colors.map(c => (
                <button
                  key={c.name}
                  onClick={() => toggleColor(c.name)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColors.has(c.name) ? "ring-2 ring-primary ring-offset-2" : "opacity-50"}`}
                  style={{ backgroundColor: c.hex || "#ccc" }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Sizes ({selectedSizes.size})</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedSizes(new Set(details.sizes))}>All</Button>
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedSizes(new Set())}>None</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {details.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => toggleSize(size)}
                  className={`px-3 py-1 rounded border text-sm transition-all ${selectedSizes.has(size) ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}
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
  const [addedProducts, setAddedProducts] = useState<BareProduct[]>([]);

  const { data: existingData } = useQuery({
    queryKey: ["/api/stores", store.id, "allowed-products"],
    queryFn: async () => { const res = await fetch(`/api/stores/${store.id}/allowed-products`); return res.json(); },
  });

  useEffect(() => {
    if (existingData?.products) setAddedProducts(existingData.products);
  }, [existingData]);

  const saveMutation = useMutation({
    mutationFn: async (products: BareProduct[]) => {
      const res = await fetch(`/api/stores/${store.id}/allowed-products`, { 
        method: "POST", 
        body: JSON.stringify({ products }), 
        headers: { "Content-Type": "application/json" } 
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores", store.id, "allowed-products"] });
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
        <div className="glass-card space-y-4">
          <BareProductsFulfillmentInner store={store} onClose={onClose} onProductAdded={handleProductAdded} />
          
          {addedProducts.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">In Store ({addedProducts.length})</p>
              {addedProducts.map(p => (
                <div key={p.blueprintId} className="flex items-center justify-between p-2 rounded bg-green-500/10 border">
                  <div className="flex items-center gap-2">
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="w-10 h-10 object-cover rounded" />}
                    <div className="text-sm">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.colors.length} colors, {p.sizes.length} sizes</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleRemove(p.blueprintId)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </BuilderProvider>
    </ProductsProvider>
  );
}

function BareProductPicker({ store, onClose }: { store: StoreData; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedBlueprint, setSelectedBlueprint] = useState<number | null>(null);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [addedProducts, setAddedProducts] = useState<BareProduct[]>([]);

  const { data: blueprints = [] } = useQuery<ProductBlueprint[]>({
    queryKey: ["/api/printify/local-blueprints"],
    queryFn: async () => { const res = await fetch("/api/printify/local-blueprints"); const d = await res.json(); return d.blueprints || []; },
  });

  const { data: details, isLoading: loadingDetails } = useQuery<BlueprintDetails>({
    queryKey: ["/api/printify/catalog", selectedBlueprint],
    queryFn: async () => { const res = await fetch(`/api/printify/catalog/${selectedBlueprint}`); return res.json(); },
    enabled: !!selectedBlueprint,
  });

  const { data: existingData } = useQuery({
    queryKey: ["/api/stores", store.id, "allowed-products"],
    queryFn: async () => { const res = await fetch(`/api/stores/${store.id}/allowed-products`); return res.json(); },
  });

  useEffect(() => {
    if (existingData?.products) setAddedProducts(existingData.products);
  }, [existingData]);

  useEffect(() => {
    if (details) {
      setSelectedColors(new Set(details.colors.map(c => c.name)));
      setSelectedSizes(new Set(details.sizes));
    }
  }, [details]);

  const saveMutation = useMutation({
    mutationFn: async (products: BareProduct[]) => {
      const res = await fetch(`/api/stores/${store.id}/allowed-products`, { 
        method: "POST", 
        body: JSON.stringify({ products }), 
        headers: { "Content-Type": "application/json" } 
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores", store.id, "allowed-products"] });
    },
  });

  const handleAdd = () => {
    if (!selectedBlueprint || selectedColors.size === 0 || selectedSizes.size === 0) return;
    const bp = blueprints.find(b => b.id === selectedBlueprint);
    const newProduct: BareProduct = {
      blueprintId: selectedBlueprint,
      title: bp?.title || `Product ${selectedBlueprint}`,
      colors: Array.from(selectedColors),
      sizes: Array.from(selectedSizes),
      addedAt: new Date().toISOString(),
    };
    const updated = [...addedProducts.filter(p => p.blueprintId !== selectedBlueprint), newProduct];
    setAddedProducts(updated);
    saveMutation.mutate(updated);
    toast({ title: "Added", description: `${bp?.title} added to ${store.name}` });
    setSelectedBlueprint(null);
    setSelectedColors(new Set());
    setSelectedSizes(new Set());
  };

  const handleRemove = (blueprintId: number) => {
    const updated = addedProducts.filter(p => p.blueprintId !== blueprintId);
    setAddedProducts(updated);
    saveMutation.mutate(updated);
    toast({ title: "Removed", description: "Product removed from store" });
  };

  const toggleColor = (name: string) => setSelectedColors(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const toggleSize = (size: string) => setSelectedSizes(prev => { const next = new Set(prev); next.has(size) ? next.delete(size) : next.add(size); return next; });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && selectedBlueprint && selectedColors.size > 0 && selectedSizes.size > 0) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-accent/5 space-y-4" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Add Products to: {store.name}</h3>
        <button className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose} data-testid="btn-close-picker">Close</button>
      </div>

      <Select value={selectedBlueprint?.toString() || ""} onValueChange={v => setSelectedBlueprint(parseInt(v))}>
        <SelectTrigger data-testid="select-blueprint"><SelectValue placeholder="Select a product..." /></SelectTrigger>
        <SelectContent>
          {blueprints.map(bp => (
            <SelectItem key={bp.id} value={bp.id.toString()}>{bp.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedBlueprint && loadingDetails && <p className="text-sm text-muted-foreground">Loading options...</p>}

      {selectedBlueprint && details && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Colors ({selectedColors.size})</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedColors(new Set(details.colors.map(c => c.name)))}>All</Button>
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedColors(new Set())}>None</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {details.colors.map(c => (
                <button
                  key={c.name}
                  onClick={() => toggleColor(c.name)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColors.has(c.name) ? "ring-2 ring-primary ring-offset-2" : "opacity-50"}`}
                  style={{ backgroundColor: c.hex || "#ccc" }}
                  title={c.name}
                  data-testid={`color-${c.name}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Sizes ({selectedSizes.size})</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedSizes(new Set(details.sizes))}>All</Button>
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => setSelectedSizes(new Set())}>None</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {details.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => toggleSize(size)}
                  className={`px-3 py-1 rounded border text-sm transition-all ${selectedSizes.has(size) ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}
                  data-testid={`size-${size}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button 
            className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full"
            onClick={handleAdd}
            disabled={selectedColors.size === 0 || selectedSizes.size === 0 || saveMutation.isPending}
            data-testid="btn-add-product"
          >
            {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            Add to Store
          </button>
        </>
      )}

      {addedProducts.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium">In Store ({addedProducts.length})</p>
          {addedProducts.map(p => (
            <div key={p.blueprintId} className="flex items-center justify-between p-2 rounded bg-green-500/10 border">
              <div className="text-sm">
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.colors.length} colors, {p.sizes.length} sizes</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleRemove(p.blueprintId)} data-testid={`btn-remove-${p.blueprintId}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StoreManager() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreType, setNewStoreType] = useState<string>("member");
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);

  const { data: stores = [], isLoading } = useQuery<StoreData[]>({
    queryKey: ["/api/stores"],
    queryFn: async () => { const res = await fetch("/api/stores"); return res.json(); },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStoreName.trim(), roleType: newStoreType }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Store Created", description: `${data.name} (${data.roleType})` });
      setNewStoreName("");
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const res = await fetch(`/api/stores/${storeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
    },
  });

  const memberStores = stores.filter(s => s.roleType === "member");
  const otherStores = stores.filter(s => s.roleType !== "member");

  return (
    <div className="glass-card mt-4">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left" data-testid="btn-toggle-stores">
        <span className="glass-title text-base flex items-center gap-2"><Users className="h-4 w-4 text-purple-400" /> Manage Stores</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="mt-4 space-y-4">
          {!showCreateForm ? (
            <button 
              className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full" 
              onClick={() => setShowCreateForm(true)}
              data-testid="btn-show-create-form"
            >
              <Plus className="h-5 w-5" />
              Add New Store
            </button>
          ) : (
            <div className="p-4 border rounded-lg bg-accent/5 space-y-3">
              <h3 className="font-medium text-sm">Create New Store</h3>
              <Input 
                placeholder="Store name" 
                value={newStoreName} 
                onChange={e => setNewStoreName(e.target.value)} 
                autoFocus
                data-testid="input-store-name" 
              />
              <Select value={newStoreType} onValueChange={setNewStoreType}>
                <SelectTrigger data-testid="select-store-type"><SelectValue /></SelectTrigger>
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
                  data-testid="btn-create-store"
                >
                  {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  Save Store
                </button>
                <button 
                  className="qr-btn qr-btn--outline qr-btn--touch" 
                  onClick={() => { setShowCreateForm(false); setNewStoreName(""); }}
                  data-testid="btn-cancel-create"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {editingStore && (
            <BareProductsFulfillment store={editingStore} onClose={() => setEditingStore(null)} />
          )}

          {isLoading ? <p className="text-sm text-muted-foreground">Loading stores...</p> : (
            <div className="space-y-3">
              {memberStores.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Member Stores ({memberStores.length})</p>
                  <div className="space-y-2">
                    {memberStores.map(s => (
                      <div key={s.id} className="p-3 rounded border bg-green-500/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{s.name}</span>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} data-testid={`btn-delete-${s.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <button 
                          className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full text-sm"
                          onClick={() => setEditingStore(s)}
                          data-testid={`btn-add-products-${s.id}`}
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
                  <p className="text-xs text-muted-foreground mb-2">Other Stores ({otherStores.length})</p>
                  <div className="space-y-2">
                    {otherStores.map(s => (
                      <div key={s.id} className="p-3 rounded border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{s.name} <span className="text-xs text-muted-foreground">({s.roleType})</span></span>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} data-testid={`btn-delete-${s.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <button 
                          className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full text-sm"
                          onClick={() => setEditingStore(s)}
                          data-testid={`btn-add-products-${s.id}`}
                        >
                          <Package className="h-4 w-4" />
                          Add Products
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stores.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No stores created yet</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemberProductLibrary() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const { data: blueprints = [] } = useQuery<ProductBlueprint[]>({
    queryKey: ["/api/printify/local-blueprints"],
    queryFn: async () => { const res = await fetch("/api/printify/local-blueprints"); const d = await res.json(); return d.blueprints || []; },
  });

  const { data: allowedData } = useQuery({
    queryKey: ["/api/members/allowed-products"],
    queryFn: async () => { const res = await fetch("/api/members/allowed-products"); return res.json(); },
  });

  useEffect(() => {
    if (allowedData?.products) {
      setSelectedProducts(new Set<number>(allowedData.products.map((p: BareProduct) => p.blueprintId)));
      setHasChanges(false);
    }
  }, [allowedData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const products = Array.from(selectedProducts).map(blueprintId => {
        const bp = blueprints.find(b => b.id === blueprintId);
        return { blueprintId, title: bp?.title || `Product ${blueprintId}`, addedAt: new Date().toISOString() };
      });
      const res = await fetch("/api/members/allowed-products", { method: "POST", body: JSON.stringify({ products }), headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: `${selectedProducts.size} products in member library` });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/members/allowed-products"] });
    },
  });

  const toggleProduct = (id: number) => {
    setSelectedProducts(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    setHasChanges(true);
  };

  return (
    <div className="glass-card mt-4">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left" data-testid="btn-toggle-member-library">
        <span className="glass-title text-base flex items-center gap-2"><Package className="h-4 w-4 text-green-400" /> Member Product Library</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Select products all members can use in their sandboxes:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {blueprints.map(bp => (
              <label key={bp.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent/10">
                <Checkbox checked={selectedProducts.has(bp.id)} onCheckedChange={() => toggleProduct(bp.id)} />
                <span className="text-xs truncate">{bp.title}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} data-testid="btn-save-member-library">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save ({selectedProducts.size})
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setSelectedProducts(new Set(blueprints.map(b => b.id))); setHasChanges(true); }} data-testid="btn-select-all">Select All</Button>
            <Button size="sm" variant="outline" onClick={() => { setSelectedProducts(new Set()); setHasChanges(true); }} data-testid="btn-clear-all">Clear</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminStoreBuilderPage() {
  return (
    <AdminAuthProvider apiBase="/api">
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">

          <div className="glass-card">
            <h1 className="glass-title text-lg mb-4 flex items-center gap-2" data-testid="text-page-title">
              <Store className="h-5 w-5 text-blue-400" />
              Store Builder
            </h1>
            <div className="flex flex-col gap-3">
              <Link href="/admin/products" className="block">
                <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full" data-testid="link-products">
                  <Package className="h-5 w-5" />
                  Products
                </button>
              </Link>
              <Link href="/admin/pricing" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-pricing">
                  <DollarSign className="h-5 w-5" />
                  Pricing
                </button>
              </Link>
              <Link href="/admin/library?tab=graphics" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-graphics-library">
                  <QrCode className="h-5 w-5" />
                  Graphics
                </button>
              </Link>
              <Link href="/admin/library?tab=templates" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-templates-library">
                  <Layers className="h-5 w-5" />
                  Templates
                </button>
              </Link>
              <Link href="/admin/library" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-full-library">
                  <Image className="h-5 w-5" />
                  Library
                </button>
              </Link>
            </div>
          </div>

          <StoreManager />
          <MemberProductLibrary />
          <StoreBuilderHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
