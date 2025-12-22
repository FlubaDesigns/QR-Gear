import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  Loader2,
  Plus,
  Check,
  X,
  Flag,
  Globe2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type ProductConfig = {
  enabledSizes: string[];
  enabledColors: string[];
};

type SavedItem = {
  productId: string;
  config: ProductConfig;
  savedAt: Date;
};

const PLACEMENTS = [
  { value: "homepage", label: "Home Page" },
  { value: "dashboard", label: "Dashboard" },
  { value: "static_page", label: "Static Page" },
];

export default function StoreBuildPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [storeType, setStoreType] = useState<"external" | "internal" | "">("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedPlacement, setSelectedPlacement] = useState<string>("");
  const [usaOnly, setUsaOnly] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [productConfigs, setProductConfigs] = useState<Record<string, ProductConfig>>({});
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<Record<string, "success" | "error" | null>>({});
  
  // Track which product's options dialog is open
  const [optionsDialogProductId, setOptionsDialogProductId] = useState<string | null>(null);
  // Temp state for dialog editing (so cancel doesn't save)
  const [dialogSizes, setDialogSizes] = useState<string[]>([]);
  const [dialogColors, setDialogColors] = useState<string[]>([]);

  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreSlug, setNewStoreSlug] = useState("");
  const [newStoreType, setNewStoreType] = useState<"external" | "internal">("external");
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);

  const { data: stores, isLoading: storesLoading } = useQuery<PartnerStore[]>({
    queryKey: ["/api/admin/partner-stores"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: storeProducts } = useQuery({
    queryKey: ["/api/admin/partner-stores", selectedStoreId, "products"],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const res = await fetch(`/api/admin/partner-stores/${selectedStoreId}/products`);
      return res.json();
    },
    enabled: !!selectedStoreId,
  });

  // Track if we've initialized configs for this store to avoid overwriting user edits
  const [configsInitialized, setConfigsInitialized] = useState(false);
  
  // Reset initialization flag when store changes
  useEffect(() => {
    setConfigsInitialized(false);
    setProductConfigs({});
  }, [selectedStoreId]);

  useEffect(() => {
    if (storeProducts && storeProducts.length > 0) {
      const items: SavedItem[] = storeProducts
        .filter((p: any) => p.kcPlacements?.includes(selectedPlacement))
        .map((p: any) => ({
          productId: p.productId,
          config: {
            enabledSizes: p.enabledSizes || [],
            enabledColors: p.enabledColors || [],
          },
          savedAt: new Date(),
        }));
      setSavedItems(items);
      
      // Only initialize productConfigs once per store to avoid overwriting user edits
      if (!configsInitialized) {
        const configs: Record<string, ProductConfig> = {};
        storeProducts.forEach((sp: any) => {
          if (sp.enabledSizes?.length > 0 || sp.enabledColors?.length > 0) {
            configs[sp.productId] = {
              enabledSizes: sp.enabledSizes || [],
              enabledColors: sp.enabledColors || [],
            };
          }
        });
        setProductConfigs(configs);
        setConfigsInitialized(true);
      }
    } else {
      setSavedItems([]);
    }
  }, [storeProducts, selectedPlacement, configsInitialized]);

  const createStoreMutation = useMutation({
    mutationFn: async () => {
      const apiKey = crypto.randomUUID();
      return apiRequest("POST", "/api/admin/partner-stores", {
        name: newStoreName,
        slug: newStoreSlug || newStoreName.toLowerCase().replace(/\s+/g, "-"),
        apiKey,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      toast({ title: "Store created successfully" });
      setAddStoreOpen(false);
      setNewStoreName("");
      setNewStoreSlug("");
    },
    onError: () => {
      toast({ title: "Failed to create store", variant: "destructive" });
    },
  });

  const saveProductMutation = useMutation({
    mutationFn: async ({ productId, config }: { productId: string; config: ProductConfig }) => {
      await apiRequest("POST", `/api/admin/partner-stores/${selectedStoreId}/products`, {
        productIds: [productId],
      });
      await apiRequest("PATCH", `/api/admin/partner-stores/${selectedStoreId}/products/${productId}`, {
        enabledSizes: config.enabledSizes,
        enabledColors: config.enabledColors,
        kcPlacements: [selectedPlacement],
      });
    },
    onSuccess: (_, { productId, config }) => {
      setSaveStatus(prev => ({ ...prev, [productId]: "success" }));
      setSavedItems(prev => [...prev.filter(i => i.productId !== productId), {
        productId,
        config,
        savedAt: new Date(),
      }]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores", selectedStoreId, "products"] });
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [productId]: null })), 2000);
    },
    onError: (_, { productId }) => {
      setSaveStatus(prev => ({ ...prev, [productId]: "error" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [productId]: null })), 2000);
    },
  });

  function openOptionsDialog(productId: string, allSizes: string[], allColorNames: string[]) {
    const config = productConfigs[productId];
    setDialogSizes(config?.enabledSizes || allSizes);
    setDialogColors(config?.enabledColors || allColorNames);
    setOptionsDialogProductId(productId);
  }

  function closeOptionsDialog() {
    setOptionsDialogProductId(null);
    setDialogSizes([]);
    setDialogColors([]);
  }

  function saveOptionsDialog() {
    if (!optionsDialogProductId) return;
    setProductConfigs(prev => ({
      ...prev,
      [optionsDialogProductId]: { enabledSizes: dialogSizes, enabledColors: dialogColors },
    }));
    closeOptionsDialog();
    toast({ title: "Options updated" });
  }

  function toggleDialogSize(size: string) {
    setDialogSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  }

  function toggleDialogColor(colorName: string) {
    setDialogColors(prev =>
      prev.includes(colorName) ? prev.filter(c => c !== colorName) : [...prev, colorName]
    );
  }

  function toggleSize(productId: string, size: string, allSizes: string[], allColorNames: string[]) {
    setProductConfigs(prev => {
      const existing = prev[productId];
      const currentSizes = existing?.enabledSizes ?? allSizes;
      const currentColors = existing?.enabledColors ?? allColorNames;
      const newSizes = currentSizes.includes(size)
        ? currentSizes.filter(s => s !== size)
        : [...currentSizes, size];
      return {
        ...prev,
        [productId]: { enabledSizes: newSizes, enabledColors: currentColors },
      };
    });
  }

  function toggleColor(productId: string, colorName: string, allSizes: string[], allColorNames: string[]) {
    setProductConfigs(prev => {
      const existing = prev[productId];
      const currentSizes = existing?.enabledSizes ?? allSizes;
      const currentColors = existing?.enabledColors ?? allColorNames;
      const newColors = currentColors.includes(colorName)
        ? currentColors.filter(c => c !== colorName)
        : [...currentColors, colorName];
      return {
        ...prev,
        [productId]: { enabledSizes: currentSizes, enabledColors: newColors },
      };
    });
  }

  function handleSaveToStore(productId: string, sizes: string[], colors: { name: string; hex: string }[]) {
    const config = productConfigs[productId] || {
      enabledSizes: sizes,
      enabledColors: colors.map(c => c.name),
    };
    saveProductMutation.mutate({ productId, config });
  }

  if (!user) {
    return (
      <div className="container mx-auto p-8 text-center">
        <p>Please log in to access this page.</p>
      </div>
    );
  }

  const enabledProducts = products?.filter(p => p.isEnabled) || [];
  const filteredProducts = usaOnly
    ? enabledProducts.filter(p => p.madeInUSA)
    : enabledProducts;

  // External stores are partner stores, internal stores are QR Gear's own (not yet implemented)
  const filteredStores = storeType === "external" ? (stores || []) : [];

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center gap-2 px-6 py-4 border-b text-sm" aria-label="Breadcrumb">
        <Link href="/" className="text-muted-foreground hover:text-foreground" data-testid="breadcrumb-home">
          Home
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link href="/admin" className="text-muted-foreground hover:text-foreground" data-testid="breadcrumb-admin">
          Admin Dashboard
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-foreground font-medium" aria-current="page">Build Store Segment</span>
      </nav>

      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold">Build Store Segment</h1>
          <Select value={storeType} onValueChange={(v) => { setStoreType(v as any); setSelectedStoreId(""); setSelectedPlacement(""); }}>
            <SelectTrigger className="h-14 text-lg w-64" data-testid="select-store-type">
              <SelectValue placeholder="External or Internal?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="external" className="py-3 text-base">External Store</SelectItem>
              <SelectItem value="internal" className="py-3 text-base">Internal Store</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {storeType && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-xl">
                {storeType === "external" ? "Select External Store" : "Select Internal Store"}
              </CardTitle>
              <Dialog open={addStoreOpen} onOpenChange={setAddStoreOpen}>
                <DialogTrigger asChild>
                  <button className="qr-btn qr-btn--lg qr-btn--accent" data-testid="button-add-store">
                    <Plus className="h-5 w-5" />
                    Add New Store
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New {storeType === "external" ? "External" : "Internal"} Store</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="store-name" className="text-base">Store Name</Label>
                      <Input
                        id="store-name"
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(e.target.value)}
                        className="h-12 text-lg mt-2"
                        placeholder="Kingdom Connects"
                        data-testid="input-store-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="store-slug" className="text-base">Slug (optional)</Label>
                      <Input
                        id="store-slug"
                        value={newStoreSlug}
                        onChange={(e) => setNewStoreSlug(e.target.value)}
                        className="h-12 text-lg mt-2"
                        placeholder="kingdom-connects"
                        data-testid="input-store-slug"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <button
                      className={`qr-btn qr-btn--lg qr-btn--primary ${createStoreMutation.isPending ? 'is-loading' : ''}`}
                      onClick={() => createStoreMutation.mutate()}
                      disabled={!newStoreName || createStoreMutation.isPending}
                      data-testid="button-create-store"
                    >
                      {createStoreMutation.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
                      Create Store
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {storesLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading stores...</span>
                </div>
              ) : storeType === "internal" ? (
                <div className="p-4 text-center text-muted-foreground bg-muted rounded-lg">
                  Internal stores coming soon. Use External for partner stores like Kingdom Connects.
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground bg-muted rounded-lg">
                  No stores available. Click "Add New Store" above to create one.
                </div>
              ) : (
                <Select value={selectedStoreId} onValueChange={(v) => { setSelectedStoreId(v); setSelectedPlacement(""); }}>
                  <SelectTrigger className="h-14 text-lg" data-testid="select-store">
                    <SelectValue placeholder="Choose a store..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStores.map(store => (
                      <SelectItem key={store.id} value={store.id} className="py-3 text-base">
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {selectedStoreId && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-xl">Select Placement</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedPlacement} onValueChange={setSelectedPlacement}>
                <SelectTrigger className="h-14 text-lg" data-testid="select-placement">
                  <SelectValue placeholder="Choose where to display..." />
                </SelectTrigger>
                <SelectContent>
                  {PLACEMENTS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="py-3 text-base">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {selectedPlacement && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <button
                className={`qr-btn qr-btn--lg ${usaOnly ? 'qr-btn--primary' : 'qr-btn--outline'}`}
                onClick={() => setUsaOnly(!usaOnly)}
                data-testid="button-usa-filter"
              >
                <Flag className="h-5 w-5" />
                Made in USA Only
              </button>
            </div>

            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map(product => {
                  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
                  const colors = Array.isArray(product.availableColors)
                    ? (product.availableColors as Array<{ name: string; hex: string }>)
                    : [];
                  const config = productConfigs[product.id];
                  const enabledSizes = config?.enabledSizes || sizes;
                  const enabledColors = config?.enabledColors || colors.map(c => c.name);
                  const status = saveStatus[product.id];

                  return (
                    <div
                      key={product.id}
                      className="border-2 border-blue-500 rounded-xl p-4 bg-card"
                      data-testid={`product-card-${product.id}`}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-start pt-1">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={(checked) => {
                              setSelectedProducts(prev => {
                                const next = new Set(prev);
                                if (checked) {
                                  next.add(product.id);
                                } else {
                                  next.delete(product.id);
                                }
                                return next;
                              });
                            }}
                            className="h-11 w-11"
                            data-testid={`checkbox-select-${product.id}`}
                          />
                        </div>
                        {product.imageUrl && (
                          <button
                            onClick={() => setEnlargedImage({ url: product.imageUrl!, name: product.name })}
                            className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                            data-testid={`button-enlarge-${product.id}`}
                          >
                            <img
                              src={product.imageUrl}
                              alt=""
                              className="w-20 h-20 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-semibold">{product.name}</div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{product.manufacturer || "Unknown Manufacturer"}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help inline-flex items-center">
                                  {product.madeInUSA ? (
                                    <img 
                                      src="https://flagcdn.com/w40/us.png" 
                                      srcSet="https://flagcdn.com/w80/us.png 2x"
                                      alt="United States flag"
                                      className="h-5 w-auto rounded-sm shadow-sm"
                                    />
                                  ) : (
                                    <Globe2 className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {product.madeInUSA ? "United States" : "International"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="text-lg font-medium text-primary mt-1">
                            Cost: ${product.basePrice}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-4">
                        {(sizes.length > 0 || colors.length > 0) && (
                          <button
                            className="qr-btn qr-btn--lg qr-btn--outline"
                            onClick={() => openOptionsDialog(product.id, sizes, colors.map(c => c.name))}
                            data-testid={`button-options-${product.id}`}
                          >
                            Change Options
                          </button>
                        )}
                        <button
                          className={`qr-btn qr-btn--lg qr-btn--primary ${
                            status === "success" ? "is-success" :
                            status === "error" ? "is-error" :
                            saveProductMutation.isPending ? "is-loading" : ""
                          }`}
                          onClick={() => handleSaveToStore(product.id, sizes, colors)}
                          disabled={saveProductMutation.isPending}
                          data-testid={`button-save-${product.id}`}
                          style={{ minWidth: '140px' }}
                        >
                          {status === "success" ? (
                            <><Check className="h-5 w-5" /> Saved</>
                          ) : status === "error" ? (
                            <><X className="h-5 w-5" /> Error</>
                          ) : saveProductMutation.isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            "Save to Store"
                          )}
                        </button>
                      </div>

                      {/* Show current selections summary */}
                      {(enabledSizes.length > 0 || enabledColors.length > 0) && (
                        <div className="mt-3 text-sm text-muted-foreground">
                          {enabledSizes.length > 0 && <span>{enabledSizes.length} size(s) selected</span>}
                          {enabledSizes.length > 0 && enabledColors.length > 0 && <span> · </span>}
                          {enabledColors.length > 0 && <span>{enabledColors.length} color(s) selected</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {savedItems.length > 0 && (
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="text-xl">
                    Saved to {stores?.find(s => s.id === selectedStoreId)?.name} - {PLACEMENTS.find(p => p.value === selectedPlacement)?.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {savedItems.map(item => {
                      const product = products?.find(p => p.id === item.productId);
                      if (!product) return null;
                      return (
                        <div
                          key={item.productId}
                          className="flex items-center gap-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                        >
                          {product.imageUrl && (
                            <img src={product.imageUrl} alt="" className="w-12 h-12 rounded object-cover" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.config.enabledSizes.length} sizes, {item.config.enabledColors.length} colors
                            </div>
                          </div>
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <Dialog open={!!enlargedImage} onOpenChange={(open) => !open && setEnlargedImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{enlargedImage?.name}</DialogTitle>
          </DialogHeader>
          {enlargedImage && (
            <div className="flex justify-center">
              <img
                src={enlargedImage.url}
                alt={enlargedImage.name}
                className="max-w-full max-h-[70vh] rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Options Dialog for Size/Color Selection */}
      <Dialog open={!!optionsDialogProductId} onOpenChange={(open) => !open && closeOptionsDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Configure Options
            </DialogTitle>
          </DialogHeader>
          
          {optionsDialogProductId && (() => {
            const product = products?.find(p => p.id === optionsDialogProductId);
            if (!product) return null;
            const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
            const colors = Array.isArray(product.availableColors)
              ? (product.availableColors as Array<{ name: string; hex: string }>)
              : [];
            
            return (
              <div className="space-y-6">
                {sizes.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                      Sizes
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {sizes.map(size => (
                        <div
                          key={size}
                          className="flex items-center gap-3 bg-muted px-4 py-3 rounded-lg min-w-[120px]"
                        >
                          <Switch
                            checked={dialogSizes.includes(size)}
                            onCheckedChange={() => toggleDialogSize(size)}
                            className="h-8 w-16"
                            data-testid={`dialog-switch-size-${size}`}
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
                          className="flex items-center gap-3 bg-muted px-4 py-3 rounded-lg min-w-[140px]"
                        >
                          <Switch
                            checked={dialogColors.includes(color.name)}
                            onCheckedChange={() => toggleDialogColor(color.name)}
                            className="h-8 w-16"
                            data-testid={`dialog-switch-color-${color.name}`}
                          />
                          <div
                            className="w-8 h-8 rounded-full border-2 border-white shadow-md flex-shrink-0"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-base">{color.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sizes.length === 0 && colors.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    This product has no size or color options to configure.
                  </p>
                )}
              </div>
            );
          })()}

          <DialogFooter className="gap-3 mt-6">
            <button
              className="qr-btn qr-btn--lg qr-btn--outline"
              onClick={closeOptionsDialog}
              data-testid="button-dialog-cancel"
            >
              Cancel
            </button>
            <button
              className="qr-btn qr-btn--lg qr-btn--primary"
              onClick={saveOptionsDialog}
              data-testid="button-dialog-save"
            >
              <Check className="h-5 w-5" />
              Save Options
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
