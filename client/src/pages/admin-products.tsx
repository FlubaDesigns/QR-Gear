import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Loader2,
  RefreshCw,
  Package,
  Check,
  X,
  Flag,
  Shirt,
  Target,
  RotateCw,
  ZoomIn,
  Settings,
} from "lucide-react";
import type { Product, ProductCategory } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";

const COLOR_MAP: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  navy: "#001f3f",
  red: "#e53935",
  blue: "#1e88e5",
  green: "#43a047",
  grey: "#9e9e9e",
  gray: "#9e9e9e",
  charcoal: "#36454f",
  heather: "#b4b4b4",
  maroon: "#800000",
  orange: "#ff9800",
  yellow: "#ffeb3b",
  pink: "#e91e63",
  purple: "#9c27b0",
  tan: "#d2b48c",
  brown: "#795548",
  khaki: "#c3b091",
  cream: "#fffdd0",
  ivory: "#fffff0",
  gold: "#ffd700",
  silver: "#c0c0c0",
  aqua: "#00bcd4",
  teal: "#009688",
  coral: "#ff7f50",
  mint: "#98ff98",
  olive: "#808000",
  burgundy: "#800020",
  sand: "#c2b280",
  slate: "#708090",
  forest: "#228b22",
  royal: "#4169e1",
  sky: "#87ceeb",
  light: "#f5f5f5",
  dark: "#333333",
};

function getSwatchColor(colorName: string): string {
  const lower = colorName.toLowerCase();
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return value;
  }
  return "#cccccc";
}

function ColorSwatch({ hex, className = "" }: { hex: string; className?: string }) {
  return (
    <div 
      className={`w-5 h-5 rounded-full border flex-shrink-0 ${className}`}
      ref={(el) => { if (el) el.style.backgroundColor = hex; }}
    />
  );
}

function ProductOptionsEditor({ product, onUpdate }: { product: Product; onUpdate: () => void }) {
  const { toast } = useToast();
  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
  const colors = Array.isArray(product.availableColors) 
    ? (product.availableColors as Array<{name: string; hex: string}>)
    : [];
  
  const savedEnabledSizes = (product.metadata as any)?.enabledSizes as string[] | undefined;
  const savedEnabledColors = (product.metadata as any)?.enabledColors as string[] | undefined;
  
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(
    new Set(savedEnabledSizes || sizes)
  );
  const [enabledColors, setEnabledColors] = useState<Set<string>>(
    new Set(savedEnabledColors || colors.map(c => c.name))
  );
  const [saving, setSaving] = useState(false);
  
  const toggleSize = async (size: string) => {
    const newSizes = new Set(enabledSizes);
    if (newSizes.has(size)) {
      newSizes.delete(size);
    } else {
      newSizes.add(size);
    }
    setEnabledSizes(newSizes);
    await saveChanges(Array.from(newSizes), Array.from(enabledColors));
  };
  
  const toggleColor = async (colorName: string) => {
    const newColors = new Set(enabledColors);
    if (newColors.has(colorName)) {
      newColors.delete(colorName);
    } else {
      newColors.add(colorName);
    }
    setEnabledColors(newColors);
    await saveChanges(Array.from(enabledSizes), Array.from(newColors));
  };
  
  const saveChanges = async (newSizes: string[], newColors: string[]) => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/admin/products/${product.id}/options`, {
        enabledSizes: newSizes,
        enabledColors: newColors,
      });
      onUpdate();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  
  if (sizes.length === 0 && colors.length === 0) {
    return <div className="text-sm text-muted-foreground">No sizes/colors - sync from Printify</div>;
  }
  
  return (
    <div className="space-y-3">
      {sizes.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Sizes {saving && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
          </Label>
          <div className="flex flex-wrap gap-2">
            {sizes.map(size => (
              <div key={size} className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded">
                <Switch
                  id={`size-${product.id}-${size}`}
                  checked={enabledSizes.has(size)}
                  onCheckedChange={() => toggleSize(size)}
                  disabled={saving}
                  data-testid={`switch-size-${product.id}-${size}`}
                />
                <Label htmlFor={`size-${product.id}-${size}`} className="text-sm cursor-pointer">
                  {size}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
      {colors.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Colors {saving && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
          </Label>
          <div className="flex flex-wrap gap-2">
            {colors.map(color => (
              <div key={color.name} className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded">
                <Switch
                  id={`color-${product.id}-${color.name}`}
                  checked={enabledColors.has(color.name)}
                  onCheckedChange={() => toggleColor(color.name)}
                  disabled={saving}
                  data-testid={`switch-color-${product.id}-${color.name}`}
                />
                <ColorSwatch hex={color.hex || getSwatchColor(color.name)} className="w-4 h-4" />
                <Label htmlFor={`color-${product.id}-${color.name}`} className="text-sm cursor-pointer">
                  {color.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductTagEditor({
  productId,
  allCategories,
  assignedCategoryIds,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}: {
  productId: string;
  allCategories: ProductCategory[];
  assignedCategoryIds: string[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: (categoryIds: string[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(assignedCategoryIds);

  useEffect(() => {
    setSelectedIds(assignedCategoryIds);
  }, [assignedCategoryIds, isEditing]);

  const toggleCategory = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (!isEditing) {
    const assignedNames = allCategories
      .filter(c => assignedCategoryIds.includes(c.id))
      .map(c => c.name);
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-1 max-w-48">
          {assignedNames.length === 0 ? (
            <span className="text-muted-foreground text-sm">No tags</span>
          ) : (
            assignedNames.slice(0, 3).map(name => (
              <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
            ))
          )}
          {assignedNames.length > 3 && (
            <Badge variant="outline" className="text-xs">+{assignedNames.length - 3}</Badge>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-tags-${productId}`}>
          <Pencil className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-64">
      <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
        {allCategories.map(cat => (
          <Badge
            key={cat.id}
            variant={selectedIds.includes(cat.id) ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => toggleCategory(cat.id)}
            data-testid={`badge-tag-${cat.slug}`}
          >
            {selectedIds.includes(cat.id) && <Check className="w-2 h-2 mr-1" />}
            {cat.name}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(selectedIds)} disabled={isSaving} data-testid="button-save-tags">
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
      </div>
    </div>
  );
}

