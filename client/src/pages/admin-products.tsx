import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronDown,
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
  DollarSign,
  Upload,
  FolderOpen,
  Store,
  QrCode,
  ImageIcon,
  ExternalLink,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Product, ProductCategory, HostingTier, AdminSettings } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CatalogSyncStatus {
  latestSync: {
    id: string;
    status: string;
    syncType: string;
    blueprintsCount: number;
    providersCount: number;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  totalBlueprints: number;
  isConfigured: boolean;
}

interface CostSyncStatusData {
  isRunning: boolean;
  currentSync?: {
    id: string;
    status: string;
    totalProviders: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    startedAt: string;
    completedAt?: string;
  };
  stats: {
    total: number;
    withCosts: number;
    stale: number;
  };
}

function CatalogSyncSection() {
  const { toast } = useToast();
  const [isSyncRunning, setIsSyncRunning] = useState(false);
  const [isCostSyncRunning, setIsCostSyncRunning] = useState(false);
  
  const { data: syncStatus, refetch: refetchStatus, isLoading, isError, error } = useQuery<CatalogSyncStatus>({
    queryKey: ["/api/admin/catalog/sync-status"],
    refetchInterval: isSyncRunning ? 5000 : false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    staleTime: 60000,
  });

  const { data: costSyncStatus, refetch: refetchCostStatus } = useQuery<CostSyncStatusData>({
    queryKey: ["/api/admin/catalog/cost-sync-status"],
    refetchInterval: isCostSyncRunning ? 3000 : false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  useEffect(() => {
    if (costSyncStatus?.isRunning !== undefined) {
      setIsCostSyncRunning(costSyncStatus.isRunning);
    }
  }, [costSyncStatus?.isRunning]);
  
  useEffect(() => {
    const running = syncStatus?.latestSync?.status === 'running';
    if (running !== isSyncRunning) {
      setIsSyncRunning(running || false);
    }
  }, [syncStatus?.latestSync?.status, isSyncRunning]);
  
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/catalog/sync");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "Downloading catalog from Printify..." });
      refetchStatus();
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const costSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/catalog/sync-all-costs");
      return res.json();
    },
    onMutate: () => {
      setIsCostSyncRunning(true);
    },
    onSuccess: (data) => {
      toast({ 
        title: "Cost sync started", 
        description: `Fetching costs for ${data.totalProviders || 'all'} products in background...` 
      });
      refetchCostStatus();
    },
    onError: (error: any) => {
      toast({ title: "Cost sync failed", description: error.message, variant: "destructive" });
      setIsCostSyncRunning(false);
    },
  });
  
  const isSyncing = syncStatus?.latestSync?.status === 'running';
  const lastSync = syncStatus?.latestSync;
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <Card className="mb-4">
      <CardContent className="pt-4 px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Printify Catalog</h3>
              {syncStatus?.totalBlueprints ? (
                <Badge variant="secondary" className="text-xs">
                  {syncStatus.totalBlueprints} products cached
                </Badge>
              ) : null}
            </div>
            {isLoading && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading sync status...
              </p>
            )}
            {isError && (
              <p className="text-xs text-destructive flex items-center gap-2">
                Failed to load status
                <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={() => refetchStatus()}>
                  Retry
                </Button>
              </p>
            )}
            {!isLoading && !isError && lastSync && (
              <p className="text-xs text-muted-foreground">
                {lastSync.status === 'running' ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Syncing... ({lastSync.blueprintsCount || 0} blueprints)
                  </span>
                ) : lastSync.status === 'completed' ? (
                  <>Last synced: {formatDate(lastSync.completedAt || lastSync.startedAt)}</>
                ) : lastSync.status === 'failed' ? (
                  <span className="text-destructive">Last sync failed: {lastSync.errorMessage}</span>
                ) : null}
              </p>
            )}
            {!isLoading && !isError && !lastSync && (
              <p className="text-xs text-muted-foreground">
                No catalog synced yet. Click "Sync Now" to download the Printify catalog.
              </p>
            )}
          </div>

          {costSyncStatus?.stats && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-green-600" />
                <span className="text-muted-foreground">
                  {costSyncStatus.stats.withCosts}/{costSyncStatus.stats.total} with costs
                </span>
              </div>
              {costSyncStatus.stats.stale > 0 && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  {costSyncStatus.stats.stale} stale (&gt;24h)
                </Badge>
              )}
              {isCostSyncRunning && costSyncStatus.currentSync && (
                <span className="text-muted-foreground">
                  {costSyncStatus.currentSync.processedCount}/{costSyncStatus.currentSync.totalProviders} processed
                </span>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={isSyncing || syncMutation.isPending}
              data-testid="button-sync-catalog"
            >
              {isSyncing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Sync Catalog</>
              )}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => costSyncMutation.mutate()}
              disabled={isCostSyncRunning || costSyncMutation.isPending || !syncStatus?.totalBlueprints}
              data-testid="button-sync-costs"
            >
              {isCostSyncRunning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing Costs...</>
              ) : (
                <><DollarSign className="h-4 w-4 mr-2" /> Sync Costs</>
              )}
            </Button>
          </div>
        </div>
        
        {isSyncing && (
          <Progress value={undefined} className="mt-3 h-1" />
        )}
        {isCostSyncRunning && costSyncStatus?.currentSync && (
          <div className="mt-3 space-y-1">
            <Progress 
              value={(costSyncStatus.currentSync.processedCount / costSyncStatus.currentSync.totalProviders) * 100} 
              className="h-1" 
            />
            <p className="text-xs text-muted-foreground">
              Syncing costs: {costSyncStatus.currentSync.successCount} success, {costSyncStatus.currentSync.failedCount} failed, {costSyncStatus.currentSync.skippedCount} skipped
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
      className={`w-5 h-5 rounded-sm border flex-shrink-0 ${className}`}
      ref={(el) => { if (el) el.style.backgroundColor = hex; }}
    />
  );
}

function ProductOptionsEditor({ product, onUpdate }: { product: Product; onUpdate: () => void }) {
  const { toast } = useToast();
  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
  
  const rawColors = Array.isArray(product.availableColors) ? product.availableColors : [];
  const colors: Array<{name: string; hex: string}> = rawColors.map((c: any) => {
    if (typeof c === 'string') {
      return { name: c, hex: getSwatchColor(c) };
    }
    return { name: c.name || '', hex: c.hex || getSwatchColor(c.name || '') };
  });
  
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
    return <div className="text-sm text-muted-foreground">Waiting for auto-sync...</div>;
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
                <ColorSwatch hex={color.hex || getSwatchColor(color.name)} className="w-5 h-5" />
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

// Store type definitions
const STORE_TYPES = ["Internal", "External"] as const;
type StoreType = typeof STORE_TYPES[number];

// Predefined stores by type
const INTERNAL_STORES = [
  { name: "QR Gear Main", segments: ["Homepage", "Dashboard", "Featured", "Seasonal"] },
  { name: "Holiday Shop", segments: ["Homepage", "Christmas", "Easter", "Thanksgiving"] },
  { name: "Religious Store", segments: ["Homepage", "Scripture", "Church", "Faith"] },
];

const EXTERNAL_STORES: Array<{ name: string; segments: string[] }> = [];

// Product source types
const PRODUCT_SOURCES = ["Library", "Custom"] as const;
type ProductSource = typeof PRODUCT_SOURCES[number];

const QR_PLACEMENTS = [
  { id: "front-chest", label: "Front Chest", Icon: Shirt },
  { id: "front-center", label: "Front Center", Icon: Target },
  { id: "back", label: "Back", Icon: ArrowLeft },
  { id: "left-shoulder", label: "Left Shoulder", Icon: ArrowLeft },
  { id: "right-shoulder", label: "Right Shoulder", Icon: ArrowRight },
  { id: "wrap-around", label: "Wrap Around", Icon: RotateCw },
];

const FONT_FAMILIES = [
  { name: "Arial", sample: "ABC abc 123" },
  { name: "Helvetica", sample: "ABC abc 123" },
  { name: "Times New Roman", sample: "ABC abc 123" },
  { name: "Georgia", sample: "ABC abc 123" },
  { name: "Verdana", sample: "ABC abc 123" },
  { name: "Courier New", sample: "ABC abc 123" },
  { name: "Impact", sample: "ABC abc 123" },
  { name: "Comic Sans MS", sample: "ABC abc 123" },
  { name: "Trebuchet MS", sample: "ABC abc 123" },
  { name: "Palatino Linotype", sample: "ABC abc 123" },
];

const FONT_SIZES = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48"];
const FONTS = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Impact",
  "Comic Sans MS",
  "Trebuchet MS",
  "Palatino Linotype",
  "Lucida Console",
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
  placements: string[];
  headerEnabled: boolean;
  footerEnabled: boolean;
  colors: string[];
  sizes: string[];
  brand: string;
  model: string;
}

interface StoreWithAreas {
  name: string;
  areas?: string[];
  segments?: string[];
}

interface AddFromPrintifyPanelProps {
  onSuccess: () => void;
  onFilterChange?: (store: string, segment: string, productSource?: string, productCategory?: string) => void;
}

