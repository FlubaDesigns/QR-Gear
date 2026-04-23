import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { nexusFetch } from "@/lib/nexusFetch";
import { nexusFetchProfiled, NexusProfiles } from "@/lib/nexusFetchProfiled";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PartnerStore, Product } from "@shared/schema";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronRight, Loader2, Plus, Check, Flag } from "lucide-react";
import { StoreBuildProductCard, StoreBuildOptionsDialog } from "./store-build-components";

type ProductConfig = {
  enabledSizes: string[];
  enabledColors: string[];
  defaultColor?: string;
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
  const [dialogDefaultColor, setDialogDefaultColor] = useState<string | null>(null);

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
      const res = await nexusFetch(`/api/admin/partner-stores/${selectedStoreId}/products`, { source: "admin:partner-store:products", tries: 3 });
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
            defaultColor: p.defaultColor || undefined,
          },
          savedAt: new Date(),
        }));
      setSavedItems(items);
      
      // Only initialize productConfigs once per store to avoid overwriting user edits
      if (!configsInitialized) {
        const configs: Record<string, ProductConfig> = {};
        storeProducts.forEach((sp: any) => {
          if (sp.enabledSizes?.length > 0 || sp.enabledColors?.length > 0 || sp.defaultColor) {
            configs[sp.productId] = {
              enabledSizes: sp.enabledSizes || [],
              enabledColors: sp.enabledColors || [],
              defaultColor: sp.defaultColor || undefined,
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
        defaultColor: config.defaultColor || config.enabledColors[0] || null,
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
    setDialogDefaultColor(config?.defaultColor || null);
    setOptionsDialogProductId(productId);
  }

  function closeOptionsDialog() {
    setOptionsDialogProductId(null);
    setDialogSizes([]);
    setDialogColors([]);
    setDialogDefaultColor(null);
  }

  function saveOptionsDialog() {
    if (!optionsDialogProductId) return;
    // Use the dialog's default color, or fall back to first enabled color
    const finalDefault = dialogColors.includes(dialogDefaultColor || '') 
      ? dialogDefaultColor 
      : dialogColors[0];
    setProductConfigs(prev => ({
      ...prev,
      [optionsDialogProductId]: { enabledSizes: dialogSizes, enabledColors: dialogColors, defaultColor: finalDefault || undefined },
    }));
    closeOptionsDialog();
    toast({ title: "Options updated" });
  }

  const [generatingMockup, setGeneratingMockup] = useState<string | null>(null);

  async function setDialogDefault(colorName: string) {
    // Can only set default if color is enabled
    if (dialogColors.includes(colorName)) {
      setDialogDefaultColor(colorName);
      
      // Trigger mockup generation for this color
      if (selectedStoreId && optionsDialogProductId) {
        setGeneratingMockup(colorName);
        try {
          const res = await nexusFetchProfiled(`/api/admin/partner-stores/${selectedStoreId}/products/${optionsDialogProductId}/generate-mockup`, {
            source: "printful:mockup:single",
            profile: NexusProfiles.PRINTFUL_SINGLE,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ color: colorName }),
          });
          if (res.ok) {
            toast({ title: "Mockup generated", description: `${colorName} mockup ready` });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores", selectedStoreId, "products"] });
          } else {
            const data = await res.json();
            toast({ title: "Mockup failed", description: data.error, variant: "destructive" });
          }
        } catch (e: any) {
          toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
          setGeneratingMockup(null);
        }
      }
    }
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
      const currentDefault = existing?.defaultColor;
      const newColors = currentColors.includes(colorName)
        ? currentColors.filter(c => c !== colorName)
        : [...currentColors, colorName];
      // If removing the default color, clear it
      const newDefault = newColors.includes(currentDefault || '') ? currentDefault : undefined;
      return {
        ...prev,
        [productId]: { enabledSizes: currentSizes, enabledColors: newColors, defaultColor: newDefault },
      };
    });
  }

  function setDefaultColor(productId: string, colorName: string, allSizes: string[], allColorNames: string[]) {
    setProductConfigs(prev => {
      const existing = prev[productId];
      const currentSizes = existing?.enabledSizes ?? allSizes;
      const currentColors = existing?.enabledColors ?? allColorNames;
      // Ensure the color is enabled before setting as default
      const newColors = currentColors.includes(colorName) ? currentColors : [...currentColors, colorName];
      return {
        ...prev,
        [productId]: { enabledSizes: currentSizes, enabledColors: newColors, defaultColor: colorName },
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
              <div className="flex flex-col items-center gap-3">
                {filteredProducts.map(product => {
                  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
                  const colors = Array.isArray(product.availableColors)
                    ? (product.availableColors as Array<{ name: string; hex: string }>)
                    : [];
                  const config = productConfigs[product.id];
                  const enabledSizes = config?.enabledSizes || sizes;
                  const enabledColors = config?.enabledColors || colors.map(c => c.name);

                  return (
                    <StoreBuildProductCard
                      key={product.id}
                      product={product}
                      config={config}
                      enabledSizes={enabledSizes}
                      enabledColors={enabledColors}
                      isSelected={selectedProducts.has(product.id)}
                      saveStatus={saveStatus[product.id]}
                      isSaving={saveProductMutation.isPending}
                      onToggleSelect={(checked) => {
                        setSelectedProducts(prev => {
                          const next = new Set(prev);
                          if (checked) next.add(product.id);
                          else next.delete(product.id);
                          return next;
                        });
                      }}
                      onEnlargeImage={(url, name) => setEnlargedImage({ url, name })}
                      onOpenOptions={openOptionsDialog}
                      onSetDefaultColor={setDefaultColor}
                      onSaveToStore={handleSaveToStore}
                    />
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
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>{enlargedImage?.name}</DialogTitle>
          </DialogHeader>
          {enlargedImage && (
            <button
              onClick={() => setEnlargedImage(null)}
              className="flex justify-center w-full cursor-pointer focus:outline-none"
              data-testid="button-close-enlarged-image"
            >
              <img
                src={enlargedImage.url}
                alt={enlargedImage.name}
                className="max-w-full max-h-[80vh] rounded-lg object-contain"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                Tap to close
              </div>
            </button>
          )}
        </DialogContent>
      </Dialog>

      <StoreBuildOptionsDialog
        productId={optionsDialogProductId}
        products={products}
        dialogSizes={dialogSizes}
        dialogColors={dialogColors}
        dialogDefaultColor={dialogDefaultColor}
        generatingMockup={generatingMockup}
        onToggleSize={toggleDialogSize}
        onToggleColor={toggleDialogColor}
        onSetDefault={setDialogDefault}
        onClose={closeOptionsDialog}
        onSave={saveOptionsDialog}
      />
    </div>
  );
}
