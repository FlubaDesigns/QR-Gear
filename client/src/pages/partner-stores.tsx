import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PartnerStore, Product } from "@shared/schema";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  Home,
  Plus,
  Store,
  Loader2,
  ArrowLeft,
  Save,
  Trash2,
} from "lucide-react";

type StoreFormData = {
  name: string;
  slug: string;
  description: string;
  websiteUrl: string;
  primaryColor: string;
  accentColor: string;
  commissionPercent: string;
  isActive: boolean;
};

type ProductConfig = {
  enabledSizes: string[];
  enabledColors: string[];
};

export default function PartnerStoresPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<StoreFormData>({
    name: "",
    slug: "",
    description: "",
    websiteUrl: "",
    primaryColor: "#1e40af",
    accentColor: "#3b82f6",
    commissionPercent: "0",
    isActive: true,
  });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productConfigs, setProductConfigs] = useState<Record<string, ProductConfig>>({});

  const { data: stores, isLoading: storesLoading } = useQuery<PartnerStore[]>({
    queryKey: ["/api/admin/partner-stores"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: storeProducts, isLoading: storeProductsLoading } = useQuery({
    queryKey: ["/api/admin/partner-stores", selectedStoreId, "products"],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const res = await fetch(`/api/admin/partner-stores/${selectedStoreId}/products`);
      return res.json();
    },
    enabled: !!selectedStoreId,
  });

  const createMutation = useMutation({
    mutationFn: (data: StoreFormData) => apiRequest("POST", "/api/admin/partner-stores", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      toast({ title: "Store created" });
      setIsCreating(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StoreFormData }) =>
      apiRequest("PUT", `/api/admin/partner-stores/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      toast({ title: "Store updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/partner-stores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      toast({ title: "Store deleted" });
      setSelectedStoreId(null);
      resetForm();
    },
  });

  const syncProductsMutation = useMutation({
    mutationFn: async ({ storeId, productIds, configs }: { 
      storeId: string; 
      productIds: string[]; 
      configs: Record<string, ProductConfig> 
    }) => {
      await apiRequest("POST", `/api/admin/partner-stores/${storeId}/products`, { productIds });
      for (const productId of productIds) {
        const config = configs[productId];
        if (config) {
          await apiRequest("PATCH", `/api/admin/partner-stores/${storeId}/products/${productId}`, {
            enabledSizes: config.enabledSizes,
            enabledColors: config.enabledColors,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores", selectedStoreId, "products"] });
      toast({ title: "Products saved" });
    },
  });

  function resetForm() {
    setFormData({
      name: "",
      slug: "",
      description: "",
      websiteUrl: "",
      primaryColor: "#1e40af",
      accentColor: "#3b82f6",
      commissionPercent: "0",
      isActive: true,
    });
    setSelectedProducts([]);
    setProductConfigs({});
  }

  function selectStore(store: PartnerStore) {
    setSelectedStoreId(store.id);
    setIsCreating(false);
    setFormData({
      name: store.name,
      slug: store.slug,
      description: store.description || "",
      websiteUrl: store.websiteUrl || "",
      primaryColor: store.primaryColor || "#1e40af",
      accentColor: store.accentColor || "#3b82f6",
      commissionPercent: store.commissionPercent || "0",
      isActive: store.isActive ?? true,
    });
  }

  function startCreate() {
    setSelectedStoreId(null);
    setIsCreating(true);
    resetForm();
  }

  function handleSaveStore() {
    const slug = formData.slug.trim() || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const dataWithSlug = { ...formData, slug };

    if (selectedStoreId) {
      updateMutation.mutate({ id: selectedStoreId, data: dataWithSlug });
    } else {
      createMutation.mutate(dataWithSlug);
    }
  }

  function handleSaveProducts() {
    if (!selectedStoreId) return;
    syncProductsMutation.mutate({
      storeId: selectedStoreId,
      productIds: selectedProducts,
      configs: productConfigs,
    });
  }

  function toggleProduct(productId: string) {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }

  function toggleSize(productId: string, size: string, allSizes: string[]) {
    setProductConfigs(prev => {
      const current = prev[productId]?.enabledSizes || allSizes;
      const newSizes = current.includes(size)
        ? current.filter(s => s !== size)
        : [...current, size];
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          enabledSizes: newSizes,
          enabledColors: prev[productId]?.enabledColors || [],
        },
      };
    });
  }

  function toggleColor(productId: string, colorName: string, allColors: string[]) {
    setProductConfigs(prev => {
      const current = prev[productId]?.enabledColors || allColors;
      const newColors = current.includes(colorName)
        ? current.filter(c => c !== colorName)
        : [...current, colorName];
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          enabledSizes: prev[productId]?.enabledSizes || [],
          enabledColors: newColors,
        },
      };
    });
  }

  // Load store products into state when fetched
  if (storeProducts && storeProducts.length > 0 && selectedProducts.length === 0) {
    const ids = storeProducts.map((p: any) => p.productId);
    const configs: Record<string, ProductConfig> = {};
    storeProducts.forEach((p: any) => {
      configs[p.productId] = {
        enabledSizes: p.enabledSizes || [],
        enabledColors: p.enabledColors || [],
      };
    });
    setSelectedProducts(ids);
    setProductConfigs(configs);
  }

  if (!user) {
    return (
      <div className="container mx-auto p-8 text-center">
        <p>Please log in to access this page.</p>
      </div>
    );
  }

  const enabledProducts = products?.filter(p => p.isEnabled) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-2 px-6 py-4 border-b text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground" data-testid="link-home">
          <Home className="h-4 w-4" />
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/admin" className="hover:text-foreground" data-testid="link-admin">
          Admin
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Partner Stores</span>
      </div>

      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Partner Stores</h1>
            <p className="text-muted-foreground">Manage stores for Kingdom Connects and other partners</p>
          </div>
          <Link href="/admin">
            <Button variant="outline" data-testid="button-back-admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-lg">Stores</CardTitle>
              <Button size="sm" onClick={startCreate} data-testid="button-create-store">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {storesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : stores && stores.length > 0 ? (
                <div className="divide-y">
                  {stores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => selectStore(store)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                        selectedStoreId === store.id ? "bg-primary/10 border-l-4 border-primary" : ""
                      }`}
                      data-testid={`button-store-${store.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Store className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{store.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{store.slug}</div>
                        </div>
                        <Badge variant={store.isActive ? "default" : "secondary"}>
                          {store.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No stores yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {!selectedStoreId && !isCreating ? (
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Store className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Store</h3>
                <p className="text-muted-foreground mb-4">Choose a store from the list or create a new one</p>
                <Button onClick={startCreate} data-testid="button-create-store-cta">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Store
                </Button>
              </CardContent>
            ) : (
              <>
                <CardHeader className="pb-4">
                  <CardTitle>{isCreating ? "Create New Store" : "Edit Store"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Store Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Kingdom Connects"
                        data-testid="input-store-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={e => setFormData({ ...formData, slug: e.target.value })}
                        placeholder="kingdom-connects"
                        data-testid="input-store-slug"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="website">Website URL</Label>
                      <Input
                        id="website"
                        value={formData.websiteUrl}
                        onChange={e => setFormData({ ...formData, websiteUrl: e.target.value })}
                        placeholder="https://kingdomconnects.com"
                        data-testid="input-store-website"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commission">Commission %</Label>
                      <Input
                        id="commission"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.commissionPercent}
                        onChange={e => setFormData({ ...formData, commissionPercent: e.target.value })}
                        data-testid="input-store-commission"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <Switch
                        id="active"
                        checked={formData.isActive}
                        onCheckedChange={checked => setFormData({ ...formData, isActive: checked })}
                        data-testid="switch-store-active"
                      />
                      <Label htmlFor="active">Store Active</Label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveStore}
                      disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-store"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <Save className="h-4 w-4 mr-2" />
                      {isCreating ? "Create Store" : "Save Changes"}
                    </Button>
                    {selectedStoreId && (
                      <Button
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(selectedStoreId)}
                        disabled={deleteMutation.isPending}
                        data-testid="button-delete-store"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>

                  {selectedStoreId && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-semibold">Products</h3>
                            <p className="text-sm text-muted-foreground">
                              Select products and configure sizes/colors for this store
                            </p>
                          </div>
                          <Button
                            onClick={handleSaveProducts}
                            disabled={syncProductsMutation.isPending}
                            size="sm"
                            data-testid="button-save-products"
                          >
                            {syncProductsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Products
                          </Button>
                        </div>

                        {storeProductsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : (
                          <ScrollArea className="h-[400px] border rounded-lg">
                            <div className="divide-y">
                              {enabledProducts.map(product => {
                                const isSelected = selectedProducts.includes(product.id);
                                const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
                                const colors = Array.isArray(product.availableColors)
                                  ? (product.availableColors as Array<{ name: string; hex: string }>)
                                  : [];
                                const config = productConfigs[product.id];
                                const enabledSizes = config?.enabledSizes || sizes;
                                const enabledColors = config?.enabledColors || colors.map(c => c.name);

                                return (
                                  <div
                                    key={product.id}
                                    className="p-4"
                                    data-testid={`product-row-${product.id}`}
                                  >
                                    <div className="flex items-start gap-4 mb-4">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleProduct(product.id)}
                                        className="mt-1"
                                        data-testid={`checkbox-product-${product.id}`}
                                      />
                                      {product.imageUrl && (
                                        <img
                                          src={product.imageUrl}
                                          alt=""
                                          className="w-16 h-16 rounded object-cover"
                                        />
                                      )}
                                      <div className="flex-1">
                                        <div className="font-medium">{product.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                          ${product.basePrice}
                                        </div>
                                      </div>
                                      {isSelected && <Badge>Included</Badge>}
                                    </div>

                                    {sizes.length > 0 && (
                                      <div className="ml-10 mb-3">
                                        <div className="text-xs font-medium text-muted-foreground mb-2">
                                          Sizes
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {sizes.map(size => (
                                            <div
                                              key={size}
                                              className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg"
                                            >
                                              <Switch
                                                checked={enabledSizes.includes(size)}
                                                onCheckedChange={() => toggleSize(product.id, size, sizes)}
                                                data-testid={`switch-size-${product.id}-${size}`}
                                              />
                                              <span className="text-sm font-medium">{size}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {colors.length > 0 && (
                                      <div className="ml-10">
                                        <div className="text-xs font-medium text-muted-foreground mb-2">
                                          Colors
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {colors.map(color => (
                                            <div
                                              key={color.name}
                                              className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg"
                                            >
                                              <Switch
                                                checked={enabledColors.includes(color.name)}
                                                onCheckedChange={() =>
                                                  toggleColor(product.id, color.name, colors.map(c => c.name))
                                                }
                                                data-testid={`switch-color-${product.id}-${color.name}`}
                                              />
                                              <div
                                                className="w-5 h-5 rounded-full border-2 border-white shadow"
                                                style={{ backgroundColor: color.hex }}
                                              />
                                              <span className="text-sm">{color.name}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