interface CatalogItem {
  id: number;
  title: string;
  brand: string;
  model: string;
  imageUrl: string | null;
  madeInUSA: boolean;
  usaProviderCount: number;
  otherCountries: string[];
}

interface CatalogCategory {
  name: string;
  items: CatalogItem[];
  count: number;
  usaCount: number;
  otherCount: number;
}

interface CatalogDetails {
  blueprint: { id: number; title: string; brand: string; description: string };
  selectedProvider: { id: number; title: string };
  madeInUSA: boolean;
  colors: string[];
  sizes: string[];
  basePrice: number;
  imageUrl: string | null;
}

const STORE_SEGMENTS = [
  "Kingdom Connects",
  "Holiday", 
  "Dynamic",
  "Custom",
  "Religious",
  "Business",
];

const QR_PLACEMENTS = [
  { id: "front-chest", label: "Front Chest", Icon: Shirt },
  { id: "front-center", label: "Front Center", Icon: Target },
  { id: "back", label: "Back", Icon: ArrowLeft },
  { id: "left-shoulder", label: "Left Shoulder", Icon: ArrowLeft },
  { id: "right-shoulder", label: "Right Shoulder", Icon: ArrowRight },
  { id: "wrap-around", label: "Wrap Around", Icon: RotateCw },
];

interface StagedProduct {
  id: string;
  blueprintId: number;
  printProviderId: number;
  name: string;
  description: string;
  basePrice: number;
  imageUrl: string | null;
  manufacturer: string;
  madeInUSA: boolean;
  placement: string;
  headerEnabled: boolean;
  footerEnabled: boolean;
  colors: string[];
  sizes: string[];
  brand: string;
  model: string;
}

