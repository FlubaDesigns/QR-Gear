import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Filter, Flag, Globe } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { ProductSelectCardSkin, type ProductSelectItem } from "@/features/shared/components/skins/ProductSelectCardSkin";
import type { ScrollViewItem } from "@/features/shared/components/views/index";
import type { Product } from "../shared/types";

type LocationFilter = "all" | "usa" | "other";
type EnabledFilter = "all" | "enabled" | "disabled";

interface CatalogListModuleProps {
  products: Product[];
}

function productToScrollItem(product: Product): ScrollViewItem {
  const metadata = (product.metadata || {}) as Record<string, any>;
  const raw = product as Record<string, any>;
  const baseCost = typeof metadata.cachedMinCost === "number" ? metadata.cachedMinCost / 100 : 0;
  const qrUpcharge = typeof metadata.qrUpcharge === "number" ? metadata.qrUpcharge : 0.99;
  const markupPercent = typeof metadata.markupPercent === "number" ? metadata.markupPercent : 25;

  const calculatedPrice = baseCost > 0
    ? ((baseCost + qrUpcharge) * (1 + markupPercent / 100))
    : null;
  const customerPrice = product.customerPrice ? parseFloat(product.customerPrice) : null;
  const displayPrice = customerPrice ?? calculatedPrice;

  const imageUrl = product.imageUrl || (metadata.image as string) || "";
  const colors = Array.isArray(raw.availableColors) ? raw.availableColors : [];
  const sizes = Array.isArray(raw.availableSizes) ? raw.availableSizes : [];
  const madeInUSA = metadata.originCountry === "US" || metadata.originCountry === "USA" || metadata.madeInUSA === true;

  return {
    id: product.id,
    imageUrl: imageUrl || "",
    title: product.name,
    minPrice: displayPrice ? displayPrice.toFixed(2) : null,
    colorCount: colors.length,
    madeInUSA,
    sizes,
    metadata: {
      ...metadata,
      isEnabled: product.isEnabled,
      baseCost,
      qrUpcharge,
      markupPercent,
      availableColors: colors,
      availableSizes: sizes,
      description: (raw as any).description || "",
      manufacturer: metadata.manufacturer || null,
    },
  };
}

function scrollItemToSelectItem(item: ScrollViewItem): ProductSelectItem {
  const meta = (item.metadata || {}) as Record<string, any>;
  const colors = Array.isArray(meta.availableColors) ? meta.availableColors : [];
  const sizes = Array.isArray(meta.availableSizes) ? meta.availableSizes : [];

  return {
    id: String(item.id),
    name: item.title,
    price: item.minPrice ? parseFloat(item.minPrice) : null,
    cost: typeof meta.baseCost === "number" && meta.baseCost > 0 ? meta.baseCost : null,
    manufacturer: meta.manufacturer || null,
    madeInUSA: item.madeInUSA || false,
    primaryImageUrl: item.imageUrl || null,
    description: meta.description || null,
    colorsAvailable: colors.map((c: any) => ({ name: c.name || c, hex: c.hex || c.color })),
    sizesAvailable: sizes,
    defaultColor: colors[0]?.name || null,
  };
}

export function CatalogListModule({ products }: CatalogListModuleProps) {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");

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

  const scrollItems: ScrollViewItem[] = useMemo(() => {
    return filtered.map(productToScrollItem);
  }, [filtered]);

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

        <SharedViewer
          mode="scroll"
          scrollProps={{
            items: scrollItems,
            layout: "vertical",
            renderItem: (scrollItem, _isSelected, onSelect) => {
              const selectItem = scrollItemToSelectItem(scrollItem);
              return (
                <ProductSelectCardSkin
                  item={selectItem}
                  isSelected={false}
                  onSelect={() => onSelect()}
                />
              );
            },
          }}
        />
      </div>
    </CollapsibleModule>
  );
}

export default CatalogListModule;
