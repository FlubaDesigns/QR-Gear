import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Filter, Flag, Globe } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import {
  ProductSelectCardSkin,
  type ProductSelectItem,
} from "@/features/shared/components/skins/ProductSelectCardSkin";
import { ProductsControlBar } from "./ProductsControlBar";
import type { Product } from "../shared/types";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

type LocationFilter = "all" | "usa" | "other";
type EnabledFilter = "all" | "enabled" | "disabled";

interface ProductChooserModuleProps {
  products: Product[];
  onProductSelected?: (productId: string, product: ProductSelectItem) => void;
  showControlBar?: boolean;
}

function productToSelectItem(product: Product): ProductSelectItem {
  const metadata = (product.metadata || {}) as Record<string, any>;
  const raw = product as Record<string, any>;

  const baseCost =
    typeof metadata.cachedMinCost === "number"
      ? metadata.cachedMinCost / 100
      : 0;
  const qrUpcharge =
    typeof metadata.qrUpcharge === "number" ? metadata.qrUpcharge : 0.99;
  const markupPercent =
    typeof metadata.markupPercent === "number" ? metadata.markupPercent : 40;

  const calculatedPrice =
    baseCost > 0 ? (baseCost + qrUpcharge) * (1 + markupPercent / 100) : null;
  const customerPrice = product.customerPrice
    ? parseFloat(product.customerPrice)
    : null;
  const displayPrice = customerPrice ?? calculatedPrice;

  const imageUrl = product.imageUrl || (metadata.image as string) || "";

  const colors: Array<{ name: string; hex?: string }> = Array.isArray(
    raw.availableColors
  )
    ? raw.availableColors
    : [];
  const sizes: string[] = Array.isArray(raw.availableSizes)
    ? raw.availableSizes
    : [];

  const madeInUSA =
    metadata.originCountry === "US" ||
    metadata.originCountry === "USA" ||
    metadata.madeInUSA === true;

  const manufacturer =
    (metadata.brand as string) ||
    (metadata.manufacturer as string) ||
    (raw.brand as string) ||
    null;

  return {
    id: product.id,
    name: product.name,
    price: displayPrice,
    cost: baseCost > 0 ? baseCost : null,
    manufacturer,
    madeInUSA,
    primaryImageUrl: imageUrl || null,
    description: product.description || (metadata.description as string) || null,
    colorsAvailable: colors,
    sizesAvailable: sizes,
    defaultColor: colors.length > 0 ? colors[0].name : null,
  };
}

function selectItemToScrollViewItem(item: ProductSelectItem): ScrollViewItem {
  return {
    id: item.id,
    imageUrl: item.primaryImageUrl || "",
    title: item.name,
    subtitle: item.manufacturer || undefined,
    minPrice: item.price != null ? item.price.toFixed(2) : null,
    madeInUSA: item.madeInUSA,
    sizes: item.sizesAvailable,
    description: item.description || undefined,
    colorCount: item.colorsAvailable.length,
  };
}

export function ProductChooserModule({
  products,
  onProductSelected,
  showControlBar = true,
}: ProductChooserModuleProps) {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...products];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (locationFilter !== "all") {
      list = list.filter((p) => {
        const meta = (p.metadata || {}) as Record<string, unknown>;
        const usa =
          meta.originCountry === "US" ||
          meta.originCountry === "USA" ||
          meta.madeInUSA === true;
        return locationFilter === "usa" ? usa : !usa;
      });
    }

    if (enabledFilter !== "all") {
      list = list.filter((p) =>
        enabledFilter === "enabled"
          ? p.isEnabled !== false
          : p.isEnabled === false
      );
    }

    return list;
  }, [products, search, locationFilter, enabledFilter]);

  const selectItems = useMemo(
    () => filtered.map(productToSelectItem),
    [filtered]
  );

  const selectItemMap = useMemo(() => {
    const map = new Map<string, ProductSelectItem>();
    selectItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [selectItems]);

  const scrollViewItems = useMemo(
    () => selectItems.map(selectItemToScrollViewItem),
    [selectItems]
  );

  const handleSelect = useCallback(
    (id: string, item: ProductSelectItem) => {
      setSelectedId(id);
      onProductSelected?.(id, item);
    },
    [onProductSelected]
  );

  const enabledCount = products.filter((p) => p.isEnabled !== false).length;
  const disabledCount = products.length - enabledCount;

  const renderCard = useCallback(
    (scrollItem: ScrollViewItem, _isSelected: boolean, _onSelect: () => void) => {
      const selectItem = selectItemMap.get(String(scrollItem.id));
      if (!selectItem) return null;
      return (
        <ProductSelectCardSkin
          item={selectItem}
          isSelected={selectedId === selectItem.id}
          onSelect={handleSelect}
        />
      );
    },
    [selectItemMap, selectedId, handleSelect]
  );

  return (
    <CollapsibleModule
      title={`Products (${filtered.length})`}
      icon={<Package className="h-4 w-4" />}
      defaultOpen
    >
      <div className="space-y-3">
        {showControlBar && <ProductsControlBar />}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-chooser"
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
            items: scrollViewItems,
            selectedId: selectedId,
            layout: "vertical",
            gridHeight: "calc(100vh - 240px)",
            emptyMessage: "No products match your filters",
            renderItem: renderCard,
          }}
        />
      </div>
    </CollapsibleModule>
  );
}

export default ProductChooserModule;