function AddFromPrintifyPanel({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [kcPlacements, setKcPlacements] = useState<string[]>([]);
  const [stagedProducts, setStagedProducts] = useState<StagedProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<"all" | "usa" | "other">("all");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [catalogDetails, setCatalogDetails] = useState<CatalogDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedPlacement, setSelectedPlacement] = useState<string>("front-chest");
  const [headerEnabled, setHeaderEnabled] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [footerEnabled, setFooterEnabled] = useState(false);
  const [footerText, setFooterText] = useState("");
  const [zoomedImage, setZoomedImage] = useState<{url: string; title: string} | null>(null);
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(new Set());
  const [enabledColors, setEnabledColors] = useState<Set<string>>(new Set());
  const [itemDetails, setItemDetails] = useState<Record<number, {
    basePrice: number;
    colors: string[];
    sizes: string[];
    providerId?: number;
    providerName?: string;
    error?: boolean;
  }>>({});
  const [fetchingBatch, setFetchingBatch] = useState(false);

  const { data: catalog = [], isLoading: loadingCatalog } = useQuery<CatalogCategory[]>({
    queryKey: ["/api/admin/printify/catalog"],
  });

  const categoryData = catalog.find(c => c.name === selectedCategory);
  const allCategoryItems = categoryData?.items || [];
  const categoryItems = allCategoryItems.filter(item => {
    if (locationFilter === "usa") return item.madeInUSA;
    if (locationFilter === "other") return !item.madeInUSA;
    return true;
  });
  const selectedItem = categoryItems.find(item => item.id === selectedItemId);

  async function fetchItemDetails(itemId: number) {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/admin/printify/catalog/${itemId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch details");
      const data = await res.json();
      setCatalogDetails(data);
      if (data.basePrice !== undefined) {
        setItemDetails(prev => ({ 
          ...prev, 
          [itemId]: {
            basePrice: data.basePrice,
            colors: data.colors || [],
            sizes: data.sizes || [],
            providerId: data.selectedProvider?.id,
            providerName: data.selectedProvider?.title,
          }
        }));
      }
      setEnabledSizes(new Set(data.sizes || []));
      setEnabledColors(new Set(data.colors || []));
    } catch (error) {
      toast({ title: "Error", description: "Failed to load product details.", variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    if (!selectedCategory || allCategoryItems.length === 0) return;
    
    const itemsToFetch = allCategoryItems.filter(item => !itemDetails[item.id]);
    
    if (itemsToFetch.length === 0) return;
    
    const fetchBatchDetails = async () => {
      setFetchingBatch(true);
      
      const batchSize = 20;
      for (let i = 0; i < itemsToFetch.length; i += batchSize) {
        const batch = itemsToFetch.slice(i, i + batchSize);
        const blueprintIds = batch.map(item => item.id);
        
        try {
          const res = await fetch("/api/admin/printify/catalog/batch-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ blueprintIds }),
          });
          
          if (res.ok) {
            const results = await res.json();
            setItemDetails(prev => {
              const next = { ...prev };
              for (const [id, data] of Object.entries(results)) {
                const d = data as any;
                next[parseInt(id)] = {
                  basePrice: d.basePrice || 0,
                  colors: d.colors || [],
                  sizes: d.sizes || [],
                  providerId: d.providerId,
                  providerName: d.providerName,
                  error: d.error,
                };
              }
              return next;
            });
          }
        } catch {
        }
      }
      
      setFetchingBatch(false);
    };
    
    fetchBatchDetails();
  }, [selectedCategory, allCategoryItems.length]);

  const headerUpcharge = headerEnabled && headerText.trim() ? 2 : 0;
  const footerUpcharge = footerEnabled && footerText.trim() ? 2 : 0;
  const totalUpcharge = headerUpcharge + footerUpcharge;

  function addToStagingCart() {
    if (!catalogDetails || !selectedItem) return;
    
    const staged: StagedProduct = {
      id: `${Date.now()}-${selectedItem.id}`,
      blueprintId: catalogDetails.blueprint.id,
      printProviderId: catalogDetails.selectedProvider.id,
      name: selectedItem.title,
      description: catalogDetails.blueprint.description || "",
      basePrice: catalogDetails.basePrice,
      imageUrl: selectedItem.imageUrl || catalogDetails.imageUrl,
      manufacturer: catalogDetails.selectedProvider.title,
      madeInUSA: catalogDetails.madeInUSA,
      placement: selectedPlacement,
      headerEnabled,
      footerEnabled,
      colors: catalogDetails.colors,
      sizes: catalogDetails.sizes,
      brand: selectedItem.brand,
      model: selectedItem.model,
    };
    
    setStagedProducts(prev => [...prev, staged]);
    toast({ title: "Added to Cart", description: `${selectedItem.title} added. Keep adding or save all.` });
    
    setSelectedCategory("");
    setLocationFilter("all");
    setSelectedItemId(null);
    setCatalogDetails(null);
    setSelectedPlacement("front-chest");
    setHeaderEnabled(false);
    setHeaderText("");
    setFooterEnabled(false);
    setFooterText("");
  }
  
  function removeFromStagingCart(id: string) {
    setStagedProducts(prev => prev.filter(p => p.id !== id));
  }

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      if (stagedProducts.length === 0) throw new Error("No products to save");
      
      const results = await Promise.all(
        stagedProducts.map(product => 
          apiRequest("POST", "/api/admin/products/from-printify", {
            blueprintId: product.blueprintId,
            printProviderId: product.printProviderId,
            name: product.name,
            description: product.description,
            category: selectedSegment,
            basePrice: product.basePrice,
            imageUrl: product.imageUrl,
            manufacturer: product.manufacturer,
            madeInUSA: product.madeInUSA,
            availablePlacements: [product.placement],
            availableColors: product.colors,
            availableSizes: product.sizes,
            metadata: { 
              brand: product.brand, 
              model: product.model,
              defaultPlacement: product.placement,
              headerTextEnabled: product.headerEnabled,
              footerTextEnabled: product.footerEnabled,
              kcPlacements: selectedSegment === "Kingdom Connects" ? kcPlacements : null,
            },
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      const count = stagedProducts.length;
      toast({ 
        title: "Products Saved!", 
        description: `${count} product(s) added to ${selectedSegment}.` 
      });
      resetForm();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save products.", variant: "destructive" });
    },
  });

  function resetForm() {
    setSelectedSegment("");
    setKcPlacements([]);
    setStagedProducts([]);
    setSelectedCategory("");
    setLocationFilter("all");
    setSelectedItemId(null);
    setCatalogDetails(null);
    setSelectedPlacement("front-chest");
    setHeaderEnabled(false);
    setHeaderText("");
    setFooterEnabled(false);
    setFooterText("");
  }

  function handleSegmentChange(segment: string) {
    setSelectedSegment(segment);
    if (segment !== "Kingdom Connects") {
      setKcPlacements([]);
    }
  }
  
  function toggleKcPlacement(placement: string) {
    setKcPlacements(prev => 
      prev.includes(placement) 
        ? prev.filter(p => p !== placement)
        : [...prev, placement]
    );
  }

  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    setSelectedItemId(null);
    setCatalogDetails(null);
    setLocationFilter("all");
  }

  function handleLocationFilterChange(filter: "all" | "usa" | "other") {
    setLocationFilter(filter);
    setSelectedItemId(null);
    setCatalogDetails(null);
  }

  function handleItemChange(itemId: string) {
    const id = parseInt(itemId);
    setSelectedItemId(id);
    fetchItemDetails(id);
    
    const details = itemDetails[id];
    if (details) {
      setEnabledSizes(new Set(details.sizes || []));
      setEnabledColors(new Set(details.colors || []));
    }
  }

  const canAddToCart = selectedItem && selectedSegment && catalogDetails && !loadingDetails;
  const kcPlacementValid = selectedSegment !== "Kingdom Connects" || kcPlacements.length > 0;
  const canSaveAll = stagedProducts.length > 0 && selectedSegment && kcPlacementValid;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Product from Printify
        </CardTitle>
        <CardDescription>Pick a product type, select an item, choose store segment, then add</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingCatalog ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading Printify catalog...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {stagedProducts.length > 0 && (
              <div className="p-3 bg-accent/20 rounded-md border space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Staging Cart ({stagedProducts.length} item{stagedProducts.length !== 1 ? 's' : ''})
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStagedProducts([])}
                    data-testid="clear-staging-cart"
                  >
                    <X className="h-3 w-3 mr-1" /> Clear All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stagedProducts.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 bg-background rounded px-2 py-1 text-xs border">
                      {p.imageUrl && <img src={p.imageUrl} alt="" className="w-6 h-6 rounded object-contain" />}
                      <span className="truncate max-w-24">{p.name}</span>
                      <button
                        onClick={() => removeFromStagingCart(p.id)}
                        className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => saveAllMutation.mutate()}
                  disabled={!canSaveAll || saveAllMutation.isPending}
                  className="w-full"
                  data-testid="save-all-products"
                >
                  {saveAllMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="h-4 w-4 mr-2" /> Save All to {selectedSegment || "Store"}</>
                  )}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>1. Store Segment</Label>
              <select
                className="w-full p-3 border rounded-md bg-background"
                value={selectedSegment}
                onChange={(e) => handleSegmentChange(e.target.value)}
                data-testid="select-store-segment"
              >
                <option value="">-- Select store segment --</option>
                {STORE_SEGMENTS.map((seg) => (
                  <option key={seg} value={seg}>{seg}</option>
                ))}
              </select>
            </div>
            
            {selectedSegment === "Kingdom Connects" && (
              <div className="space-y-3 p-3 bg-card/50 rounded-md border border-border">
                <Label className="text-lg font-bold text-[var(--accent)]">Where on Kingdom Connects?</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kc-homepage" className="text-sm cursor-pointer">Homepage (General KC Store)</Label>
                    <Switch
                      id="kc-homepage"
                      checked={kcPlacements.includes("homepage")}
                      onCheckedChange={() => toggleKcPlacement("homepage")}
                      data-testid="switch-kc-homepage"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kc-dashboard" className="text-sm cursor-pointer">Dashboard (User's Dashboard)</Label>
                    <Switch
                      id="kc-dashboard"
                      checked={kcPlacements.includes("dashboard")}
                      onCheckedChange={() => toggleKcPlacement("dashboard")}
                      data-testid="switch-kc-dashboard"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kc-static" className="text-sm cursor-pointer">Static Page (Business/Church Listing)</Label>
                    <Switch
                      id="kc-static"
                      checked={kcPlacements.includes("static_page")}
                      onCheckedChange={() => toggleKcPlacement("static_page")}
                      data-testid="switch-kc-static-page"
                    />
                  </div>
                </div>
                
                {kcPlacements.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    Product will appear on: {kcPlacements.map(p => 
                      p === "homepage" ? "Homepage" : p === "dashboard" ? "Dashboard" : "Static Pages"
                    ).join(", ")}
                  </p>
                )}
              </div>
            )}

            {selectedSegment && (selectedSegment !== "Kingdom Connects" || kcPlacements.length > 0) && (
              <div className="space-y-2">
                <Label>2. Product Type</Label>
                <select
                  className="w-full p-3 border rounded-md bg-background"
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  data-testid="select-product-category"
                >
                  <option value="">-- Select product type --</option>
                  {catalog.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count} items)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedCategory && categoryData && (
              <div className="space-y-2">
                <Label>3. Where It's Made</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={locationFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLocationFilterChange("all")}
                    data-testid="filter-all"
                  >
                    All ({allCategoryItems.length})
                  </Button>
                  <Button
                    variant={locationFilter === "usa" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLocationFilterChange("usa")}
                    data-testid="filter-usa"
                  >
                    <Flag className="h-4 w-4 mr-1" /> Made in USA ({categoryData.usaCount})
                  </Button>
                  <Button
                    variant={locationFilter === "other" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLocationFilterChange("other")}
                    data-testid="filter-other"
                  >
                    Made Elsewhere ({categoryData.otherCount})
                  </Button>
                </div>
              </div>
            )}

            {selectedCategory && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>4. Select Item ({categoryItems.length} available)</Label>
                  {fetchingBatch && categoryItems.some(item => !itemDetails[item.id]) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading details...
                    </span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto border rounded-md bg-muted/30">
                  <div className="divide-y">
                    {categoryItems.map((item) => {
                      const details = itemDetails[item.id];
                      const isSelected = selectedItemId === item.id;
                      
                      return (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 p-3 cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-primary/10 border-l-4 border-l-primary" 
                              : "bg-background hover-elevate"
                          }`}
                          onClick={() => handleItemChange(String(item.id))}
                          data-testid={`item-row-${item.id}`}
                        >
                          <div 
                            className="relative w-16 h-16 flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.imageUrl) {
                                setZoomedImage({ url: item.imageUrl, title: item.title });
                              }
                            }}
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-contain rounded bg-white border"
                              />
                            ) : (
                              <div className="w-full h-full rounded bg-muted flex items-center justify-center border">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute -top-1 -left-1 p-0.5 bg-primary rounded-full">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{item.title}</span>
                              {item.madeInUSA && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Flag className="h-3 w-3" /> USA
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.brand} - {item.model}
                            </div>
                            {details && !details.error && (
                              <div className="flex items-center gap-3 text-xs">
                                <span className="font-medium text-green-600">${details.basePrice.toFixed(2)}</span>
                                <span className="text-muted-foreground">{details.sizes.length} sizes</span>
                                <span className="text-muted-foreground">{details.colors.length} colors</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {catalogDetails && selectedItem && (
              <div className="space-y-4 p-4 border rounded-md bg-card">
                <div className="flex items-center gap-4">
                  {catalogDetails.imageUrl && (
                    <img src={catalogDetails.imageUrl} alt="" className="w-20 h-20 rounded object-cover" />
                  )}
                  <div>
                    <div className="font-medium">{selectedItem.title}</div>
                    <div className="text-sm text-muted-foreground">
                      Provider: {catalogDetails.selectedProvider.title}
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      ${catalogDetails.basePrice.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>5. QR Placement</Label>
                  <div className="flex flex-wrap gap-2">
                    {QR_PLACEMENTS.map(({ id, label, Icon }) => (
                      <Button
                        key={id}
                        variant={selectedPlacement === id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPlacement(id)}
                        data-testid={`placement-${id}`}
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="header-enabled">Header Text (+$2)</Label>
                    <Switch
                      id="header-enabled"
                      checked={headerEnabled}
                      onCheckedChange={setHeaderEnabled}
                    />
                  </div>
                  {headerEnabled && (
                    <Input
                      placeholder="Header text (max 20 chars)"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value.slice(0, 20))}
                      maxLength={20}
                    />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="footer-enabled">Footer Text (+$2)</Label>
                    <Switch
                      id="footer-enabled"
                      checked={footerEnabled}
                      onCheckedChange={setFooterEnabled}
                    />
                  </div>
                  {footerEnabled && (
                    <Input
                      placeholder="Footer text (max 30 chars)"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value.slice(0, 30))}
                      maxLength={30}
                    />
                  )}

                  {totalUpcharge > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Base ${catalogDetails.basePrice.toFixed(2)} + ${totalUpcharge} text
                    </div>
                  )}
                </div>

                <Button 
                  onClick={addToStagingCart}
                  disabled={!canAddToCart}
                  className="w-full"
                  data-testid="button-add-to-cart"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add to Cart
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Add more items or click "Save All" above when done
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsContent() {
  const { toast } = useToast();
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  type AdminProduct = Product & { categoryIds?: string[] };
  
  const { data: products = [], isLoading, refetch } = useQuery<AdminProduct[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: allCategories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["/api/admin/product-categories"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/admin/products/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Success", description: "Product updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update product.", variant: "destructive" });
    },
  });

  const syncCategoriesMutation = useMutation({
    mutationFn: async ({ productId, categoryIds }: { productId: string; categoryIds: string[] }) => {
      return apiRequest("POST", `/api/admin/products/${productId}/categories`, { categoryIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Success", description: "Product tags updated." });
      setEditingProductId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update tags.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <AddFromPrintifyPanel onSuccess={() => refetch()} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>QR Gear Product Catalog</CardTitle>
            <CardDescription>
              All products added to QR Gear. Enable/disable and assign tags here. 
              To add products to a specific partner store (like Kingdom Connects), go to the Partners tab.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No products yet.</p>
            <p className="text-sm">Add products from the Printify catalog.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <Card key={product.id} className="p-4">
                <div className="flex items-start gap-4">
                  {product.imageUrl && (
                    <img src={product.imageUrl} alt="" className="w-20 h-20 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="font-medium text-lg">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.category} {product.madeInUSA && <Badge variant="outline" className="ml-2 text-xs">USA Made</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Base Price</div>
                          <div className="font-medium">${product.basePrice}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Markup</div>
                          <div className="font-medium">{product.markupPercent || 0}%</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Enabled</Label>
                          <Switch
                            checked={product.isEnabled || false}
                            onCheckedChange={(enabled) => toggleMutation.mutate({ id: product.id, enabled })}
                            disabled={toggleMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <ProductOptionsEditor product={product} onUpdate={() => refetch()} />
                    
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Tags</Label>
                      <ProductTagEditor
                        productId={product.id}
                        allCategories={allCategories.filter(c => c.isActive)}
                        assignedCategoryIds={product.categoryIds || []}
                        isEditing={editingProductId === product.id}
                        onEdit={() => setEditingProductId(product.id)}
                        onSave={(categoryIds) => syncCategoriesMutation.mutate({ productId: product.id, categoryIds })}
                        onCancel={() => setEditingProductId(null)}
                        isSaving={syncCategoriesMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}

export default function AdminProducts() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  return (
    <div className="min-h-screen">
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    Products
                  </h1>
                  <p className="text-xs text-slate-400">
                    Manage product catalog
                  </p>
                </div>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">Logged in as</p>
                  <p className="text-sm font-medium">{user.email || user.id}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyUserId}
                  className="font-mono text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
                  data-testid="button-copy-user-id"
                >
                  Copy ID
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        <nav className="mb-4 text-sm" aria-label="Breadcrumb">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground" data-testid="link-breadcrumb-admin">Admin</Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-foreground font-medium" aria-current="page" data-testid="text-breadcrumb-current">Products</span>
        </nav>

        <ProductsContent />
      </main>
    </div>
  );
}