function AddFromPrintifyPanel({ onSuccess, onFilterChange }: AddFromPrintifyPanelProps) {
  const { toast } = useToast();
  
  // New stepped flow state
  const [storeType, setStoreType] = useState<StoreType | "">("");
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [productSource, setProductSource] = useState<ProductSource | "">("");
  
  // Segment configuration switches
  const [showOnHomepage, setShowOnHomepage] = useState(true);
  const [showOnDashboard, setShowOnDashboard] = useState(false);
  const [showOnMemberPage, setShowOnMemberPage] = useState(false);
  const [showOnStaticPage, setShowOnStaticPage] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isSeasonalPromo, setIsSeasonalPromo] = useState(false);
  
  // Legacy state for compatibility
  const [stagedProducts, setStagedProducts] = useState<StagedProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<"all" | "usa" | "other">("all");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [catalogDetails, setCatalogDetails] = useState<CatalogDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  // Placement configs: map of placement ID to mode ('full' = header+QR+footer, 'qr-only' = just QR)
  type PlacementMode = 'full' | 'qr-only';
  const [placementConfigs, setPlacementConfigs] = useState<Record<string, PlacementMode>>({
    "front-chest": "full"
  });
  // Helper to get selected placements as array (for compatibility)
  const selectedPlacements = Object.keys(placementConfigs);
  const [headerEnabled, setHeaderEnabled] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [footerEnabled, setFooterEnabled] = useState(false);
  const [footerText, setFooterText] = useState("");
  const [headerFontFamily, setHeaderFontFamily] = useState("Arial");
  const [headerFontSize, setHeaderFontSize] = useState("120"); // Print-scale size for 4500x5400 canvas
  const [headerColor, setHeaderColor] = useState("#000000");
  const [headerLetterSpacing, setHeaderLetterSpacing] = useState(0);
  const [headerWarp, setHeaderWarp] = useState<string>("straight");
  const [headerStrokeColor, setHeaderStrokeColor] = useState("");
  const [headerStrokeWidth, setHeaderStrokeWidth] = useState(0);
  const [footerFontFamily, setFooterFontFamily] = useState("Arial");
  const [footerFontSize, setFooterFontSize] = useState("96"); // Print-scale size for 4500x5400 canvas
  const [footerColor, setFooterColor] = useState("#000000");
  const [footerLetterSpacing, setFooterLetterSpacing] = useState(0);
  const [footerWarp, setFooterWarp] = useState<string>("straight");
  const [footerStrokeColor, setFooterStrokeColor] = useState("");
  const [footerStrokeWidth, setFooterStrokeWidth] = useState(0);
  
  // Landing page overlay state (displayed when QR is scanned, not printed)
  const [landingOverlayEnabled, setLandingOverlayEnabled] = useState(false);
  const [landingTitle, setLandingTitle] = useState("");
  const [landingDescription, setLandingDescription] = useState("");
  const [landingPosition, setLandingPosition] = useState<"top" | "bottom">("top");
  const [landingFontFamily, setLandingFontFamily] = useState("Arial");
  const [landingColor, setLandingColor] = useState("#FFFFFF");
  
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string>("");
  const [textUpcharge, setTextUpcharge] = useState("2.00");
  const [selectedHostingTier, setSelectedHostingTier] = useState<string>("1_year");
  const [customLocationFilter, setCustomLocationFilter] = useState<"all" | "usa" | "other">("all");
  const [savingCustom, setSavingCustom] = useState(false);
  const [lastSavedDesign, setLastSavedDesign] = useState<{id: string; printifyCompositeUrl?: string} | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{url: string; title: string} | null>(null);
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(new Set());
  const [enabledColors, setEnabledColors] = useState<Set<string>>(new Set());
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configuringItem, setConfiguringItem] = useState<CatalogItem | null>(null);
  const [itemConfigurations, setItemConfigurations] = useState<Record<number, { sizes: Set<string>; colors: Set<string> }>>({});
  
  const [addStoreDialogOpen, setAddStoreDialogOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreAreas, setNewStoreAreas] = useState<string[]>([""]);
  const [newSegmentName, setNewSegmentName] = useState("");
  const [addingSegment, setAddingSegment] = useState(false);
  const [deleteWizardStoreId, setDeleteWizardStoreId] = useState<string | null>(null);
  const [deleteWizardSegmentInfo, setDeleteWizardSegmentInfo] = useState<{ storeId: string; segment: string } | null>(null);
  
  // Library picker state (backgrounds + templates)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [libraryPickerTab, setLibraryPickerTab] = useState<"backgrounds" | "templates">("backgrounds");
  const [libraryFilterSeason, setLibraryFilterSeason] = useState<string>("all");
  const [libraryFilterEvent, setLibraryFilterEvent] = useState<string>("all");
  // Track which source button was clicked: templates, backgrounds, or custom
  const [librarySourceType, setLibrarySourceType] = useState<"templates" | "backgrounds" | "custom" | null>(null);
  // SVG preview state
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string>("");
  const [generatingPng, setGeneratingPng] = useState(false);
  // Inline background picker state (in Custom Builder)
  const [bgPickerExpanded, setBgPickerExpanded] = useState(false);
  // QR content type: plain_text (offline, no hosting) vs rich_media (hosted landing page with background)
  const [qrContentType, setQrContentType] = useState<"plain_text" | "rich_media" | null>(null);
  // Plain text QR content (URL or text to encode directly)
  const [plainTextQrContent, setPlainTextQrContent] = useState<string>("");
  
  // Fetch render config (fonts and warp presets) for SVG text warp system
  interface RenderConfig {
    fonts: string[];
    warpPresets: { value: string; label: string }[];
  }
  const { data: renderConfig } = useQuery<RenderConfig>({
    queryKey: ["/api/render/config"],
  });
  
  // Fetch partner stores from database for External store type
  type PartnerStoreData = { id: string; name: string; availableSegments: string[] | null; isInternal?: boolean | null };
  const { data: partnerStoresData = [] } = useQuery<PartnerStoreData[]>({
    queryKey: ["/api/admin/partner-stores"],
  });
  
  // Fetch hosting tiers for pricing
  const { data: hostingTiers = [] } = useQuery<HostingTier[]>({
    queryKey: ["/api/hosting-tiers"],
  });
  
  // Fetch admin settings for markup calculation
  const { data: adminSettings } = useQuery<AdminSettings>({
    queryKey: ["/api/admin/settings"],
  });
  
  // Fetch library backgrounds for picker
  interface LibraryBackground {
    id: string;
    name: string;
    publicUrl: string;
    category: string | null;
    season: string | null;
    event: string | null;
    visibleStoreSlugs: string[] | null;
    visibleSegments: { segments: string[] } | null;
  }
  const { data: libraryBackgrounds = [] } = useQuery<LibraryBackground[]>({
    queryKey: ["/api/admin/library/admin", { assetType: "background", mediaType: "image" }],
    queryFn: async () => {
      const params = new URLSearchParams({ assetType: "background", mediaType: "image" });
      const response = await fetch(`/api/admin/library/admin?${params}`);
      if (!response.ok) throw new Error("Failed to fetch backgrounds");
      return response.json();
    },
    enabled: libraryPickerOpen,
  });
  
  // Fetch library templates (custom designs saved to library)
  interface LibraryTemplate {
    id: string;
    productId: number;
    productName: string;
    productImage: string | null;
    placements: string[] | null;
    backgroundImageUrl: string | null;
    topText: { text: string; fontFamily: string; fontSize: string } | null;
    bottomText: { text: string; fontFamily: string; fontSize: string } | null;
    qrCodeUrl: string | null;
    printifyCompositeUrl: string | null;
    storeType: string | null;
    storeName: string | null;
    segment: string | null;
    isFeatured: boolean | null;
    isSeasonalPromo: boolean | null;
    landingOverlay: { enabled: boolean; title: string; description: string; position: string; fontFamily: string; color: string } | null;
    createdAt: string;
  }
  const { data: libraryTemplates = [] } = useQuery<LibraryTemplate[]>({
    queryKey: ["/api/admin/library/templates"],
    enabled: libraryPickerOpen && libraryPickerTab === "templates",
  });
  
  // Season and event filter options for library picker
  const LIBRARY_SEASONS = [
    { value: "all", label: "All Seasons" },
    { value: "spring", label: "Spring" },
    { value: "summer", label: "Summer" },
    { value: "fall", label: "Fall" },
    { value: "winter", label: "Winter" },
  ];
  const LIBRARY_EVENTS = [
    { value: "all", label: "All Events" },
    { value: "christmas", label: "Christmas" },
    { value: "easter", label: "Easter" },
    { value: "thanksgiving", label: "Thanksgiving" },
    { value: "valentines", label: "Valentine's Day" },
    { value: "mothers-day", label: "Mother's Day" },
    { value: "fathers-day", label: "Father's Day" },
    { value: "independence-day", label: "Independence Day" },
    { value: "new-year", label: "New Year" },
    { value: "halloween", label: "Halloween" },
    { value: "graduation", label: "Graduation" },
    { value: "birthday", label: "Birthday" },
    { value: "wedding", label: "Wedding" },
    { value: "anniversary", label: "Anniversary" },
  ];
  
  // Filter library items by season/event only
  // Note: Visibility rules (visibleStoreSlugs, visibleSegments) apply to customer-facing widget,
  // not admin builder. Admins can access all backgrounds to build products for any store.
  const filteredBackgrounds = libraryBackgrounds.filter((bg) => {
    if (libraryFilterSeason !== "all" && bg.season !== libraryFilterSeason) return false;
    if (libraryFilterEvent !== "all" && bg.event !== libraryFilterEvent) return false;
    return true;
  });
  
  // Get selected hosting tier price (default to $5 for 1 year if not loaded)
  const selectedTier = hostingTiers.find(t => t.code === selectedHostingTier);
  const defaultTierPrices: Record<string, number> = { "1_year": 5, "2_year": 8, "3_year": 10 };
  const hostingPrice = selectedTier 
    ? parseFloat(selectedTier.priceUpcharge || "0")
    : (defaultTierPrices[selectedHostingTier] || 5);
  
  // Calculate markup percentage and fixed
  const markupPercent = parseFloat(adminSettings?.globalMarkupPercent || "25");
  const markupFixed = parseFloat(adminSettings?.globalMarkupFixed || "0");
  
  // Derive available stores based on store type
  // Include partner stores from database filtered by isInternal
  const dbInternalStores: StoreWithAreas[] = partnerStoresData
    .filter(ps => ps.isInternal)
    .map(ps => ({ name: ps.name, areas: ps.availableSegments || [] }));
  const dbExternalStores: StoreWithAreas[] = partnerStoresData
    .filter(ps => !ps.isInternal)
    .map(ps => ({ name: ps.name, areas: ps.availableSegments || [] }));
  
  const availableStores = storeType === "Internal" 
    ? (() => {
        const combined = [...INTERNAL_STORES, ...dbInternalStores];
        const seen = new Set<string>();
        return combined.filter(s => {
          if (seen.has(s.name)) return false;
          seen.add(s.name);
          return true;
        });
      })()
    : storeType === "External"
    ? (() => {
        const combined = [...EXTERNAL_STORES, ...dbExternalStores];
        const seen = new Set<string>();
        return combined.filter(s => {
          if (seen.has(s.name)) return false;
          seen.add(s.name);
          return true;
        });
      })()
    : [];
  
  // All DB stores for segment lookup
  const dbPartnerStores: StoreWithAreas[] = partnerStoresData.map(ps => ({
    name: ps.name,
    areas: ps.availableSegments || [],
  }));
  
  // Find current store's segments - prioritize dbPartnerStores (with segments) over predefined stores
  const allStores: Array<{ name: string; segments?: string[]; areas?: string[] }> = [
    ...dbPartnerStores,  // Partner stores from DB first (have segments)
    ...INTERNAL_STORES,  // Predefined stores
    ...EXTERNAL_STORES, 
  ];
  const currentStoreData = allStores.find(
    (s) => s.name === selectedStore || s.name === selectedStore.replace(/^(Internal:|External:)/, "")
  );
  const availableSegments: string[] = currentStoreData?.segments || currentStoreData?.areas || [];
  type ItemDetails = {
    basePrice: number;
    maxPrice?: number;
    costsAvailable?: boolean;
    costsFromDatabase?: boolean;
    colorsFromDatabase?: boolean;
    sizesFromDatabase?: boolean;
    colors: any[];
    sizes: string[];
    providerId?: number;
    providerName?: string;
    error?: boolean;
  };
  const [itemDetails, setItemDetails] = useState<Record<number, ItemDetails>>({});
  const [fetchingBatch, setFetchingBatch] = useState(false);
  const [fetchingCostFor, setFetchingCostFor] = useState<number | null>(null);

  async function fetchCostForItem(blueprintId: number, providerId: number) {
    setFetchingCostFor(blueprintId);
    try {
      const res = await fetch("/api/admin/catalog/fetch-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ blueprintId, providerId }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch costs");
      }
      
      const data = await res.json();
      
      setItemDetails(prev => ({
        ...prev,
        [blueprintId]: {
          ...prev[blueprintId],
          basePrice: data.minCost / 100,
          maxPrice: data.maxCost / 100,
          costsAvailable: true,
          costsFromDatabase: true,
        }
      }));
      
      toast({ title: "Success", description: `Cost: $${(data.minCost / 100).toFixed(2)} - $${(data.maxCost / 100).toFixed(2)}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setFetchingCostFor(null);
    }
  }

  // Add new segment to existing store
  async function handleAddSegmentToStore() {
    if (!newSegmentName.trim() || !selectedStore) return;
    
    setAddingSegment(true);
    try {
      // Find the current store in partner stores
      const currentPartnerStore = partnerStoresData.find(ps => ps.name === selectedStore);
      if (currentPartnerStore) {
        // Update partner store in database
        const currentSegments = currentPartnerStore.availableSegments || [];
        const updatedSegments = [...currentSegments, newSegmentName.trim()];
        
        const res = await fetch(`/api/admin/partner-stores/${currentPartnerStore.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ availableSegments: updatedSegments }),
        });
        
        if (!res.ok) throw new Error("Failed to update store");
        
        // Invalidate and refetch to get updated data immediately
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
        await queryClient.refetchQueries({ queryKey: ["/api/admin/partner-stores"] });
        toast({ title: "Success", description: `Added segment "${newSegmentName.trim()}" to ${selectedStore}` });
      } else {
        // Store not in database yet - create it with this segment
        const res = await fetch("/api/admin/partner-stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            name: selectedStore, 
            availableSegments: [newSegmentName.trim()] 
          }),
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create store");
        }
        
        // Invalidate and refetch to get updated data immediately
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
        await queryClient.refetchQueries({ queryKey: ["/api/admin/partner-stores"] });
        toast({ title: "Success", description: `Created "${selectedStore}" with segment "${newSegmentName.trim()}"` });
      }
      setNewSegmentName("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAddingSegment(false);
    }
  }

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
      
      // Track all results to pass to cost fetching
      const accumulatedResults: Record<number, ItemDetails> = {};
      
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
                const detail: ItemDetails = {
                  basePrice: d.basePrice || 0,
                  maxPrice: d.maxPrice || 0,
                  costsAvailable: d.costsAvailable || false,
                  costsFromDatabase: d.costsFromDatabase || false,
                  colorsFromDatabase: d.colorsFromDatabase || false,
                  sizesFromDatabase: d.sizesFromDatabase || false,
                  colors: d.colors || [],
                  sizes: d.sizes || [],
                  providerId: d.providerId,
                  providerName: d.providerName,
                  error: d.error,
                };
                next[parseInt(id)] = detail;
                accumulatedResults[parseInt(id)] = detail;
              }
              return next;
            });
          }
        } catch {
        }
      }
      
      setFetchingBatch(false);
      // Costs are now read from database only - no auto-fetching
      // Admin can trigger a manual sync from the catalog sync section
    };
    
    fetchBatchDetails();
  }, [selectedCategory, JSON.stringify(allCategoryItems.map(i => i.id))]);

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
      placements: Array.from(selectedPlacements),
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
    setPlacementConfigs({"front-chest": "full"});
    setHeaderEnabled(false);
    setHeaderText("");
    setHeaderFontFamily("Arial");
    setHeaderFontSize("120");
    setHeaderColor("#000000");
    setHeaderLetterSpacing(0);
    setHeaderWarp("straight");
    setHeaderStrokeColor("");
    setHeaderStrokeWidth(0);
    setFooterEnabled(false);
    setFooterText("");
    setFooterFontFamily("Arial");
    setFooterFontSize("96");
    setFooterColor("#000000");
    setFooterLetterSpacing(0);
    setFooterWarp("straight");
    setFooterStrokeColor("");
    setFooterStrokeWidth(0);
  }
  
  function removeFromStagingCart(id: string) {
    setStagedProducts(prev => prev.filter(p => p.id !== id));
  }

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      if (stagedProducts.length === 0) throw new Error("No products to save");
      
      const saveCategoryPath = `${storeType}/${selectedStore}/${selectedSegment}`;
      
      // Derive placements from selected segments
      const selectedLocations = selectedSegment.split(",").filter(Boolean);
      const derivedPlacements = {
        showOnHomepage: selectedLocations.includes("Homepage"),
        showOnDashboard: selectedLocations.includes("Dashboard"),
        showOnMemberPage: selectedLocations.includes("Member Page"),
        showOnStaticPage: selectedLocations.includes("Static Page"),
        locations: selectedLocations,
      };
      
      const results = await Promise.all(
        stagedProducts.map(product => 
          apiRequest("POST", "/api/admin/products/from-printify", {
            blueprintId: product.blueprintId,
            printProviderId: product.printProviderId,
            name: product.name,
            description: product.description,
            category: saveCategoryPath,
            basePrice: product.basePrice,
            imageUrl: product.imageUrl,
            manufacturer: product.manufacturer,
            madeInUSA: product.madeInUSA,
            availablePlacements: product.placements || ["front-chest"],
            availableColors: product.colors,
            availableSizes: product.sizes,
            metadata: { 
              brand: product.brand, 
              model: product.model,
              defaultPlacement: (product.placements || ["front-chest"])[0],
              headerTextEnabled: product.headerEnabled,
              footerTextEnabled: product.footerEnabled,
              storeType,
              storeName: selectedStore,
              segment: selectedSegment,
              placements: derivedPlacements,
              isFeatured,
              isSeasonalPromo,
              productSource,
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
        description: `${count} product(s) added to ${selectedStore} / ${selectedSegment}.` 
      });
      resetForm();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save products.", variant: "destructive" });
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async (item: CatalogItem) => {
      if (!selectedStore || !selectedSegment) throw new Error("Please complete all steps first");
      if (!hasValidPlacements) throw new Error("Please select at least one location");
      
      const details = itemDetails[item.id];
      const config = itemConfigurations[item.id];
      
      if (!details) throw new Error("Product details not loaded - click Configure first");
      
      const selectedColors = config ? Array.from(config.colors) : details.colors;
      const selectedSizes = config ? Array.from(config.sizes) : details.sizes;
      
      if (selectedColors.length === 0 && selectedSizes.length === 0) {
        throw new Error("Please select at least one size or color");
      }
      
      const saveCategoryPath = `${storeType}/${selectedStore}/${selectedSegment}`;
      
      // Derive placements from selected segments
      const selectedLocations = selectedSegment.split(",").filter(Boolean);
      const derivedPlacements = {
        showOnHomepage: selectedLocations.includes("Homepage"),
        showOnDashboard: selectedLocations.includes("Dashboard"),
        showOnMemberPage: selectedLocations.includes("Member Page"),
        showOnStaticPage: selectedLocations.includes("Static Page"),
        locations: selectedLocations,
      };
      
      return apiRequest("POST", "/api/admin/products/from-printify", {
        blueprintId: item.id,
        printProviderId: details.providerId,
        name: item.title,
        description: item.brand + " " + item.model,
        category: saveCategoryPath,
        basePrice: details.basePrice,
        imageUrl: item.imageUrl,
        manufacturer: details.providerName || "Printify",
        madeInUSA: item.madeInUSA,
        availablePlacements: Array.from(selectedPlacements),
        availableColors: selectedColors,
        availableSizes: selectedSizes,
        metadata: { 
          brand: item.brand, 
          model: item.model,
          defaultPlacement: Array.from(selectedPlacements)[0] || "front-chest",
          storeType,
          storeName: selectedStore,
          segment: selectedSegment,
          placements: derivedPlacements,
          isFeatured,
          isSeasonalPromo,
          productSource,
        },
      });
    },
    onSuccess: (_, item) => {
      const config = itemConfigurations[item.id];
      const sizesCount = config?.sizes.size || 0;
      const colorsCount = config?.colors.size || 0;
      toast({ 
        title: "Product Saved!", 
        description: `${item.title} added to ${selectedStore} / ${selectedSegment} with ${sizesCount} sizes, ${colorsCount} colors.` 
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setStoreType("");
    setSelectedStore("");
    setSelectedSegment("");
    setProductSource("");
    setIsFeatured(false);
    setIsSeasonalPromo(false);
    setStagedProducts([]);
    setSelectedCategory("");
    setLocationFilter("all");
    setSelectedItemId(null);
    setCatalogDetails(null);
    setPlacementConfigs({"front-chest": "full"});
    setHeaderEnabled(false);
    setHeaderText("");
    setHeaderFontFamily("Arial");
    setHeaderFontSize("120");
    setHeaderColor("#000000");
    setHeaderLetterSpacing(0);
    setHeaderWarp("straight");
    setHeaderStrokeColor("");
    setHeaderStrokeWidth(0);
    setFooterEnabled(false);
    setFooterText("");
    setFooterFontFamily("Arial");
    setFooterFontSize("96");
    setFooterColor("#000000");
    setFooterLetterSpacing(0);
    setFooterWarp("straight");
    setFooterStrokeColor("");
    setFooterStrokeWidth(0);
  }
  
  function handleStoreTypeChange(type: StoreType | "") {
    setStoreType(type);
    setSelectedStore("");
    setSelectedSegment("");
    setProductSource("");
  }
  
  function handleStoreChange(store: string) {
    if (store === "__add_new__") {
      setAddStoreDialogOpen(true);
      return;
    }
    setSelectedStore(store);
    setSelectedSegment("");
    setProductSource("");
    // Update saved items filter to this store
    onFilterChange?.(store, "", productSource, selectedCategory);
  }
  
  function handleSegmentSelect(segment: string) {
    setSelectedSegment(segment);
    setProductSource("");
    // Update saved items filter to this store+segment
    onFilterChange?.(selectedStore, segment, productSource, selectedCategory);
  }
  
  async function saveNewStore() {
    if (!newStoreName.trim()) {
      toast({ title: "Error", description: "Please enter a store name", variant: "destructive" });
      return;
    }
    const filteredAreas = newStoreAreas.filter(a => a.trim());
    if (filteredAreas.length === 0) {
      toast({ title: "Error", description: "Please add at least one area", variant: "destructive" });
      return;
    }
    
    try {
      // Generate unique slug with timestamp to avoid duplicates
      const baseSlug = newStoreName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const uniqueSlug = `${baseSlug}-${Date.now()}`;
      
      // Save to database via API (apiRequest throws on non-2xx status)
      const response = await apiRequest("POST", "/api/admin/partner-stores", {
        name: newStoreName.trim(),
        slug: uniqueSlug,
        availableSegments: filteredAreas,
        isActive: true,
        isInternal: storeType === "Internal",
      });
      const savedStore = await response.json();
      
      // Close dialog and reset form immediately
      setAddStoreDialogOpen(false);
      setNewStoreName("");
      setNewStoreAreas([""]);
      
      // Refetch partner stores and wait for completion
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      await queryClient.refetchQueries({ queryKey: ["/api/admin/partner-stores"] });
      
      // Set selected store from the saved store data after refetch completes
      setSelectedStore(savedStore.name || newStoreName.trim());
      toast({ title: "Store Created", description: `${savedStore.name} with ${filteredAreas.length} area(s) saved` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create store", variant: "destructive" });
    }
  }
  
  async function handleSaveCustomDesign(saveTarget: "library" | "store" | "both") {
    if (!selectedItemId || !catalogDetails) {
      toast({ title: "Error", description: "Please select a product first", variant: "destructive" });
      return;
    }
    
    setSavingCustom(true);
    
    try {
      // Upload background image first if exists (before creating design data)
      // This prevents sending blob URLs or large data in the JSON payload
      let finalBackgroundUrl: string | null = null;
      
      if (backgroundImage) {
        // New file uploaded - upload to server first
        const formData = new FormData();
        formData.append("file", backgroundImage);
        formData.append("type", "custom-design");
        
        console.log("[Upload] Starting file upload:", backgroundImage.name, backgroundImage.size);
        
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          console.log("[Upload] Success:", uploadData);
          finalBackgroundUrl = uploadData.url;
        } else {
          const errorText = await uploadRes.text();
          console.error("[Upload] Failed:", uploadRes.status, errorText);
          throw new Error(`Failed to upload background image: ${errorText}`);
        }
      } else if (backgroundPreview && !backgroundPreview.startsWith("blob:")) {
        // Existing URL (not a blob URL) - preserve it
        finalBackgroundUrl = backgroundPreview;
      }
      
      // Prepare design data with only the uploaded URL (not the blob preview)
      const designData = {
        productId: selectedItemId,
        productName: catalogDetails.blueprint?.title || "Custom Product",
        productImage: catalogDetails.imageUrl || "",
        placements: selectedPlacements, // Array of placement IDs
        placementConfigs, // Map of placement ID to mode ('full' | 'qr-only')
        backgroundImage: finalBackgroundUrl,
        topText: headerEnabled ? {
          text: headerText,
          fontFamily: headerFontFamily,
          fontSize: headerFontSize,
          color: headerColor,
          letterSpacing: headerLetterSpacing,
          warpPreset: headerWarp,
          strokeColor: headerStrokeColor || undefined,
          strokeWidth: headerStrokeWidth || undefined,
        } : null,
        bottomText: footerEnabled ? {
          text: footerText,
          fontFamily: footerFontFamily,
          fontSize: footerFontSize,
          color: footerColor,
          letterSpacing: footerLetterSpacing,
          warpPreset: footerWarp,
          strokeColor: footerStrokeColor || undefined,
          strokeWidth: footerStrokeWidth || undefined,
        } : null,
        // Landing page overlay - displayed when QR is scanned (not printed)
        landingOverlay: landingOverlayEnabled ? {
          enabled: true,
          title: landingTitle,
          description: landingDescription,
          position: landingPosition,
          fontFamily: landingFontFamily,
          color: landingColor,
        } : null,
        textUpcharge: parseFloat(textUpcharge) || 2.00,
        storeType,
        storeName: selectedStore,
        segment: selectedSegment,
        isFeatured,
        isSeasonalPromo,
      };
      
      // Save custom design and get QR code
      const res = await apiRequest("POST", "/api/admin/custom-designs", {
        ...designData,
        saveTarget,
      });
      
      const result = await res.json();
      
      // Store the saved design for viewing print image
      setLastSavedDesign({
        id: result.id,
        printifyCompositeUrl: result.printifyCompositeUrl,
      });
      
      toast({ 
        title: "Custom Design Created!", 
        description: `Saved as "${result.id}". View the generated print image below.` 
      });
      
      // Reset custom builder fields but keep lastSavedDesign visible
      setBackgroundImage(null);
      setBackgroundPreview("");
      setHeaderEnabled(false);
      setHeaderText("");
      setHeaderFontFamily("Arial");
      setHeaderFontSize("120");
      setHeaderColor("#000000");
      setHeaderLetterSpacing(0);
      setHeaderWarp("straight");
      setHeaderStrokeColor("");
      setHeaderStrokeWidth(0);
      setFooterEnabled(false);
      setFooterText("");
      setFooterFontFamily("Arial");
      setFooterFontSize("96");
      setFooterColor("#000000");
      setFooterLetterSpacing(0);
      setFooterWarp("straight");
      setFooterStrokeColor("");
      setFooterStrokeWidth(0);
      setLandingOverlayEnabled(false);
      setLandingTitle("");
      setLandingDescription("");
      setLandingPosition("top");
      setLandingFontFamily("Arial");
      setLandingColor("#FFFFFF");
      setSelectedItemId(null);
      setCatalogDetails(null);
      
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save custom design", variant: "destructive" });
    } finally {
      setSavingCustom(false);
    }
  }
  
  function addAreaField() {
    setNewStoreAreas([...newStoreAreas, ""]);
  }
  
  function updateAreaField(index: number, value: string) {
    const updated = [...newStoreAreas];
    updated[index] = value;
    setNewStoreAreas(updated);
  }
  
  function removeAreaField(index: number) {
    if (newStoreAreas.length <= 1) return;
    setNewStoreAreas(newStoreAreas.filter((_, i) => i !== index));
  }

  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    setSelectedItemId(null);
    setCatalogDetails(null);
    setLocationFilter("all");
    onFilterChange?.(selectedStore, selectedSegment, productSource, category);
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

  function openConfigDialog(item: CatalogItem) {
    const details = itemDetails[item.id];
    setConfiguringItem(item);
    if (details) {
      setEnabledSizes(new Set(details.sizes || []));
      setEnabledColors(new Set(details.colors || []));
    }
    setConfigDialogOpen(true);
    if (!details) {
      fetchItemDetails(item.id);
    }
  }

  function toggleSize(size: string) {
    setEnabledSizes(prev => {
      const next = new Set(prev);
      if (next.has(size)) {
        next.delete(size);
      } else {
        next.add(size);
      }
      return next;
    });
  }

  function toggleColor(color: string) {
    setEnabledColors(prev => {
      const next = new Set(prev);
      if (next.has(color)) {
        next.delete(color);
      } else {
        next.add(color);
      }
      return next;
    });
  }

  function selectAllSizes() {
    const details = configuringItem ? itemDetails[configuringItem.id] : null;
    if (details) {
      setEnabledSizes(new Set(details.sizes || []));
    }
  }

  function deselectAllSizes() {
    setEnabledSizes(new Set());
  }

  function selectAllColors() {
    const details = configuringItem ? itemDetails[configuringItem.id] : null;
    if (details) {
      setEnabledColors(new Set(details.colors || []));
    }
  }

  function deselectAllColors() {
    setEnabledColors(new Set());
  }

  // Build category path for saving
  const categoryPath = selectedStore && selectedSegment 
    ? `${storeType}/${selectedStore}/${selectedSegment}` 
    : selectedStore || "";
  
  // Validate flow
  const hasValidPlacements = !!selectedSegment && selectedSegment.length > 0;
  const canProceedToProduct = storeType && selectedStore && hasValidPlacements;
  const canSaveAll = stagedProducts.length > 0 && canProceedToProduct;

  return (
    <Card className="mb-6">
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Product
        </CardTitle>
        <CardDescription>Internal/External → Store → Segment → Library or Custom</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {loadingCatalog ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading catalog...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Store Type (Internal/External) */}
            <div className="space-y-3 p-4 border-2 border-primary/30 rounded-lg">
              <Label className="text-lg font-bold">Step 1: Store Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={storeType === "Internal" ? "default" : "outline"}
                  className="h-16 text-base"
                  onClick={() => handleStoreTypeChange("Internal")}
                  data-testid="button-store-type-internal"
                >
                  <div className="text-center">
                    <div className="font-bold">Internal</div>
                    <div className="text-xs opacity-80">Our Site</div>
                  </div>
                </Button>
                <Button
                  variant={storeType === "External" ? "default" : "outline"}
                  className="h-16 text-base"
                  onClick={() => handleStoreTypeChange("External")}
                  data-testid="button-store-type-external"
                >
                  <div className="text-center">
                    <div className="font-bold">External</div>
                    <div className="text-xs opacity-80">Partner Sites</div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Step 2: Store Selection */}
            {storeType && (
              <div className="space-y-3 p-4 border-2 border-primary/30 rounded-lg">
                <Label className="text-lg font-bold">Step 2: Select Store</Label>
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 p-3 border rounded-md bg-background text-base"
                    value={selectedStore}
                    onChange={(e) => handleStoreChange(e.target.value)}
                    data-testid="select-store"
                  >
                    <option value="">-- Select a store --</option>
                    <option value="__add_new__" className="font-semibold">+ Add New Store...</option>
                    {availableStores.map((store) => (
                      <option key={store.name} value={store.name}>{store.name}</option>
                    ))}
                  </select>
                  {selectedStore && selectedStore !== "__add_new__" && (() => {
                    const storeToDelete = partnerStoresData.find(s => s.name === selectedStore);
                    return storeToDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-destructive hover:bg-destructive/10 flex-shrink-0"
                        onClick={() => setDeleteWizardStoreId(storeToDelete.id)}
                        title="Delete this store"
                        data-testid="button-delete-wizard-store"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            {/* Step 3: Store Locations (Switches) */}
            {selectedStore && (
              <div className="space-y-4 p-4 border-2 border-primary/30 rounded-lg">
                <Label className="text-lg font-bold">Step 3: Store Locations</Label>
                <p className="text-sm text-muted-foreground">Select where this product will appear</p>
                
                {/* Location Switches based on store's segments/areas */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  {availableSegments.map((segment) => (
                    <div key={segment} className="flex items-center justify-between gap-2">
                      <Label htmlFor={`sw-loc-${segment}`} className="text-sm cursor-pointer flex-1">{segment}</Label>
                      <div className="flex items-center gap-1">
                        <Switch
                          id={`sw-loc-${segment}`}
                          checked={selectedSegment === segment || (!!selectedSegment && selectedSegment.split(",").includes(segment))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const current = selectedSegment ? selectedSegment.split(",").filter(Boolean) : [];
                              if (!current.includes(segment)) {
                                current.push(segment);
                              }
                              handleSegmentSelect(current.join(","));
                            } else {
                              const current = selectedSegment ? selectedSegment.split(",").filter(Boolean) : [];
                              const updated = current.filter(s => s !== segment);
                              handleSegmentSelect(updated.join(",") || "");
                            }
                          }}
                          data-testid={`switch-location-${segment.toLowerCase().replace(/\s+/g, "-")}`}
                        />
                        {(() => {
                          const storeData = partnerStoresData.find(s => s.name === selectedStore);
                          return storeData ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteWizardSegmentInfo({ storeId: storeData.id, segment })}
                              title="Delete this segment"
                              data-testid={`button-delete-segment-${segment.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  ))}
                  
                  {availableSegments.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No locations configured for this store</p>
                  )}
                  
                  {/* Add New Segment to existing store */}
                  <div className="pt-3 border-t mt-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="New segment name..."
                        value={newSegmentName}
                        onChange={(e) => setNewSegmentName(e.target.value)}
                        className="flex-1"
                        data-testid="input-new-segment"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddSegmentToStore}
                        disabled={!newSegmentName.trim() || addingSegment}
                        data-testid="button-add-segment"
                      >
                        {addingSegment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                
                {!selectedSegment && (
                  <p className="text-xs text-destructive">Select at least one location</p>
                )}
              </div>
            )}

            {/* Step 4: Store Occasion */}
            {selectedSegment && (
              <div className="space-y-4 p-4 border-2 border-primary/30 rounded-lg">
                <Label className="text-lg font-bold">Step 4: Store Occasion</Label>
                <p className="text-sm text-muted-foreground">Optional: Mark as featured or seasonal</p>
                
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sw-featured" className="text-sm cursor-pointer font-medium">Featured Product</Label>
                    <Switch
                      id="sw-featured"
                      checked={isFeatured}
                      onCheckedChange={setIsFeatured}
                      data-testid="switch-featured"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sw-seasonal" className="text-sm cursor-pointer font-medium">Seasonal Promo</Label>
                    <Switch
                      id="sw-seasonal"
                      checked={isSeasonalPromo}
                      onCheckedChange={setIsSeasonalPromo}
                      data-testid="switch-seasonal"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Product Source (Templates/Custom) */}
            {selectedSegment && (
              <div className="space-y-4 p-4 border-2 border-primary/30 rounded-lg">
                <Label className="text-lg font-bold">Step 5: Product Source</Label>
                <p className="text-sm text-muted-foreground">Choose how to start your design</p>
                <div className="flex flex-col gap-3">
                  <Button
                    variant={librarySourceType === "templates" ? "default" : "outline"}
                    className={`h-16 text-lg w-full ${librarySourceType === "templates" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    onClick={() => {
                      setLibrarySourceType("templates");
                      setLibraryPickerTab("templates");
                      setLibraryPickerOpen(true);
                      setProductSource("Custom");
                      setQrContentType(null); // Reset QR type selection
                      setPlainTextQrContent(""); // Reset plain text content
                    }}
                    data-testid="button-source-templates"
                  >
                    <div className="text-center">
                      <div className="font-bold text-lg">Templates</div>
                      <div className="text-xs opacity-80">Load a saved design to edit</div>
                    </div>
                  </Button>
                  <Button
                    variant={librarySourceType === "custom" ? "default" : "outline"}
                    className={`h-16 text-lg w-full ${librarySourceType === "custom" ? "ring-2 ring-accent ring-offset-2" : ""}`}
                    onClick={() => {
                      setLibrarySourceType("custom");
                      setProductSource("Custom");
                      setQrContentType(null); // Reset QR type selection
                      setPlainTextQrContent(""); // Reset plain text content
                      toast({
                        title: "Custom Selected",
                        description: "Choose QR type below",
                        duration: 2000,
                      });
                    }}
                    data-testid="button-source-custom"
                  >
                    <div className="text-center">
                      <div className="font-bold text-lg">Custom</div>
                      <div className="text-xs opacity-80">Build from scratch</div>
                    </div>
                  </Button>
                </div>
              </div>
            )}


            {/* Custom: Build Module */}
            {productSource === "Custom" && (
              <div className="space-y-4 p-2 sm:p-4 border-2 border-accent/50 rounded-lg bg-accent/5">
                <Label className="text-lg font-bold">Custom Product Builder</Label>
                <p className="text-sm text-muted-foreground">
                  Build a custom design with QR code for your products.
                </p>
                
                {/* QR Content Type Selection */}
                <div className="space-y-3">
                  <Label className="font-semibold">QR Type</Label>
                  <p className="text-sm text-muted-foreground">Choose what your QR code will contain</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant={qrContentType === "plain_text" ? "default" : "outline"}
                      className={`min-h-16 py-3 text-base w-full flex flex-col items-center justify-center border-2 ${qrContentType === "plain_text" ? "ring-2 ring-primary ring-offset-2 border-white/50" : "border-border"}`}
                      onClick={() => {
                        setQrContentType("plain_text");
                        // Clear all rich-media state since plain text doesn't need it
                        setBackgroundImage(null);
                        setBackgroundPreview("");
                        setBgPickerExpanded(false);
                        // Reset header/footer toggles
                        setHeaderEnabled(false);
                        setFooterEnabled(false);
                        setHeaderText("");
                        setFooterText("");
                        // Reset landing overlay
                        setLandingOverlayEnabled(false);
                        setLandingTitle("");
                        setLandingDescription("");
                        // Clear hosting tier (not used for plain text)
                        setSelectedHostingTier("");
                      }}
                      data-testid="button-qr-plain-text"
                    >
                      <span className="font-bold text-base">Plain Text QR</span>
                      <span className="text-xs opacity-80 whitespace-normal">Offline scannable - no hosting needed</span>
                    </Button>
                    <Button
                      variant={qrContentType === "rich_media" ? "default" : "outline"}
                      className={`min-h-16 py-3 text-base w-full flex flex-col items-center justify-center border-2 ${qrContentType === "rich_media" ? "ring-2 ring-primary ring-offset-2 border-white/50" : "border-border"}`}
                      onClick={() => {
                        setQrContentType("rich_media");
                        // Set default hosting tier if not already set (1 year free included)
                        if (!selectedHostingTier) {
                          setSelectedHostingTier("1_year");
                        }
                      }}
                      data-testid="button-qr-rich-media"
                    >
                      <span className="font-bold text-base">Image / Video QR</span>
                      <span className="text-xs opacity-80 whitespace-normal">Hosted landing page - 1 year free</span>
                    </Button>
                  </div>
                </div>
                
                {/* Step 1: Select Product Type (Category) - Only show after QR type selected */}
                {qrContentType && (
                <div className="space-y-2">
                  <Label className="font-semibold">Step 1: Product Type</Label>
                  <select
                    className="w-full p-3 border rounded-md bg-background"
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    data-testid="select-custom-category"
                  >
                    <option value="">-- Select product type --</option>
                    {catalog.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name} ({cat.count})
                      </option>
                    ))}
                  </select>
                </div>
                )}

                {/* Step 2: Location Filter (US/Other) - Only show after category selected */}
                {qrContentType && selectedCategory && categoryData && (
                  <div className="space-y-2">
                    <Label className="font-semibold">Step 2: Made In</Label>
                    {(() => {
                      const usaCount = categoryData.items.filter(i => i.madeInUSA).length;
                      const otherCount = categoryData.items.filter(i => !i.madeInUSA).length;
                      return (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant={customLocationFilter === "usa" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCustomLocationFilter("usa")}
                            data-testid="custom-filter-usa"
                          >
                            USA Only ({usaCount})
                          </Button>
                          <Button
                            variant={customLocationFilter === "other" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCustomLocationFilter("other")}
                            data-testid="custom-filter-other"
                          >
                            Elsewhere ({otherCount})
                          </Button>
                          <Button
                            variant={customLocationFilter === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCustomLocationFilter("all")}
                            data-testid="custom-filter-all"
                          >
                            All ({categoryData.items.length})
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Step 3: Select Product from filtered list */}
                {qrContentType && selectedCategory && categoryData && (
                  <div className="space-y-2">
                    <Label className="font-semibold">Step 3: Select Product</Label>
                    <div className="max-h-[32rem] sm:max-h-64 overflow-y-auto border-2 border-border rounded-lg p-1 sm:p-3 bg-background space-y-3">
                      {(() => {
                        const items = customLocationFilter === "usa" 
                          ? categoryData.items.filter(i => i.madeInUSA)
                          : customLocationFilter === "other"
                          ? categoryData.items.filter(i => !i.madeInUSA)
                          : categoryData.items;
                        return items.length > 0 ? items.map((item) => {
                          const details = itemDetails[item.id];
                          return (
                            <div
                              key={item.id}
                              className={`rounded-lg cursor-pointer border-2 transition-all overflow-hidden ${selectedItemId === item.id ? "bg-primary/10 border-primary shadow-sm" : "border-border hover:border-primary/50 hover:bg-muted/50"}`}
                              onClick={() => {
                                setSelectedItemId(item.id);
                                fetchItemDetails(item.id);
                              }}
                              data-testid={`custom-item-${item.id}`}
                            >
                              {/* Row 1: Image + Name side by side */}
                              <div className="flex flex-row gap-2 sm:gap-4 p-2 sm:p-4 items-center">
                                <div 
                                  className="relative group cursor-pointer flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomedImage({ url: item.imageUrl || "", title: item.title });
                                  }}
                                >
                                  <img src={item.imageUrl || ""} alt={item.title} className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg object-cover border-2 border-blue-400" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                    <ZoomIn className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm sm:text-xl font-semibold leading-tight truncate">{item.title}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs sm:text-lg text-muted-foreground">{item.brand}</span>
                                    {item.madeInUSA && (
                                      <img 
                                        src="https://flagcdn.com/w40/us.png" 
                                        srcSet="https://flagcdn.com/w80/us.png 2x"
                                        alt="Made in USA"
                                        className="h-4 sm:h-7 w-auto rounded-sm shadow-sm"
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Row 2: Price - full width */}
                              {details && !details.error && details.basePrice > 0 && (
                                <div className="px-2 sm:px-4 pb-2">
                                  <span className="text-lg font-bold text-green-600">
                                    {details.maxPrice && details.maxPrice > details.basePrice 
                                      ? `$${details.basePrice.toFixed(2)}–$${details.maxPrice.toFixed(2)}`
                                      : `$${details.basePrice.toFixed(2)}`}
                                  </span>
                                </div>
                              )}
                              
                              {/* Row 3: Sizes (full width) */}
                              {details && !details.error && details.sizes.length > 0 && (
                                <div className="py-4 px-4 border-b border-border/50">
                                  <div className="text-base text-muted-foreground font-medium mb-2">
                                    Sizes{details.sizesFromDatabase && <span className="text-green-600 ml-2">(cached)</span>}
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    {details.sizes.slice(0, 8).map((size: string) => (
                                      <Badge key={size} variant="secondary" className="text-sm px-3 py-1">{size}</Badge>
                                    ))}
                                    {details.sizes.length > 8 && (
                                      <span className="text-sm text-muted-foreground self-center">+{details.sizes.length - 8}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Row 4: Color Swatches (full width) */}
                              {details && !details.error && details.colors.length > 0 && (
                                <div className="py-4 px-4">
                                  <div className="text-base text-muted-foreground font-medium mb-2">
                                    Colors{details.colorsFromDatabase && <span className="text-green-600 ml-2">(cached)</span>}
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    {details.colors.slice(0, 12).map((color: any, idx: number) => {
                                      const colorName = typeof color === 'object' ? color.name : color;
                                      const colorHex = typeof color === 'object' ? color.hex : getSwatchColor(color);
                                      return (
                                        <div
                                          key={colorName || idx}
                                          className="w-8 h-8 rounded-md border-2 border-border shadow-sm"
                                          style={{ backgroundColor: colorHex || getSwatchColor(colorName) }}
                                          title={colorName}
                                        />
                                      );
                                    })}
                                    {details.colors.length > 12 && (
                                      <span className="text-sm text-muted-foreground self-center">+{details.colors.length - 12}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }) : (
                          <p className="text-sm text-muted-foreground p-4 text-center">No products match this filter</p>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {/* 3. Print Placement Options with Mode Toggle */}
                {selectedItemId && (
                  <div className="space-y-4">
                    <Label className="font-semibold">Print Placements</Label>
                    <p className="text-sm text-muted-foreground">Select placements and choose artwork type for each</p>
                    
                    <div className="space-y-3">
                      {QR_PLACEMENTS.map(({ id, label, Icon }) => {
                        const isSelected = id in placementConfigs;
                        const mode = placementConfigs[id] || "full";
                        
                        return (
                          <div 
                            key={id}
                            className={`p-3 rounded-lg border-2 transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              {/* Placement Selection */}
                              <Button
                                variant={isSelected ? "default" : "outline"}
                                className="h-12 min-w-[140px] flex-1"
                                onClick={() => {
                                  const newConfigs = { ...placementConfigs };
                                  if (isSelected) {
                                    // Don't allow removing last placement
                                    if (Object.keys(newConfigs).length > 1) {
                                      delete newConfigs[id];
                                    }
                                  } else {
                                    newConfigs[id] = "full";
                                  }
                                  setPlacementConfigs(newConfigs);
                                }}
                                data-testid={`placement-${id}`}
                              >
                                <Icon className="h-5 w-5 mr-2" />
                                {label}
                              </Button>
                              
                              {/* Mode Toggle - only show when selected */}
                              {isSelected && (
                                <div className="flex gap-1 bg-muted rounded-md p-1">
                                  <Button
                                    variant={mode === "full" ? "default" : "ghost"}
                                    size="sm"
                                    className="h-10 px-3 text-xs"
                                    onClick={() => {
                                      setPlacementConfigs({
                                        ...placementConfigs,
                                        [id]: "full"
                                      });
                                    }}
                                    data-testid={`placement-${id}-full`}
                                  >
                                    Full Artwork
                                  </Button>
                                  <Button
                                    variant={mode === "qr-only" ? "default" : "ghost"}
                                    size="sm"
                                    className="h-10 px-3 text-xs"
                                    onClick={() => {
                                      setPlacementConfigs({
                                        ...placementConfigs,
                                        [id]: "qr-only"
                                      });
                                    }}
                                    data-testid={`placement-${id}-qr-only`}
                                  >
                                    QR Only
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Summary */}
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <div className="font-medium mb-1">Selected Placements:</div>
                      {Object.entries(placementConfigs).map(([id, mode]) => {
                        const placement = QR_PLACEMENTS.find(p => p.id === id);
                        return (
                          <div key={id} className="flex justify-between text-muted-foreground">
                            <span>{placement?.label || id}</span>
                            <span className="text-xs">{mode === "full" ? "Full Artwork" : "QR Only"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Plain Text QR Content Input (only for plain_text QR) */}
                {selectedItemId && qrContentType === "plain_text" && (
                  <div className="space-y-3 p-4 border rounded-lg bg-background">
                    <Label className="font-semibold">QR Code Content</Label>
                    <p className="text-sm text-muted-foreground">
                      Enter the text or URL that will be encoded directly in the QR code.
                    </p>
                    <Input
                      placeholder="https://yourwebsite.com or any text"
                      value={plainTextQrContent}
                      onChange={(e) => setPlainTextQrContent(e.target.value)}
                      className="h-12 text-base"
                      data-testid="input-plain-text-qr"
                    />
                    <p className="text-xs text-muted-foreground">
                      Max ~2,000 characters. For best scanning, keep it short (URLs recommended).
                    </p>
                  </div>
                )}
                
                {/* 4. Background Image - Two Buttons Stacked (only for rich media QR) */}
                {selectedItemId && qrContentType === "rich_media" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold">Background Image</Label>
                      {backgroundPreview && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBackgroundImage(null);
                            setBackgroundPreview("");
                          }}
                          data-testid="button-remove-background"
                        >
                          <X className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                    
                    {/* Current Selection Preview */}
                    {backgroundPreview && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                        <img 
                          src={backgroundPreview} 
                          alt="Selected background" 
                          className="h-16 w-auto rounded object-cover"
                        />
                        <span className="text-sm text-muted-foreground">Background selected</span>
                      </div>
                    )}
                    
                    {/* Two stacked buttons: Library + Upload */}
                    <div className="flex flex-col gap-2">
                      {/* Library Backgrounds Button */}
                      <Button
                        variant={bgPickerExpanded ? "default" : "outline"}
                        className="w-full h-12 text-base"
                        onClick={() => setBgPickerExpanded(!bgPickerExpanded)}
                        data-testid="button-library-backgrounds"
                      >
                        <FolderOpen className="h-5 w-5 mr-2" />
                        Library Backgrounds
                        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${bgPickerExpanded ? "rotate-180" : ""}`} />
                      </Button>
                      
                      {/* Upload Button */}
                      <label className="cursor-pointer block">
                        <Button
                          variant="outline"
                          className="w-full h-12 text-base pointer-events-none"
                          asChild
                        >
                          <span>
                            <Upload className="h-5 w-5 mr-2" />
                            Upload Background
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setBackgroundImage(file);
                              setBackgroundPreview(URL.createObjectURL(file));
                              setBgPickerExpanded(false);
                              toast({
                                title: "Background Uploaded",
                                description: file.name,
                                duration: 2000,
                              });
                            }
                          }}
                          data-testid="input-background-upload"
                        />
                      </label>
                    </div>
                    
                    {/* Expanded Library Picker Panel */}
                    {bgPickerExpanded && (
                      <div className="space-y-3 p-3 border-2 border-primary/30 rounded-lg bg-background">
                        {/* Season/Event Filters */}
                        <div className="flex flex-wrap gap-2">
                          <select
                            className="h-10 px-3 border rounded-md text-sm bg-background flex-1 min-w-[120px]"
                            value={libraryFilterSeason}
                            onChange={(e) => setLibraryFilterSeason(e.target.value)}
                            data-testid="select-bg-filter-season"
                          >
                            <option value="all">All Seasons</option>
                            <option value="spring">Spring</option>
                            <option value="summer">Summer</option>
                            <option value="fall">Fall</option>
                            <option value="winter">Winter</option>
                          </select>
                          <select
                            className="h-10 px-3 border rounded-md text-sm bg-background flex-1 min-w-[120px]"
                            value={libraryFilterEvent}
                            onChange={(e) => setLibraryFilterEvent(e.target.value)}
                            data-testid="select-bg-filter-event"
                          >
                            <option value="all">All Events</option>
                            <option value="christmas">Christmas</option>
                            <option value="easter">Easter</option>
                            <option value="valentines">Valentine's</option>
                            <option value="mothers_day">Mother's Day</option>
                            <option value="fathers_day">Father's Day</option>
                            <option value="graduation">Graduation</option>
                            <option value="birthday">Birthday</option>
                            <option value="wedding">Wedding</option>
                            <option value="general">General</option>
                          </select>
                        </div>
                        
                        {/* Horizontal Scroll - 2 items visible at a time */}
                        <div className="relative">
                          <ScrollArea className="w-full" type="scroll">
                            <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
                              {filteredBackgrounds.length > 0 ? (
                                filteredBackgrounds.map((bg) => (
                                  <div
                                    key={bg.id}
                                    className={`flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                                      backgroundPreview === bg.publicUrl 
                                        ? "border-primary ring-2 ring-primary ring-offset-2" 
                                        : "border-border hover:border-primary/50"
                                    }`}
                                    onClick={() => {
                                      setBackgroundPreview(bg.publicUrl);
                                      setBackgroundImage(null);
                                      setBgPickerExpanded(false);
                                      toast({
                                        title: "Background Selected",
                                        description: bg.name,
                                        duration: 2000,
                                      });
                                    }}
                                    data-testid={`bg-card-${bg.id}`}
                                  >
                                    <div className="aspect-[9/16] relative">
                                      <img 
                                        src={bg.publicUrl} 
                                        alt={bg.name} 
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="p-2 text-center">
                                      <span className="text-xs font-medium truncate block">{bg.name}</span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="w-full text-center py-8 text-sm text-muted-foreground">
                                  No backgrounds match your filters
                                </div>
                              )}
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </div>
                        
                        <p className="text-xs text-muted-foreground text-center">
                          Tap to select • Scroll for more
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* 5. Text Options with Rich SVG Warp Controls (only for rich media QR) */}
                {selectedItemId && qrContentType === "rich_media" && (
                  <div className="space-y-4">
                    {/* Top Text (Header) with Warp */}
                    <div className="space-y-3 p-4 bg-background rounded-lg border">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="header-enabled" className="font-semibold text-base">Top Text (Header)</Label>
                        <Switch
                          id="header-enabled"
                          checked={headerEnabled}
                          onCheckedChange={setHeaderEnabled}
                          data-testid="switch-header-text"
                        />
                      </div>
                      {headerEnabled && (
                        <div className="space-y-4">
                          <Input
                            placeholder="Enter top text (max 35 chars)"
                            value={headerText}
                            onChange={(e) => setHeaderText(e.target.value.slice(0, 35))}
                            maxLength={35}
                            className="text-base h-12"
                            data-testid="input-header-text"
                          />
                          
                          {/* Font and Size Row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Font</Label>
                              <select
                                className="w-full h-12 px-3 border rounded-md text-sm bg-background"
                                value={headerFontFamily}
                                onChange={(e) => setHeaderFontFamily(e.target.value)}
                                style={{ fontFamily: headerFontFamily }}
                                data-testid="select-header-font"
                              >
                                {(renderConfig?.fonts || FONT_FAMILIES.map(f => f.name)).map((font) => (
                                  <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Size</Label>
                              <select
                                className="w-full h-12 px-3 border rounded-md text-sm bg-background"
                                value={headerFontSize}
                                onChange={(e) => setHeaderFontSize(e.target.value)}
                                data-testid="select-header-size"
                              >
                                {[72, 96, 120, 144, 168, 192, 216, 240, 280, 320].map((size) => (
                                  <option key={size} value={String(size)}>{size}pt</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          {/* Color and Warp Preset Row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Color</Label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={headerColor}
                                  onChange={(e) => setHeaderColor(e.target.value)}
                                  className="w-12 h-12 border rounded-md cursor-pointer"
                                  data-testid="input-header-color"
                                />
                                <Input
                                  value={headerColor}
                                  onChange={(e) => setHeaderColor(e.target.value)}
                                  className="flex-1 h-12 font-mono text-sm"
                                  placeholder="#000000"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Warp Style</Label>
                              <select
                                className="w-full h-12 px-3 border rounded-md text-sm bg-background"
                                value={headerWarp}
                                onChange={(e) => setHeaderWarp(e.target.value)}
                                data-testid="select-header-warp"
                              >
                                {(renderConfig?.warpPresets || [
                                  { value: 'straight', label: 'Straight' },
                                  { value: 'arc-up', label: 'Arc Up' },
                                  { value: 'arc-down', label: 'Arc Down' },
                                ]).map((preset) => (
                                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          {/* Letter Spacing Slider */}
                          <div>
                            <Label className="text-sm mb-1.5 block text-muted-foreground">
                              Letter Spacing: {headerLetterSpacing}px
                            </Label>
                            <input
                              type="range"
                              min="-10"
                              max="50"
                              value={headerLetterSpacing}
                              onChange={(e) => setHeaderLetterSpacing(Number(e.target.value))}
                              className="w-full h-3 accent-primary cursor-pointer"
                              data-testid="slider-header-spacing"
                            />
                          </div>
                          
                          {/* Optional Stroke/Outline */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Stroke Color (optional)</Label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={headerStrokeColor || "#ffffff"}
                                  onChange={(e) => setHeaderStrokeColor(e.target.value)}
                                  className="w-12 h-12 border rounded-md cursor-pointer"
                                  data-testid="input-header-stroke-color"
                                />
                                <Input
                                  value={headerStrokeColor}
                                  onChange={(e) => setHeaderStrokeColor(e.target.value)}
                                  className="flex-1 h-12 font-mono text-sm"
                                  placeholder="None"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Stroke Width: {headerStrokeWidth}px</Label>
                              <input
                                type="range"
                                min="0"
                                max="20"
                                value={headerStrokeWidth}
                                onChange={(e) => setHeaderStrokeWidth(Number(e.target.value))}
                                className="w-full h-3 accent-primary cursor-pointer mt-4"
                                data-testid="slider-header-stroke"
                              />
                            </div>
                          </div>
                          
                          {/* Text Preview with Warp Visualization */}
                          {headerText && (
                            <div className="p-4 bg-muted/50 rounded-md border text-center overflow-hidden">
                              <div 
                                style={{ 
                                  fontFamily: headerFontFamily, 
                                  fontSize: `${Math.min(parseInt(headerFontSize) * 0.25, 48)}px`,
                                  color: headerColor,
                                  letterSpacing: `${headerLetterSpacing * 0.1}px`,
                                  textShadow: headerStrokeColor && headerStrokeWidth > 0 
                                    ? `0 0 ${headerStrokeWidth}px ${headerStrokeColor}` 
                                    : undefined,
                                  fontWeight: 'bold',
                                }}
                              >
                                {headerText}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                Warp: {renderConfig?.warpPresets?.find(p => p.value === headerWarp)?.label || headerWarp}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Bottom Text (Footer) with Warp */}
                    <div className="space-y-3 p-4 bg-background rounded-lg border">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="footer-enabled" className="font-semibold text-base">Bottom Text (Footer)</Label>
                        <Switch
                          id="footer-enabled"
                          checked={footerEnabled}
                          onCheckedChange={setFooterEnabled}
                          data-testid="switch-footer-text"
                        />
                      </div>
                      {footerEnabled && (
                        <div className="space-y-4">
                          <Input
                            placeholder="Enter bottom text (max 40 chars)"
                            value={footerText}
                            onChange={(e) => setFooterText(e.target.value.slice(0, 40))}
                            maxLength={40}
                            className="text-base h-12"
                            data-testid="input-footer-text"
                          />
                          
                          {/* Font and Size Row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Font</Label>
                              <select
                                className="w-full h-12 px-3 border rounded-md text-sm bg-background"
                                value={footerFontFamily}
                                onChange={(e) => setFooterFontFamily(e.target.value)}
                                style={{ fontFamily: footerFontFamily }}
                                data-testid="select-footer-font"
                              >
                                {(renderConfig?.fonts || FONT_FAMILIES.map(f => f.name)).map((font) => (
                                  <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Size</Label>
                              <select
                                className="w-full h-12 px-3 border rounded-md text-sm bg-background"
                                value={footerFontSize}
                                onChange={(e) => setFooterFontSize(e.target.value)}
                                data-testid="select-footer-size"
                              >
                                {[72, 96, 120, 144, 168, 192, 216, 240, 280, 320].map((size) => (
                                  <option key={size} value={String(size)}>{size}pt</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          {/* Color and Warp Preset Row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Color</Label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={footerColor}
                                  onChange={(e) => setFooterColor(e.target.value)}
                                  className="w-12 h-12 border rounded-md cursor-pointer"
                                  data-testid="input-footer-color"
                                />
                                <Input
                                  value={footerColor}
                                  onChange={(e) => setFooterColor(e.target.value)}
                                  className="flex-1 h-12 font-mono text-sm"
                                  placeholder="#000000"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Warp Style</Label>
                              <select
                                className="w-full h-12 px-3 border rounded-md text-sm bg-background"
                                value={footerWarp}
                                onChange={(e) => setFooterWarp(e.target.value)}
                                data-testid="select-footer-warp"
                              >
                                {(renderConfig?.warpPresets || [
                                  { value: 'straight', label: 'Straight' },
                                  { value: 'arc-up', label: 'Arc Up' },
                                  { value: 'arc-down', label: 'Arc Down' },
                                ]).map((preset) => (
                                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          {/* Letter Spacing Slider */}
                          <div>
                            <Label className="text-sm mb-1.5 block text-muted-foreground">
                              Letter Spacing: {footerLetterSpacing}px
                            </Label>
                            <input
                              type="range"
                              min="-10"
                              max="50"
                              value={footerLetterSpacing}
                              onChange={(e) => setFooterLetterSpacing(Number(e.target.value))}
                              className="w-full h-3 accent-primary cursor-pointer"
                              data-testid="slider-footer-spacing"
                            />
                          </div>
                          
                          {/* Optional Stroke/Outline */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Stroke Color (optional)</Label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={footerStrokeColor || "#ffffff"}
                                  onChange={(e) => setFooterStrokeColor(e.target.value)}
                                  className="w-12 h-12 border rounded-md cursor-pointer"
                                  data-testid="input-footer-stroke-color"
                                />
                                <Input
                                  value={footerStrokeColor}
                                  onChange={(e) => setFooterStrokeColor(e.target.value)}
                                  className="flex-1 h-12 font-mono text-sm"
                                  placeholder="None"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm mb-1.5 block text-muted-foreground">Stroke Width: {footerStrokeWidth}px</Label>
                              <input
                                type="range"
                                min="0"
                                max="20"
                                value={footerStrokeWidth}
                                onChange={(e) => setFooterStrokeWidth(Number(e.target.value))}
                                className="w-full h-3 accent-primary cursor-pointer mt-4"
                                data-testid="slider-footer-stroke"
                              />
                            </div>
                          </div>
                          
                          {/* Text Preview */}
                          {footerText && (
                            <div className="p-4 bg-muted/50 rounded-md border text-center overflow-hidden">
                              <div 
                                style={{ 
                                  fontFamily: footerFontFamily, 
                                  fontSize: `${Math.min(parseInt(footerFontSize) * 0.25, 48)}px`,
                                  color: footerColor,
                                  letterSpacing: `${footerLetterSpacing * 0.1}px`,
                                  textShadow: footerStrokeColor && footerStrokeWidth > 0 
                                    ? `0 0 ${footerStrokeWidth}px ${footerStrokeColor}` 
                                    : undefined,
                                  fontWeight: 'bold',
                                }}
                              >
                                {footerText}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                Warp: {renderConfig?.warpPresets?.find(p => p.value === footerWarp)?.label || footerWarp}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Landing Page Overlay - Text shown when QR is scanned */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={landingOverlayEnabled}
                          onCheckedChange={setLandingOverlayEnabled}
                          data-testid="switch-landing-overlay"
                        />
                        <Label className="font-semibold">Landing Page Text Overlay</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add text that appears over the background when the QR code is scanned (not printed on product).
                      </p>
                      
                      {landingOverlayEnabled && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                              value={landingTitle}
                              onChange={(e) => setLandingTitle(e.target.value)}
                              placeholder="Welcome!"
                              data-testid="input-landing-title"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={landingDescription}
                              onChange={(e) => setLandingDescription(e.target.value)}
                              placeholder="Scan to see more..."
                              rows={2}
                              data-testid="input-landing-description"
                            />
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Position</Label>
                              <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={landingPosition}
                                onChange={(e) => setLandingPosition(e.target.value as "top" | "bottom")}
                                data-testid="select-landing-position"
                              >
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                              </select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-xs">Font</Label>
                              <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={landingFontFamily}
                                onChange={(e) => setLandingFontFamily(e.target.value)}
                                data-testid="select-landing-font"
                              >
                                {FONTS.map((font) => (
                                  <option key={font} value={font}>{font}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-xs">Text Color</Label>
                              <Input
                                type="color"
                                value={landingColor}
                                onChange={(e) => setLandingColor(e.target.value)}
                                className="h-10 p-1 cursor-pointer"
                                data-testid="input-landing-color"
                              />
                            </div>
                          </div>
                          
                          {/* Landing overlay preview */}
                          {(landingTitle || landingDescription) && (
                            <div 
                              className="p-4 rounded-md border bg-gradient-to-b from-gray-800 to-gray-900 relative overflow-hidden"
                              style={{ minHeight: "100px" }}
                            >
                              <div 
                                className={`text-center space-y-1 ${landingPosition === "bottom" ? "absolute bottom-4 left-4 right-4" : ""}`}
                                style={{ 
                                  fontFamily: landingFontFamily, 
                                  color: landingColor,
                                  textShadow: "2px 2px 4px rgba(0,0,0,0.7)"
                                }}
                              >
                                {landingTitle && <h3 className="text-lg font-bold">{landingTitle}</h3>}
                                {landingDescription && <p className="text-sm">{landingDescription}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Text Upcharge Field */}
                    <div className="space-y-2">
                      <Label className="font-semibold">Text Upcharge ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={textUpcharge}
                        onChange={(e) => setTextUpcharge(e.target.value)}
                        placeholder="2.00"
                        className="w-32"
                        data-testid="input-text-upcharge"
                      />
                      <p className="text-xs text-muted-foreground">Amount added per text line</p>
                    </div>
                    
                    {/* Design Preview - What will be printed */}
                    <div className="space-y-3 pt-4 border-t">
                      <Label className="font-semibold text-base">Print Design Preview</Label>
                      <p className="text-xs text-muted-foreground">
                        This shows what will be printed on the physical product (header + QR code + footer on white background).
                      </p>
                      <div 
                        className="border-2 border-dashed rounded-lg bg-white p-6 mx-auto max-w-xs"
                        style={{ aspectRatio: "2/3" }}
                        data-testid="design-preview"
                      >
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                          {headerEnabled && headerText && (
                            <div 
                              className="text-center text-black font-bold px-2"
                              style={{ 
                                fontFamily: headerFontFamily, 
                                fontSize: `${Math.min(parseInt(headerFontSize), 24)}px` 
                              }}
                            >
                              {headerText}
                            </div>
                          )}
                          <div className="flex-shrink-0 w-24 h-24 bg-gray-200 border-2 border-gray-300 rounded flex items-center justify-center">
                            <div className="text-center text-gray-500 text-xs">
                              <QrCode className="h-12 w-12 mx-auto mb-1 text-gray-400" />
                              QR Code
                            </div>
                          </div>
                          {footerEnabled && footerText && (
                            <div 
                              className="text-center text-black font-bold px-2"
                              style={{ 
                                fontFamily: footerFontFamily, 
                                fontSize: `${Math.min(parseInt(footerFontSize), 20)}px` 
                              }}
                            >
                              {footerText}
                            </div>
                          )}
                          {!headerEnabled && !footerEnabled && (
                            <p className="text-xs text-gray-400 text-center mt-2">
                              Enable text above to see preview
                            </p>
                          )}
                        </div>
                      </div>
                      {backgroundPreview && (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Background (shown on webpage only, not printed):</Label>
                          <img 
                            src={backgroundPreview} 
                            alt="Background preview" 
                            className="w-full max-w-xs mx-auto rounded-lg border opacity-60"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Pricing Summary */}
                {selectedItemId && catalogDetails && (
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="font-semibold text-base">Pricing Summary</Label>
                    
                    {/* Hosting Tier Selection - only for rich media QR */}
                    {qrContentType === "rich_media" && (
                    <div className="space-y-2">
                      <Label className="text-sm">Server Hosting Duration</Label>
                      <Select value={selectedHostingTier} onValueChange={setSelectedHostingTier}>
                        <SelectTrigger className="w-full h-12" data-testid="select-hosting-tier">
                          <SelectValue placeholder="Select hosting duration" />
                        </SelectTrigger>
                        <SelectContent>
                          {hostingTiers.filter(t => t.code && t.code.trim() !== "").length > 0 ? (
                            hostingTiers
                              .filter(t => t.code && t.code.trim() !== "")
                              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                              .map((tier) => (
                                <SelectItem key={tier.code} value={tier.code} data-testid={`tier-option-${tier.code}`}>
                                  {tier.name} - ${tier.priceUpcharge || "0"}
                                </SelectItem>
                              ))
                          ) : (
                            <>
                              <SelectItem value="1_year">1 Year - $5</SelectItem>
                              <SelectItem value="2_year">2 Years - $8</SelectItem>
                              <SelectItem value="3_year">3 Years - $10</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        How long the QR content will be hosted online
                      </p>
                    </div>
                    )}
                    
                    {/* Plain Text QR notice */}
                    {qrContentType === "plain_text" && (
                      <div className="p-3 bg-muted/50 rounded-lg border text-sm text-muted-foreground">
                        Plain Text QR - No hosting required. QR encodes text directly.
                      </div>
                    )}
                    
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Base Production Cost:</span>
                        <span className="font-medium">
                          {catalogDetails.basePrice > 0 ? `$${catalogDetails.basePrice.toFixed(2)}` : "Sync costs to view"}
                        </span>
                      </div>
                      
                      {/* Per-placement breakdown */}
                      {qrContentType === "rich_media" && (headerEnabled || footerEnabled) && (
                        <div className="border-t pt-2 mt-2">
                          <div className="text-xs text-muted-foreground mb-2">Text upcharges by placement:</div>
                          {Object.entries(placementConfigs).map(([id, mode]) => {
                            const placement = QR_PLACEMENTS.find(p => p.id === id);
                            const hasTextUpcharge = mode === "full" && (
                              (headerEnabled && headerText) || (footerEnabled && footerText)
                            );
                            const placementTextCost = hasTextUpcharge 
                              ? ((headerEnabled && headerText ? parseFloat(textUpcharge || "2") : 0) + 
                                 (footerEnabled && footerText ? parseFloat(textUpcharge || "2") : 0))
                              : 0;
                            
                            return (
                              <div key={id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {placement?.label || id} ({mode === "full" ? "Full" : "QR Only"})
                                </span>
                                <span className={mode === "full" && hasTextUpcharge ? "font-medium" : "text-muted-foreground"}>
                                  {mode === "qr-only" ? "—" : (hasTextUpcharge ? `+$${placementTextCost.toFixed(2)}` : "—")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {qrContentType === "rich_media" && (
                      <div className="flex justify-between text-sm">
                        <span>Hosting ({selectedTier?.name || {"1_year": "1 Year", "2_year": "2 Years", "3_year": "3 Years"}[selectedHostingTier] || "1 Year"}):</span>
                        <span className="font-medium">+${hostingPrice.toFixed(2)}</span>
                      </div>
                      )}
                      
                      {(() => {
                        // Calculate text upcharges only for "full" mode placements
                        const fullArtworkPlacements = Object.entries(placementConfigs).filter(([, mode]) => mode === "full");
                        const textUpchargePerPlacement = (headerEnabled && headerText ? parseFloat(textUpcharge || "2") : 0) + 
                                                        (footerEnabled && footerText ? parseFloat(textUpcharge || "2") : 0);
                        const totalTextUpcharge = qrContentType === "rich_media" ? fullArtworkPlacements.length * textUpchargePerPlacement : 0;
                        
                        // For plain_text QR, no hosting or text upcharges
                        const baseCost = qrContentType === "plain_text" 
                          ? catalogDetails.basePrice 
                          : catalogDetails.basePrice + totalTextUpcharge + hostingPrice;
                        const retailPrice = baseCost * (1 + markupPercent / 100) + markupFixed;
                        
                        return (
                          <>
                            <div className="border-t pt-2 mt-2 flex justify-between text-sm">
                              <span>Total Cost:</span>
                              <span className="font-medium">
                                {catalogDetails.basePrice > 0 ? `$${baseCost.toFixed(2)}` : "—"}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>+ Markup ({markupPercent}% + ${markupFixed.toFixed(2)}):</span>
                              <span className="font-medium">
                                {catalogDetails.basePrice > 0 ? `$${(retailPrice - baseCost).toFixed(2)}` : "—"}
                              </span>
                            </div>
                            <div className="border-t pt-2 mt-2 flex justify-between text-lg font-bold">
                              <span>Customer Price:</span>
                              <span className="text-green-600">
                                {catalogDetails.basePrice > 0 ? `$${retailPrice.toFixed(2)}` : "—"}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {/* 6. Save Buttons */}
                {selectedItemId && (
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="font-semibold">Save Custom Design</Label>
                    <p className="text-xs text-muted-foreground">
                      This will create a hosted page at /customs/[id] with your design and generate a QR code linking to it.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full h-12"
                        variant="outline"
                        disabled={savingCustom}
                        onClick={() => handleSaveCustomDesign("library")}
                        data-testid="button-save-library"
                      >
                        {savingCustom ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderOpen className="h-4 w-4 mr-2" />}
                        Save to Library Only
                      </Button>
                      <Button
                        className="w-full h-12"
                        variant="outline"
                        disabled={savingCustom}
                        onClick={() => handleSaveCustomDesign("store")}
                        data-testid="button-save-store"
                      >
                        {savingCustom ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Store className="h-4 w-4 mr-2" />}
                        Save to Store Only
                      </Button>
                      <Button
                        className="w-full h-12"
                        disabled={savingCustom}
                        onClick={() => handleSaveCustomDesign("both")}
                        data-testid="button-save-both"
                      >
                        {savingCustom ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        Save to Both Library & Store
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Last Saved Design - View Print Image */}
                {lastSavedDesign && (
                  <div className="space-y-3 pt-4 border-t bg-green-50 dark:bg-green-950/30 rounded-lg p-4 -mx-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <Label className="font-semibold text-green-700 dark:text-green-400">Design Saved Successfully!</Label>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Design ID:</span>{" "}
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">{lastSavedDesign.id}</code>
                    </p>
                    <div className="flex flex-col gap-2">
                      {lastSavedDesign.printifyCompositeUrl && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => window.open(lastSavedDesign.printifyCompositeUrl, '_blank')}
                          data-testid="button-view-print-image"
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          View Print-Ready Image
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(`/customs/${lastSavedDesign.id}`, '_blank')}
                        data-testid="button-view-qr-page"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View QR Landing Page
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLastSavedDesign(null)}
                        className="text-muted-foreground"
                        data-testid="button-dismiss-saved"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Add Store Dialog */}
            <Dialog open={addStoreDialogOpen} onOpenChange={setAddStoreDialogOpen}>
              <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Create New {storeType || ""} Store</DialogTitle>
                  <DialogDescription>Add a new store with segments/pages.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 w-full">
                  <div className="space-y-2 w-full">
                    <Label>Store Name</Label>
                    <Input
                      placeholder="e.g., My Business Store"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="w-full"
                      data-testid="input-new-store-name"
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label>Segments/Pages</Label>
                    {newStoreAreas.map((area, index) => (
                      <div key={index} className="flex gap-2 w-full">
                        <Input
                          placeholder={`Segment ${index + 1}`}
                          value={area}
                          onChange={(e) => updateAreaField(index, e.target.value)}
                          className="flex-1 min-w-0"
                          data-testid={`input-area-${index}`}
                        />
                        {newStoreAreas.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            onClick={() => removeAreaField(index)}
                            data-testid={`button-remove-area-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addAreaField}
                      className="w-full"
                      data-testid="button-add-area"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Segment
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full sm:flex-1"
                    onClick={() => setAddStoreDialogOpen(false)}
                    data-testid="button-back-dialog"
                  >
                    ← Back
                  </Button>
                  <Button 
                    className="w-full sm:flex-1"
                    onClick={saveNewStore} 
                    data-testid="button-save-store"
                  >
                    Create Store
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>

      <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-3xl p-2" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{zoomedImage?.title || "Product Image"}</DialogTitle>
          {zoomedImage && (
            <div 
              className="flex flex-col items-center gap-2 cursor-pointer"
              onClick={() => setZoomedImage(null)}
            >
              <img 
                src={zoomedImage.url} 
                alt={zoomedImage.title} 
                className="max-h-[80vh] w-auto object-contain rounded"
              />
              <p className="text-sm text-muted-foreground">{zoomedImage.title}</p>
              <p className="text-xs text-muted-foreground md:hidden">Tap image to close</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure Product
            </DialogTitle>
          </DialogHeader>
          
          {configuringItem && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {configuringItem.imageUrl && (
                  <img 
                    src={configuringItem.imageUrl} 
                    alt="" 
                    className="w-16 h-16 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm line-clamp-2">{configuringItem.title}</div>
                  <div className="text-xs text-muted-foreground">{configuringItem.brand}</div>
                </div>
              </div>

              {(() => {
                const details = itemDetails[configuringItem.id];
                if (!details) {
                  return (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2 text-sm">Loading options...</span>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Sizes</Label>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={selectAllSizes}
                            data-testid="button-select-all-sizes"
                          >
                            All
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={deselectAllSizes}
                            data-testid="button-deselect-all-sizes"
                          >
                            None
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(details.sizes || []).map((size) => (
                          <div 
                            key={size}
                            className="flex items-center gap-2 p-2 border rounded-lg"
                          >
                            <Switch
                              checked={enabledSizes.has(size)}
                              onCheckedChange={() => toggleSize(size)}
                              data-testid={`switch-size-${size}`}
                            />
                            <span className="text-sm font-medium">{size}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {enabledSizes.size} of {details.sizes?.length || 0} sizes selected
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Colors</Label>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={selectAllColors}
                            data-testid="button-select-all-colors"
                          >
                            All
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={deselectAllColors}
                            data-testid="button-deselect-all-colors"
                          >
                            None
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                        {(details.colors || []).map((color) => (
                          <div 
                            key={color}
                            className="flex items-center gap-3 p-2 border rounded-lg"
                          >
                            <Switch
                              checked={enabledColors.has(color)}
                              onCheckedChange={() => toggleColor(color)}
                              data-testid={`switch-color-${color}`}
                            />
                            <div 
                              className="w-6 h-6 rounded-sm border flex-shrink-0"
                              style={{ backgroundColor: getSwatchColor(color) }}
                            />
                            <span className="text-sm">{color}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {enabledColors.size} of {details.colors?.length || 0} colors selected
                      </p>
                    </div>
                  </>
                );
              })()}

              <DialogFooter className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline" data-testid="button-cancel-config">
                    Cancel
                  </Button>
                </DialogClose>
                <Button 
                  onClick={() => {
                    if (configuringItem) {
                      setItemConfigurations(prev => ({
                        ...prev,
                        [configuringItem.id]: {
                          sizes: new Set(enabledSizes),
                          colors: new Set(enabledColors),
                        }
                      }));
                      setSelectedItemId(configuringItem.id);
                    }
                    setConfigDialogOpen(false);
                    toast({ 
                      title: "Configuration saved", 
                      description: `${enabledSizes.size} sizes, ${enabledColors.size} colors selected` 
                    });
                  }}
                  data-testid="button-save-config"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Apply
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Library Picker Dialog - Backgrounds & Templates with filters */}
      <Dialog open={libraryPickerOpen} onOpenChange={setLibraryPickerOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">Library</DialogTitle>
            <DialogDescription>
              Select a background or template from your library
            </DialogDescription>
          </DialogHeader>
          
          {/* Tabs */}
          <Tabs value={libraryPickerTab} onValueChange={(v) => setLibraryPickerTab(v as "backgrounds" | "templates")} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="backgrounds" className="text-base h-10" data-testid="tab-library-backgrounds">
                <FolderOpen className="h-4 w-4 mr-2" />
                Backgrounds
              </TabsTrigger>
              <TabsTrigger value="templates" className="text-base h-10" data-testid="tab-library-templates">
                <ImageIcon className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
            </TabsList>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-2 py-3">
              <Select value={libraryFilterSeason} onValueChange={setLibraryFilterSeason}>
                <SelectTrigger className="w-36 h-10" data-testid="select-library-season">
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent>
                  {LIBRARY_SEASONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={libraryFilterEvent} onValueChange={setLibraryFilterEvent}>
                <SelectTrigger className="w-40 h-10" data-testid="select-library-event">
                  <SelectValue placeholder="Event" />
                </SelectTrigger>
                <SelectContent>
                  {LIBRARY_EVENTS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(libraryFilterSeason !== "all" || libraryFilterEvent !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setLibraryFilterSeason("all"); setLibraryFilterEvent("all"); }}
                  data-testid="button-clear-library-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
            
            {/* Backgrounds Tab Content */}
            <TabsContent value="backgrounds" className="flex-1 overflow-y-auto mt-0 min-h-0">
              {filteredBackgrounds.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg text-muted-foreground">No backgrounds found.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {libraryBackgrounds.length === 0 
                      ? "Upload backgrounds in the Library page first."
                      : "Try adjusting your filters."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
                  {filteredBackgrounds.map((bg) => (
                    <div
                      key={bg.id}
                      className="border-2 rounded-lg overflow-hidden cursor-pointer hover-elevate active-elevate-2 transition-transform"
                      onClick={() => {
                        setBackgroundImage(null);
                        setBackgroundPreview(bg.publicUrl);
                        setLibraryPickerOpen(false);
                        toast({ 
                          title: "Background Selected", 
                          description: `"${bg.name}" applied to your design.`,
                          duration: 3000,
                        });
                      }}
                      data-testid={`library-bg-${bg.id}`}
                    >
                      <div className="aspect-square relative">
                        <img
                          src={bg.publicUrl}
                          alt={bg.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-white text-sm font-medium truncate">{bg.name}</p>
                        </div>
                      </div>
                      <div className="p-2 flex flex-wrap gap-1 min-h-[36px]">
                        {bg.season && <Badge variant="secondary" className="text-xs">{bg.season}</Badge>}
                        {bg.event && <Badge variant="outline" className="text-xs">{bg.event}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            {/* Templates Tab Content */}
            <TabsContent value="templates" className="flex-1 overflow-y-auto mt-0 min-h-0">
              {libraryTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg text-muted-foreground">No templates saved yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create designs and save them to library using "Save to Library" option.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
                  {libraryTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="border-2 rounded-lg overflow-hidden cursor-pointer hover-elevate active-elevate-2 transition-transform"
                      onClick={() => {
                        // Load template DESIGN data into form fields
                        // Note: We don't force the product selection - user picks their own product
                        // Templates are about design content (text, fonts, background), not catalog items
                        
                        // Placements (if available, otherwise use default)
                        if (template.placements && template.placements.length > 0) {
                          const newConfigs: Record<string, 'full' | 'qr-only'> = {};
                          template.placements.forEach((p: string) => { newConfigs[p] = "full"; });
                          setPlacementConfigs(newConfigs);
                        }
                        
                        // Header text - always reset to template values or clear
                        if (template.topText?.text) {
                          setHeaderEnabled(true);
                          setHeaderText(template.topText.text);
                          setHeaderFontFamily(template.topText.fontFamily || "Arial");
                          setHeaderFontSize(template.topText.fontSize || "120");
                          setHeaderColor((template.topText as any).color || "#000000");
                          setHeaderLetterSpacing((template.topText as any).letterSpacing || 0);
                          setHeaderWarp((template.topText as any).warpPreset || "straight");
                          setHeaderStrokeColor((template.topText as any).strokeColor || "");
                          setHeaderStrokeWidth((template.topText as any).strokeWidth || 0);
                        } else {
                          setHeaderEnabled(false);
                          setHeaderText("");
                          setHeaderFontFamily("Arial");
                          setHeaderFontSize("120");
                          setHeaderColor("#000000");
                          setHeaderLetterSpacing(0);
                          setHeaderWarp("straight");
                          setHeaderStrokeColor("");
                          setHeaderStrokeWidth(0);
                        }
                        
                        // Footer text - always reset to template values or clear
                        if (template.bottomText?.text) {
                          setFooterEnabled(true);
                          setFooterText(template.bottomText.text);
                          setFooterFontFamily(template.bottomText.fontFamily || "Arial");
                          setFooterFontSize(template.bottomText.fontSize || "96");
                          setFooterColor((template.bottomText as any).color || "#000000");
                          setFooterLetterSpacing((template.bottomText as any).letterSpacing || 0);
                          setFooterWarp((template.bottomText as any).warpPreset || "straight");
                          setFooterStrokeColor((template.bottomText as any).strokeColor || "");
                          setFooterStrokeWidth((template.bottomText as any).strokeWidth || 0);
                        } else {
                          setFooterEnabled(false);
                          setFooterText("");
                          setFooterFontFamily("Arial");
                          setFooterFontSize("96");
                          setFooterColor("#000000");
                          setFooterLetterSpacing(0);
                          setFooterWarp("straight");
                          setFooterStrokeColor("");
                          setFooterStrokeWidth(0);
                        }
                        
                        // Background - always reset
                        setBackgroundImage(null);
                        if (template.backgroundImageUrl) {
                          setBackgroundPreview(template.backgroundImageUrl);
                        } else {
                          setBackgroundPreview("");
                        }
                        
                        // Landing overlay - fully reset to template values or clear
                        if (template.landingOverlay?.enabled) {
                          setLandingOverlayEnabled(true);
                          setLandingTitle(template.landingOverlay.title || "");
                          setLandingDescription(template.landingOverlay.description || "");
                          setLandingPosition((template.landingOverlay.position as "top" | "bottom") || "top");
                          setLandingFontFamily(template.landingOverlay.fontFamily || "Arial");
                          setLandingColor(template.landingOverlay.color || "#FFFFFF");
                        } else {
                          setLandingOverlayEnabled(false);
                          setLandingTitle("");
                          setLandingDescription("");
                          setLandingPosition("top");
                          setLandingFontFamily("Arial");
                          setLandingColor("#FFFFFF");
                        }
                        
                        // Store/segment (optional - only set if matching store found)
                        if (template.storeType) {
                          setStoreType(template.storeType as StoreType);
                        }
                        if (template.storeName) {
                          const matchingStore = partnerStoresData.find(s => s.name === template.storeName);
                          if (matchingStore) {
                            setSelectedStore(matchingStore.id);
                          }
                        }
                        if (template.segment) {
                          setSelectedSegment(template.segment);
                        }
                        
                        // Featured/Seasonal flags
                        setIsFeatured(template.isFeatured || false);
                        setIsSeasonalPromo(template.isSeasonalPromo || false);
                        
                        setLibraryPickerOpen(false);
                        toast({ 
                          title: "Template Loaded", 
                          description: `"${template.productName}" design loaded. Select a product and customize below.`,
                          duration: 4000,
                        });
                      }}
                      data-testid={`library-template-${template.id}`}
                    >
                      <div className="aspect-square relative bg-muted">
                        {template.printifyCompositeUrl ? (
                          <img
                            src={template.printifyCompositeUrl}
                            alt={template.productName}
                            className="w-full h-full object-contain"
                          />
                        ) : template.backgroundImageUrl ? (
                          <img
                            src={template.backgroundImageUrl}
                            alt={template.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : template.productImage ? (
                          <img
                            src={template.productImage}
                            alt={template.productName}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-12 w-12 opacity-30" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-white text-sm font-medium truncate">{template.productName}</p>
                        </div>
                      </div>
                      <div className="p-2">
                        <div className="flex flex-wrap gap-1 min-h-[28px]">
                          {template.topText?.text && (
                            <Badge variant="secondary" className="text-xs truncate max-w-full">
                              {template.topText.text.substring(0, 20)}{template.topText.text.length > 20 ? "..." : ""}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {template.storeName || "No store"} {template.segment ? `• ${template.segment}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="pt-2 border-t">
            <DialogClose asChild>
              <Button variant="outline" size="lg" data-testid="button-close-library-picker">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Wizard Store Confirmation Dialog */}
      <AlertDialog open={!!deleteWizardStoreId} onOpenChange={(open) => !open && setDeleteWizardStoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this store? This will remove the store and all its segments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-wizard-store">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteWizardStoreId) {
                  try {
                    await apiRequest("DELETE", `/api/admin/partner-stores/${deleteWizardStoreId}`);
                    await queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
                    setSelectedStore("");
                    setSelectedSegment("");
                    toast({ title: "Store Deleted", description: "Store removed successfully." });
                  } catch (error) {
                    toast({ title: "Error", description: "Failed to delete store.", variant: "destructive" });
                  }
                  setDeleteWizardStoreId(null);
                }
              }}
              data-testid="button-confirm-delete-wizard-store"
            >
              Delete Store
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Wizard Segment Confirmation Dialog */}
      <AlertDialog open={!!deleteWizardSegmentInfo} onOpenChange={(open) => !open && setDeleteWizardSegmentInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deleteWizardSegmentInfo?.segment}" segment from this store?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-wizard-segment">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteWizardSegmentInfo) {
                  try {
                    const storeData = partnerStoresData.find(s => s.id === deleteWizardSegmentInfo.storeId);
                    if (storeData) {
                      const updatedSegments = (storeData.availableSegments || []).filter(
                        s => s !== deleteWizardSegmentInfo.segment
                      );
                      await apiRequest("PATCH", `/api/admin/partner-stores/${deleteWizardSegmentInfo.storeId}`, {
                        availableSegments: updatedSegments
                      });
                      await queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
                      // Clear segment if it was selected
                      if (selectedSegment.includes(deleteWizardSegmentInfo.segment)) {
                        const updatedSelected = selectedSegment.split(",").filter(s => s !== deleteWizardSegmentInfo.segment).join(",");
                        setSelectedSegment(updatedSelected);
                      }
                      toast({ title: "Segment Deleted", description: "Segment removed from store." });
                    }
                  } catch (error) {
                    toast({ title: "Error", description: "Failed to delete segment.", variant: "destructive" });
                  }
                  setDeleteWizardSegmentInfo(null);
                }
              }}
              data-testid="button-confirm-delete-wizard-segment"
            >
              Delete Segment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ProductsContent() {
  const { toast } = useToast();
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [filterSegment, setFilterSegment] = useState<string>("");
  const [filterArea, setFilterArea] = useState<string>("");
  const [filterProductSource, setFilterProductSource] = useState<string>("");
  const [filterProductCategory, setFilterProductCategory] = useState<string>("");
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [deleteSegmentInfo, setDeleteSegmentInfo] = useState<{ storeId: string; segment: string } | null>(null);
  type PartnerStoreData = { id: string; name: string; availableSegments: string[] | null; isInternal?: boolean | null };
  const { data: partnerStoresData = [] } = useQuery<PartnerStoreData[]>({
    queryKey: ["/api/admin/partner-stores"],
  });
  
  const dbPartnerStores: StoreWithAreas[] = partnerStoresData.map(ps => ({
    name: ps.name,
    areas: ps.availableSegments || [],
  }));
  
  const allExternalStores = (() => {
    const combined = [...EXTERNAL_STORES, ...dbPartnerStores];
    const seen = new Set<string>();
    return combined.filter(s => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  })();
  
  type AdminProduct = Product & { 
    categoryIds?: string[]; 
    textUpcharge?: string;
    cachedMinCost?: number | null;
    cachedMaxCost?: number | null;
  };
  
  const { data: products = [], isLoading, refetch } = useQuery<AdminProduct[]>({
    queryKey: ["/api/admin/products"],
  });
  
  // Fetch global markup and upcharges from admin settings
  type AdminSettingsData = { 
    globalMarkupPercent?: string;
    globalQrProductionCost?: string;
    textAboveUpcharge?: string;
    textBelowUpcharge?: string;
  };
  const { data: adminSettings } = useQuery<AdminSettingsData>({
    queryKey: ["/api/admin/settings"],
  });
  const globalMarkup = parseFloat(adminSettings?.globalMarkupPercent || "25");
  const qrUpcharge = parseFloat(adminSettings?.globalQrProductionCost || "2");
  
  const selectedExternalStore = allExternalStores.find(s => s.name === filterSegment);
  const selectedInternalStore = INTERNAL_STORES.find(s => s.name === filterSegment);
  // Find the selected partner store from fresh data (for delete functionality)
  const selectedPartnerStore = partnerStoresData.find(s => s.name === filterSegment);
  const filterStoreAreas: string[] = 
    (selectedExternalStore && 'areas' in selectedExternalStore ? selectedExternalStore.areas : undefined) ||
    (selectedExternalStore && 'segments' in selectedExternalStore ? selectedExternalStore.segments : undefined) ||
    selectedInternalStore?.segments || 
    [];
  
  const filteredProducts = products.filter(product => {
    // Filter by store/area
    if (filterSegment) {
      const categoryParts = product.category.split("/");
      const productStore = categoryParts[0];
      const productArea = categoryParts[1] || null;
      if (productStore !== filterSegment) return false;
      if (filterArea && productArea !== filterArea) return false;
    }
    
    // Filter by product type when Library category is selected
    if (filterProductSource === "Library" && filterProductCategory) {
      const productName = product.name.toLowerCase();
      if (filterProductCategory === "T-Shirts") {
        return productName.includes('t-shirt') || productName.includes('tee') || productName.includes('tank');
      } else if (filterProductCategory === "Sweatshirts & Hoodies") {
        return productName.includes('hoodie') || productName.includes('sweatshirt') || productName.includes('crew') || productName.includes('pullover');
      } else if (filterProductCategory === "Hats & Caps") {
        return productName.includes('hat') || productName.includes('cap') || productName.includes('beanie') || productName.includes('visor');
      } else if (filterProductCategory === "Drinkware") {
        return productName.includes('mug') || productName.includes('tumbler') || productName.includes('bottle') || productName.includes('cup') || productName.includes('glass');
      } else if (filterProductCategory === "Bags") {
        return productName.includes('bag') || productName.includes('tote') || productName.includes('backpack') || productName.includes('pouch');
      }
    }
    
    return true;
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest("DELETE", `/api/admin/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Product Deleted", description: "Product removed from catalog." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete product.", variant: "destructive" });
    },
  });

  const deleteStoreMutation = useMutation({
    mutationFn: async (storeId: string) => {
      return apiRequest("DELETE", `/api/admin/partner-stores/${storeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      toast({ title: "Store Deleted", description: "Store removed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete store.", variant: "destructive" });
    },
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: async ({ storeId, segment }: { storeId: string; segment: string }) => {
      const store = partnerStoresData.find(s => s.id === storeId);
      if (!store) throw new Error("Store not found");
      const updatedSegments = (store.availableSegments || []).filter(s => s !== segment);
      return apiRequest("PUT", `/api/admin/partner-stores/${storeId}`, {
        availableSegments: updatedSegments
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      toast({ title: "Segment Deleted", description: "Segment removed from store." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete segment.", variant: "destructive" });
    },
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

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());

  // Auto-sync products in the background on page load
  useEffect(() => {
    if (products.length === 0 || isLoading || isSyncing) return;
    
    const syncStaleProducts = async () => {
      // Find products that haven't been synced recently (older than 24 hours) and haven't been synced this session
      const staleProducts = products.filter(p => {
        if (syncedIds.has(p.id)) return false;
        const lastSync = (p.metadata as any)?.lastSyncedAt;
        if (!lastSync) return true;
        const hoursSinceSync = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
        return hoursSinceSync > 24;
      });
      
      if (staleProducts.length === 0) return;
      
      setIsSyncing(true);
      const newSyncedIds = new Set(syncedIds);
      
      // Sync all stale products sequentially to avoid overwhelming the API
      for (const product of staleProducts) {
        try {
          await apiRequest("POST", `/api/admin/products/${product.id}/sync-printify`);
          newSyncedIds.add(product.id);
        } catch {
          // Mark as synced to avoid retrying failed products
          newSyncedIds.add(product.id);
        }
      }
      
      setSyncedIds(newSyncedIds);
      setIsSyncing(false);
      refetch();
    };
    
    syncStaleProducts();
  }, [products, isLoading, isSyncing, syncedIds]);

  return (
    <div className="space-y-6">
      <CatalogSyncSection />
      <AddFromPrintifyPanel 
        onSuccess={() => refetch()} 
        onFilterChange={(store, segment, source, category) => {
          setFilterSegment(store);
          setFilterArea(segment);
          setFilterProductSource(source || "");
          setFilterProductCategory(category || "");
        }}
      />

      <Card>
        <CardHeader className="space-y-3 px-3 sm:px-6">
          <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                Local Product Catalog
                {isSyncing && (
                  <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> syncing...
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Products stored in your database. Sizes and colors sync automatically from Printify.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-catalog">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <select
                className="p-2 border rounded-md bg-background text-sm"
                value={filterSegment}
                onChange={(e) => { setFilterSegment(e.target.value); setFilterArea(""); }}
                data-testid="filter-store-segment"
              >
                <option value="">All Stores</option>
                <optgroup label="Internal Stores">
                  {INTERNAL_STORES.map((store) => (
                    <option key={store.name} value={store.name}>{store.name}</option>
                  ))}
                </optgroup>
                <optgroup label="External Stores">
                  {allExternalStores.map((store) => (
                    <option key={store.name} value={store.name}>{store.name}</option>
                  ))}
                </optgroup>
              </select>
              {selectedPartnerStore && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteStoreId(selectedPartnerStore.id)}
                  title="Delete this store"
                  data-testid="button-delete-store"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {filterStoreAreas.length > 0 && (
              <div className="flex items-center gap-1">
                <select
                  className="p-2 border rounded-md bg-background text-sm"
                  value={filterArea}
                  onChange={(e) => setFilterArea(e.target.value)}
                  data-testid="filter-store-area"
                >
                  <option value="">All Segments</option>
                  {filterStoreAreas.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                {filterArea && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      if (selectedPartnerStore) {
                        // Store exists in database - use existing delete flow
                        setDeleteSegmentInfo({ storeId: selectedPartnerStore.id, segment: filterArea });
                      } else {
                        // Predefined store - need to create in database first, then delete segment
                        try {
                          const predefinedStore = EXTERNAL_STORES.find(s => s.name === filterSegment);
                          if (!predefinedStore) return;
                          
                          // Get all segments except the one being deleted
                          const remainingSegments = (predefinedStore.segments || []).filter(s => s !== filterArea);
                          
                          // Create store in database with remaining segments
                          const res = await fetch("/api/admin/partner-stores", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ 
                              name: predefinedStore.name, 
                              availableSegments: remainingSegments 
                            }),
                          });
                          
                          if (!res.ok) {
                            const errData = await res.json();
                            throw new Error(errData.error || "Failed to update store");
                          }
                          
                          await queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
                          await queryClient.refetchQueries({ queryKey: ["/api/admin/partner-stores"] });
                          setFilterArea("");
                          toast({ title: "Success", description: `Deleted segment "${filterArea}"` });
                        } catch (error: any) {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        }
                      }
                    }}
                    title="Delete this segment"
                    data-testid="button-delete-segment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            {(filterSegment || filterArea) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setFilterSegment(""); setFilterArea(""); }}
                data-testid="button-clear-filter"
              >
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
            <span className="text-sm text-muted-foreground self-center">
              {filteredProducts.length} of {products.length} products
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{products.length === 0 ? "No products yet." : "No products match this filter."}</p>
              <p className="text-sm">{products.length === 0 ? "Add products from the Printify catalog above." : "Try selecting a different store or area."}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="p-4 border-2 border-primary/40" data-testid={`card-product-${product.id}`}>
                  {/* Row 1: Image+Active | Name/Category | Price/Markup */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      {product.imageUrl && (
                        <img src={product.imageUrl} alt="" className="w-20 h-20 rounded object-cover" />
                      )}
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={product.isEnabled || false}
                          onCheckedChange={(enabled) => toggleMutation.mutate({ id: product.id, enabled })}
                          disabled={toggleMutation.isPending}
                          data-testid={`switch-enabled-${product.id}`}
                        />
                        <Label className="text-xs text-muted-foreground">Active</Label>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight">{product.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{product.category}</span>
                        {product.madeInUSA && <Badge variant="outline" className="text-[10px] px-1.5 py-0">USA</Badge>}
                      </div>
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Cost</div>
                          <div className="text-xs text-muted-foreground">
                            {product.cachedMinCost ? (
                              `$${product.cachedMinCost.toFixed(2)}`
                            ) : (
                              <span className="text-amber-500">No cost</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">+QR</div>
                          <div className="text-xs text-muted-foreground">${qrUpcharge.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">+{globalMarkup}%</div>
                          <div className="text-xs text-muted-foreground">markup</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Customer Price</div>
                          <div className="text-lg font-bold text-green-600">
                            {product.cachedMinCost ? (
                              `$${((product.cachedMinCost + qrUpcharge) * (1 + globalMarkup / 100)).toFixed(2)}`
                            ) : (
                              <span className="text-amber-500">--</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Row 2: Full width sizes/colors */}
                  <div className="mt-4 pt-4 border-t">
                    <ProductOptionsEditor product={product} onUpdate={() => refetch()} />
                  </div>
                  
                  {/* Row 3: Tags */}
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-xs font-medium mb-2 block">Tags</Label>
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
                  
                  {/* Row 4: Delete button - bottom right */}
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      onClick={() => setDeleteProductId(product.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Product Confirmation Dialog */}
      <AlertDialog open={!!deleteProductId} onOpenChange={(open) => !open && setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this product from your catalog? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteProductId) {
                  deleteMutation.mutate(deleteProductId);
                  setDeleteProductId(null);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Store Confirmation Dialog */}
      <AlertDialog open={!!deleteStoreId} onOpenChange={(open) => !open && setDeleteStoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this store? This will remove the store and all its segments. Products assigned to this store will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-store">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteStoreId) {
                  deleteStoreMutation.mutate(deleteStoreId);
                  setDeleteStoreId(null);
                  setFilterSegment("");
                  setFilterArea("");
                }
              }}
              data-testid="button-confirm-delete-store"
            >
              Delete Store
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Segment Confirmation Dialog */}
      <AlertDialog open={!!deleteSegmentInfo} onOpenChange={(open) => !open && setDeleteSegmentInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deleteSegmentInfo?.segment}" segment from this store?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-segment">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteSegmentInfo) {
                  deleteSegmentMutation.mutate(deleteSegmentInfo);
                  setDeleteSegmentInfo(null);
                  setFilterArea("");
                }
              }}
              data-testid="button-confirm-delete-segment"
            >
              Delete Segment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <div className="container max-w-6xl mx-auto px-2 sm:px-4 py-3">
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

      <main className="container max-w-6xl mx-auto py-6 px-2 sm:px-4">
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
