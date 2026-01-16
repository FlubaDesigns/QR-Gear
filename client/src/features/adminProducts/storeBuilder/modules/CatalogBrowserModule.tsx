import { Badge } from "@/components/ui/badge";
import { Package, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { useStoreBuilderContext } from "../StoreBuilderContext";

const MOCK_BLANK_PRODUCTS = [
  { id: "blank-1", name: "Unisex Heavy Cotton Tee", category: "T-Shirts", colors: 16, sizes: 6 },
  { id: "blank-2", name: "Classic Dad Hat", category: "Hats", colors: 12, sizes: 1 },
  { id: "blank-3", name: "Ceramic Mug 11oz", category: "Drinkware", colors: 2, sizes: 1 },
  { id: "blank-4", name: "Canvas Tote Bag", category: "Bags", colors: 8, sizes: 1 },
];

export function CatalogBrowserModule() {
  const { step, currentChannel, selectedBaseProduct, setSelectedBaseProduct, setStep } = useStoreBuilderContext();
  const [expanded, setExpanded] = useState(step === "catalog");
  const [search, setSearch] = useState("");

  if (!currentChannel) return null;
  if (step !== "catalog" && !selectedBaseProduct) return null;

  const filteredProducts = MOCK_BLANK_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectProduct = (product: typeof MOCK_BLANK_PRODUCTS[0]) => {
    setSelectedBaseProduct(product);
    setStep("configure");
  };

  return (
    <div className="border rounded-lg p-3" data-testid="module-catalog-browser">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left font-medium"
        data-testid="toggle-catalog-browser"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Package className="h-4 w-4" />
        <span className="flex-1">Browse Blank Products</span>
        {selectedBaseProduct && (
          <Badge variant="secondary">{selectedBaseProduct.name}</Badge>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              inputMode="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg border bg-background"
              data-testid="input-catalog-search"
            />
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelectProduct(product)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedBaseProduct?.id === product.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
                data-testid={`button-product-${product.id}`}
              >
                <div className="font-medium">{product.name}</div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{product.category}</Badge>
                  <Badge variant="secondary" className="text-xs">{product.colors} colors</Badge>
                  <Badge variant="secondary" className="text-xs">{product.sizes} sizes</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
