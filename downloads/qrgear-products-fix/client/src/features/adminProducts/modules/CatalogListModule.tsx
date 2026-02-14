import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Filter, Flag, Globe } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { SkinGridViewer } from "@/features/shared/components/SkinGridViewer";
import { ProductCardSkin, ProductDetailSkin } from "@/features/shared/components/skins/ProductCatalogSkin";
import type { Product } from "../shared/types";
import type { SkinItem } from "@/features/shared/components/skins/types";

type LocationFilter = "all" | "usa" | "other";
type EnabledFilter = "all" | "enabled" | "disabled";

interface CatalogListModuleProps {
  products: Product[];
}

function productToSkinItem(product: Product): SkinItem {
  const metadata = (product.metadata || {}) as Record<string, any>;
  const raw = product as Record<string, any>;
  const baseCost = typeof metadata.cachedMinCost === "number" ? metadata.cachedMinCost / 100 : 0;
  const qrUpcharge = typeof metadata.qrUpcharge === "number" ? metadata.qrUpcharge : 0.99;
  const markupPercent = typeof metadata.markupPercent === "number" ? metadata.markupPercent : 40;

  const calculatedPrice = baseCost > 0
    ? ((baseCost + qrUpcharge) * (1 + markupPercent / 100))
    : null;
  const customerPrice = product.customerPrice ? parseFloat(product.customerPrice) : null;
  const displayPrice = customerPrice ?? calculatedPrice;

  const imageUrl = product.imageUrl || (metadata.image as string) || "";

  const colors = Array.isArray(raw.availableColors) ? raw.availableColors : [];
  const sizes = Array.isArray(raw.availableSizes) ? raw.availableSizes : [];

  return {
    id: product.id,
    name: product.name,
    primaryImage: imageUrl || null,
    price: displayPrice,
    colorCount: colors.length,
    sizeCount: sizes.length,
    metadata: {
      ...metadata,
      isEnabled: product.isEnabled,
      cachedMinCost: metadata.cachedMinCost,
      qrUpcharge: metadata.qrUpcharge,
      markupPercent: metadata.markupPercent,
      availableColors: colors,
      availableSizes: sizes,
    },
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

  const skinItems: SkinItem[] = useMemo(() => {
    return filtered.map(productToSkinItem);
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

        <SkinGridViewer
          items={skinItems}
          CardSkin={ProductCardSkin}
          DetailSkin={ProductDetailSkin}
          actions={{}}
          gridColumns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
        />
      </div>
    </CollapsibleModule>
  );
}

export default CatalogListModule;
