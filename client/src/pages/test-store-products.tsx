import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Store, 
  Package, 
  Save, 
  Loader2,
  Check,
  X,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import SEO from "@/components/SEO";

interface StoreData {
  id: string;
  name: string;
  roleType: string;
}

interface ProductBlueprint {
  id: number;
  title: string;
  brand?: string;
  model?: string;
  images?: string[];
}

interface AllowedProduct {
  blueprintId: number;
  title: string;
  addedAt: string;
}

export default function TestStoreProducts() {
  const { toast } = useToast();
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: stores = [], isLoading: storesLoading } = useQuery<StoreData[]>({
    queryKey: ["/api/test/stores"],
    queryFn: async () => {
      const res = await fetch("/api/test/stores");
      return res.json();
    },
  });

  const memberStores = stores.filter(s => s.roleType === "member");

  const { data: blueprints = [], isLoading: blueprintsLoading } = useQuery<ProductBlueprint[]>({
    queryKey: ["/api/test/printify/local-blueprints"],
    queryFn: async () => {
      const res = await fetch("/api/test/printify/local-blueprints");
      const data = await res.json();
      return data.blueprints || [];
    },
  });

  const { data: allowedData, isLoading: allowedLoading, refetch: refetchAllowed } = useQuery({
    queryKey: ["/api/test/stores", selectedStoreId, "allowed-products"],
    queryFn: async () => {
      if (!selectedStoreId) return { products: [] };
      const res = await fetch(`/api/test/stores/${selectedStoreId}/allowed-products`);
      return res.json();
    },
    enabled: !!selectedStoreId,
  });

  useEffect(() => {
    if (allowedData?.products) {
      const ids = new Set<number>(allowedData.products.map((p: AllowedProduct) => p.blueprintId));
      setSelectedProducts(ids);
      setHasChanges(false);
    }
  }, [allowedData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const products = Array.from(selectedProducts).map(blueprintId => {
        const bp = blueprints.find(b => b.id === blueprintId);
        return {
          blueprintId,
          title: bp?.title || `Product ${blueprintId}`,
          addedAt: new Date().toISOString(),
        };
      });
      
      const res = await fetch(`/api/test/stores/${selectedStoreId}/allowed-products`, {
        method: "POST",
        body: JSON.stringify({ products }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: `${selectedProducts.size} products assigned to store` });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/test/stores", selectedStoreId, "allowed-products"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleProduct = (blueprintId: number) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(blueprintId)) {
        next.delete(blueprintId);
      } else {
        next.add(blueprintId);
      }
      return next;
    });
    setHasChanges(true);
  };

  const selectAll = () => {
    const filtered = getFilteredBlueprints();
    setSelectedProducts(new Set(filtered.map(b => b.id)));
    setHasChanges(true);
  };

  const clearAll = () => {
    setSelectedProducts(new Set());
    setHasChanges(true);
  };

  const getFilteredBlueprints = () => {
    if (categoryFilter === "all") return blueprints;
    return blueprints.filter(bp => {
      const title = bp.title.toLowerCase();
      if (categoryFilter === "shirts") return title.includes("shirt") || title.includes("tee");
      if (categoryFilter === "hats") return title.includes("hat") || title.includes("cap") || title.includes("beanie");
      if (categoryFilter === "mugs") return title.includes("mug") || title.includes("cup");
      if (categoryFilter === "bags") return title.includes("bag") || title.includes("tote");
      return true;
    });
  };

  const filteredBlueprints = getFilteredBlueprints();

  return (
    <>
      <SEO title="Store Product Assignment | Test" />
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
          <div className="glass-card">
            <h1 className="glass-title text-xl mb-2 flex items-center gap-2" data-testid="text-page-title">
              <Package className="h-6 w-6 text-blue-400" />
              Assign Blank Products to Store
            </h1>
            <p className="text-muted-foreground text-sm mb-4">
              Select which products members can use to create their own merchandise.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Select Store</label>
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger data-testid="select-store">
                    <SelectValue placeholder="Choose a member store..." />
                  </SelectTrigger>
                  <SelectContent>
                    {memberStores.map(store => (
                      <SelectItem key={store.id} value={store.id}>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          {store.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Filter by Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="shirts">Shirts & Tees</SelectItem>
                    <SelectItem value="hats">Hats & Caps</SelectItem>
                    <SelectItem value="mugs">Mugs & Cups</SelectItem>
                    <SelectItem value="bags">Bags & Totes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedStoreId && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedProducts.size} selected
                  </Badge>
                  {hasChanges && (
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                      Unsaved changes
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
                    <Check className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAll} data-testid="button-clear-all">
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => saveMutation.mutate()}
                    disabled={!hasChanges || saveMutation.isPending}
                    data-testid="button-save"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!selectedStoreId ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Select a member store to assign products.
                </p>
              </CardContent>
            </Card>
          ) : blueprintsLoading || allowedLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading products...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredBlueprints.map(bp => {
                const isSelected = selectedProducts.has(bp.id);
                const imageUrl = bp.images?.[0] || "";
                
                return (
                  <Card 
                    key={bp.id}
                    className={`cursor-pointer transition-all overflow-hidden ${
                      isSelected ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"
                    }`}
                    onClick={() => toggleProduct(bp.id)}
                    data-testid={`product-card-${bp.id}`}
                  >
                    <div className="relative aspect-square bg-muted">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={bp.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <Checkbox 
                          checked={isSelected}
                          className="bg-background"
                          data-testid={`checkbox-${bp.id}`}
                        />
                      </div>
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs font-medium line-clamp-2">
                        {bp.title}
                      </p>
                      {bp.brand && (
                        <p className="text-xs text-muted-foreground">{bp.brand}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {filteredBlueprints.length === 0 && !blueprintsLoading && selectedStoreId && (
            <Card>
              <CardContent className="py-8 text-center">
                <Filter className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No products match this filter.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
