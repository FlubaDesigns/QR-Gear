import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  Home,
  Loader2,
  Save,
} from "lucide-react";

type ProductConfig = {
  enabledSizes: string[];
  enabledColors: string[];
};

export default function StoreBuildPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productConfigs, setProductConfigs] = useState<Record<string, ProductConfig>>({});
  const [configsLoaded, setConfigsLoaded] = useState(false);

  const { data: stores, isLoading: storesLoading } = useQuery<PartnerStore[]>({
    queryKey: ["/api/admin/partner-stores"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: storeProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/admin/partner-stores", selectedStoreId, "products"],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const res = await fetch(`/api/admin/partner-stores/${selectedStoreId}/products`);
      return res.json();
    },
    enabled: !!selectedStoreId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStoreId) return;
      await apiRequest("POST", `/api/admin/partner-stores/${selectedStoreId}/products`, { 
        productIds: selectedProducts 
      });
      for (const productId of selectedProducts) {
        const config = productConfigs[productId];
        if (config) {
          await apiRequest("PATCH", `/api/admin/partner-stores/${selectedStoreId}/products/${productId}`, {
            enabledSizes: config.enabledSizes,
            enabledColors: config.enabledColors,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores", selectedStoreId, "products"] });
      toast({ title: "Saved successfully" });
    },
  });

  if (storeProducts && storeProducts.length > 0 && !configsLoaded) {
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
    setConfigsLoaded(true);
  }

  function handleStoreChange(storeId: string) {
    setSelectedStoreId(storeId);
    setSelectedProducts([]);
    setProductConfigs({});
    setConfigsLoaded(false);
  }

  function toggleProduct(productId: string) {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }

  function toggleSize(productId: string, size: string, allSizes: string[], allColorNames: string[]) {
    setProductConfigs(prev => {
      const existingConfig = prev[productId];
      const currentSizes = existingConfig?.enabledSizes ?? allSizes;
      const currentColors = existingConfig?.enabledColors ?? allColorNames;
      const newSizes = currentSizes.includes(size)
        ? currentSizes.filter(s => s !== size)
        : [...currentSizes, size];
      return {
        ...prev,
        [productId]: {
          enabledSizes: newSizes,
          enabledColors: currentColors,
        },
      };
    });
  }

  function toggleColor(productId: string, colorName: string, allSizes: string[], allColorNames: string[]) {
    setProductConfigs(prev => {
      const existingConfig = prev[productId];
      const currentSizes = existingConfig?.enabledSizes ?? allSizes;
      const currentColors = existingConfig?.enabledColors ?? allColorNames;
      const newColors = currentColors.includes(colorName)
        ? currentColors.filter(c => c !== colorName)
        : [...currentColors, colorName];
      return {
        ...prev,
        [productId]: {
          enabledSizes: currentSizes,
          enabledColors: newColors,
        },
      };
    });
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
          Admin Dashboard
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Sales</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Build Product Line</span>
      </div>

      <div className="container mx-auto p-6 max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">Build Store Segment</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">Build Store Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="store-select" className="text-base">Select Store</Label>
              {storesLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading stores...</span>
                </div>
              ) : (
                <Select value={selectedStoreId} onValueChange={handleStoreChange}>
                  <SelectTrigger className="h-14 text-lg" data-testid="select-store">
                    <SelectValue placeholder="Choose a store segment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stores?.map(store => (
                      <SelectItem 
                        key={store.id} 
                        value={store.id}
                        className="py-3 text-base"
                      >
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedStoreId && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-xl">Product Line</CardTitle>
              <Button 
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                size="lg"
                className="h-12 px-6"
                data-testid="button-save"
              >
                {saveMutation.isPending && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                <Save className="h-5 w-5 mr-2" />
                Save Changes
              </Button>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
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
                        className={`p-6 border-2 rounded-xl ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}
                        data-testid={`product-${product.id}`}
                      >
                        <div className="flex items-start gap-4 mb-6">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProduct(product.id)}
                            className="h-8 w-8 mt-1"
                            data-testid={`checkbox-${product.id}`}
                          />
                          {product.imageUrl && (
                            <img
                              src={product.imageUrl}
                              alt=""
                              className="w-20 h-20 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <div className="text-xl font-semibold">{product.name}</div>
                            <div className="text-lg text-muted-foreground">${product.basePrice}</div>
                          </div>
                        </div>

                        {sizes.length > 0 && (
                          <div className="mb-6">
                            <div className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                              Sizes
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {sizes.map(size => (
                                <div
                                  key={size}
                                  className="flex items-center gap-3 bg-muted px-4 py-3 rounded-lg"
                                >
                                  <Switch
                                    checked={enabledSizes.includes(size)}
                                    onCheckedChange={() => toggleSize(product.id, size, sizes, colors.map(c => c.name))}
                                    className="h-7 w-14"
                                    data-testid={`switch-size-${product.id}-${size}`}
                                  />
                                  <span className="text-base font-medium">{size}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {colors.length > 0 && (
                          <div>
                            <div className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                              Colors
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {colors.map(color => (
                                <div
                                  key={color.name}
                                  className="flex items-center gap-3 bg-muted px-4 py-3 rounded-lg"
                                >
                                  <Switch
                                    checked={enabledColors.includes(color.name)}
                                    onCheckedChange={() => toggleColor(product.id, color.name, sizes, colors.map(c => c.name))}
                                    className="h-7 w-14"
                                    data-testid={`switch-color-${product.id}-${color.name}`}
                                  />
                                  <div
                                    className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                                    style={{ backgroundColor: color.hex }}
                                  />
                                  <span className="text-base">{color.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
