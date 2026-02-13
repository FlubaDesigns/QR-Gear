import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Search, Filter, Trash2, Tag, X, ZoomIn,
  LayoutGrid, List, Flag, Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { PriceBreakdownSkin } from "@/features/shared/components/skins/PriceBreakdownSkin";
import { useProductsContext } from "../ProductsContext";
import type { Product } from "../shared/types";
import { queryClient } from "@/lib/queryClient";

type ViewMode = "grid" | "list";
type LocationFilter = "all" | "usa" | "other";
type EnabledFilter = "all" | "enabled" | "disabled";

interface CatalogListModuleProps {
  products: Product[];
}

function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
      data-testid="modal-image-zoom"
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <Button
          size="icon"
          variant="ghost"
          className="absolute -top-10 right-0 text-white"
          onClick={onClose}
          data-testid="button-close-zoom"
        >
          <X className="h-5 w-5" />
        </Button>
        <img src={src} alt={alt} className="max-w-full max-h-[85vh] object-contain rounded-md" />
      </div>
    </div>
  );
}

function CategoryTagEditor({ productId, apiBase }: { productId: string; apiBase: string }) {
  const { toast } = useToast();
  const { api } = useProductsContext();
  const [isOpen, setIsOpen] = useState(false);

  const { data: categories = [] } = useQuery<{ id: number; name: string; slug: string; taxonomyType: string }[]>({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${apiBase}/admin/product-categories`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 300000,
  });

  const { data: assignments = [] } = useQuery<{ categoryId: number }[]>({
    queryKey: ["product-category-assignments", productId],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${apiBase}/admin/products/${productId}/categories`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isOpen,
  });

  const assignedIds = new Set(assignments.map((a) => a.categoryId));

  const saveMutation = useMutation({
    mutationFn: async (categoryIds: number[]) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${apiBase}/admin/products/${productId}/categories`, {
        method: "POST",
        headers: { ...Object.fromEntries(new Headers(headers).entries()), "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds }),
      });
      if (!res.ok) throw new Error("Failed to save categories");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-category-assignments", productId] });
      toast({ title: "Categories updated" });
    },
  });

  const toggleCategory = (catId: number) => {
    const current = Array.from(assignedIds);
    const next = assignedIds.has(catId)
      ? current.filter((id) => id !== catId)
      : [...current, catId];
    saveMutation.mutate(next);
  };

  if (!isOpen) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        data-testid={`button-tags-${productId}`}
      >
        <Tag className="h-3 w-3 mr-1" />
        Tags
      </Button>
    );
  }

  const grouped = categories.reduce<Record<string, typeof categories>>((acc, cat) => {
    const type = cat.taxonomyType || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(cat);
    return acc;
  }, {});

  return (
    <div className="mt-2 p-2 border rounded-md bg-muted/30 space-y-2" data-testid={`tag-editor-${productId}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">Categories</span>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      {Object.entries(grouped).map(([type, cats]) => (
        <div key={type}>
          <span className="text-[10px] uppercase text-muted-foreground">{type}</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {cats.map((cat) => (
              <Badge
                key={cat.id}
                variant={assignedIds.has(cat.id) ? "default" : "outline"}
                className="cursor-pointer text-[10px]"
                onClick={() => toggleCategory(cat.id)}
                data-testid={`tag-${cat.slug}-${productId}`}
              >
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductRow({
  product,
  apiBase,
  viewMode,
  onZoom,
}: {
  product: Product;
  apiBase: string;
  viewMode: ViewMode;
  onZoom: (src: string, alt: string) => void;
}) {
  const { api } = useProductsContext();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const metadata = (product.metadata || {}) as Record<string, unknown>;
  const madeInUSA = metadata.originCountry === "US" || metadata.originCountry === "USA" || metadata.madeInUSA === true;
  const baseCost = typeof metadata.cachedMinCost === "number" ? metadata.cachedMinCost / 100 : 0;
  const qrUpcharge = typeof metadata.qrUpcharge === "number" ? metadata.qrUpcharge : 0.99;
  const markupPercent = typeof metadata.markupPercent === "number" ? metadata.markupPercent : 40;

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${apiBase}/admin/products/${product.id}/toggle`, {
        method: "PATCH",
        headers: { ...Object.fromEntries(new Headers(headers).entries()), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      return res.json();
    },
    onSuccess: () => {
      api.invalidateProducts();
      toast({ title: product.isEnabled ? "Product disabled" : "Product enabled" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${apiBase}/admin/products/${product.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      api.invalidateProducts();
      toast({ title: "Product deleted" });
    },
  });

  const imageUrl = product.imageUrl || (metadata.image as string) || "";

  if (viewMode === "grid") {
    return (
      <Card
        className={`overflow-visible transition-all ${!product.isEnabled ? "opacity-50" : ""}`}
        data-testid={`catalog-card-${product.id}`}
      >
        <div className="relative aspect-square bg-muted rounded-t-md overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-contain cursor-pointer"
              onClick={() => onZoom(imageUrl, product.name)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          {imageUrl && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1 right-1 bg-black/30 text-white"
              onClick={() => onZoom(imageUrl, product.name)}
              data-testid={`button-zoom-${product.id}`}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          )}
          {madeInUSA && (
            <Badge variant="outline" className="absolute top-1 left-1 text-[10px] bg-background/80">
              <Flag className="w-3 h-3 mr-0.5" /> USA
            </Badge>
          )}
        </div>
        <CardContent className="p-3 space-y-2">
          <h3 className="font-medium text-sm line-clamp-2" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          <PriceBreakdownSkin
            data={{
              baseCost,
              qrUpcharge,
              markupPercent,
              customerPrice: product.customerPrice ? parseFloat(product.customerPrice) : null,
            }}
            compact
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch
                checked={product.isEnabled ?? true}
                onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                data-testid={`switch-enable-${product.id}`}
              />
              <span className="text-xs text-muted-foreground">
                {product.isEnabled ? "On" : "Off"}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-expand-${product.id}`}
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete "${product.name}"?`)) deleteMutation.mutate();
                }}
                data-testid={`button-delete-${product.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {expanded && (
            <CategoryTagEditor productId={product.id} apiBase={apiBase} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`overflow-visible transition-all ${!product.isEnabled ? "opacity-50" : ""}`}
      data-testid={`catalog-row-${product.id}`}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          <div
            className="w-16 h-16 flex-shrink-0 bg-muted rounded-md overflow-hidden cursor-pointer relative"
            onClick={() => imageUrl && onZoom(imageUrl, product.name)}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm line-clamp-1" data-testid={`text-product-name-${product.id}`}>
                {product.name}
              </h3>
              <div className="flex items-center gap-1 flex-shrink-0">
                {madeInUSA && (
                  <Badge variant="outline" className="text-[10px]">
                    <Flag className="w-3 h-3 mr-0.5" /> USA
                  </Badge>
                )}
                <Switch
                  checked={product.isEnabled ?? true}
                  onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                  data-testid={`switch-enable-${product.id}`}
                />
              </div>
            </div>
            <PriceBreakdownSkin
              data={{
                baseCost,
                qrUpcharge,
                markupPercent,
                customerPrice: product.customerPrice ? parseFloat(product.customerPrice) : null,
              }}
              compact
            />
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-expand-${product.id}`}
              >
                <Tag className="h-3 w-3 mr-1" />
                Tags
                {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete "${product.name}"?`)) deleteMutation.mutate();
                }}
                data-testid={`button-delete-${product.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        {expanded && (
          <CategoryTagEditor productId={product.id} apiBase={apiBase} />
        )}
      </CardContent>
    </Card>
  );
}

export function CatalogListModule({ products }: CatalogListModuleProps) {
  const { api } = useProductsContext();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

  const apiBase = api.baseUrl;

  const filtered = useMemo(() => {
    let list = [...products];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (locationFilter !== "all") {
      list = list.filter((p) => {
        const meta = (p.metadata || {}) as Record<string, unknown>;
        const usa = meta.originCountry === "US" || meta.originCountry === "USA" || meta.madeInUSA === true;
        return locationFilter === "usa" ? usa : !usa;
      });
    }

    if (enabledFilter !== "all") {
      list = list.filter((p) =>
        enabledFilter === "enabled" ? p.isEnabled !== false : p.isEnabled === false
      );
    }

    return list;
  }, [products, search, locationFilter, enabledFilter]);

  const enabledCount = products.filter((p) => p.isEnabled !== false).length;
  const disabledCount = products.length - enabledCount;

  return (
    <CollapsibleModule
      title={`Catalog (${filtered.length})`}
      icon={<Package className="h-4 w-4" />}
      defaultOpen
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-catalog"
            />
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant={viewMode === "grid" ? "default" : "ghost"}
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <Badge
            variant={locationFilter === "all" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setLocationFilter("all")}
            data-testid="filter-location-all"
          >
            <Globe className="w-3 h-3 mr-1" /> All
          </Badge>
          <Badge
            variant={locationFilter === "usa" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setLocationFilter("usa")}
            data-testid="filter-location-usa"
          >
            <Flag className="w-3 h-3 mr-1" /> USA
          </Badge>
          <Badge
            variant={locationFilter === "other" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setLocationFilter("other")}
            data-testid="filter-location-other"
          >
            Other
          </Badge>
          <span className="text-muted-foreground">|</span>
          <Badge
            variant={enabledFilter === "all" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setEnabledFilter("all")}
            data-testid="filter-enabled-all"
          >
            All ({products.length})
          </Badge>
          <Badge
            variant={enabledFilter === "enabled" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setEnabledFilter("enabled")}
            data-testid="filter-enabled-on"
          >
            Enabled ({enabledCount})
          </Badge>
          <Badge
            variant={enabledFilter === "disabled" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setEnabledFilter("disabled")}
            data-testid="filter-enabled-off"
          >
            Disabled ({disabledCount})
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md bg-muted/50" data-testid="empty-catalog">
            No products match your filters
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="catalog-grid">
            {filtered.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                apiBase={apiBase}
                viewMode="grid"
                onZoom={(src, alt) => setZoomImage({ src, alt })}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2" data-testid="catalog-list">
            {filtered.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                apiBase={apiBase}
                viewMode="list"
                onZoom={(src, alt) => setZoomImage({ src, alt })}
              />
            ))}
          </div>
        )}
      </div>

      {zoomImage && (
        <ImageZoomModal
          src={zoomImage.src}
          alt={zoomImage.alt}
          onClose={() => setZoomImage(null)}
        />
      )}
    </CollapsibleModule>
  );
}

export default CatalogListModule;
