import { Link } from "wouter";
import { DollarSign, Image, Layers, Package, QrCode, Store, Settings2, Loader2, RefreshCw, LayoutGrid } from "lucide-react";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";
import { ProductConfigSkin } from "@/features/shared/components/ProductConfigSkin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminShell from "@/components/AdminShell";
import type { Product } from "@shared/schema";

/**
 * Store Planner — Admin hub for store and product management.
 *
 * Provides quick-links to Store Builder, Pricing Settings, Graphics Library,
 * and Templates Library. Also shows a live list of all active product
 * configurations (sizes, colors, mockups) so the admin can review and
 * adjust variant settings from a single place.
 *
 * Data source: GET /api/admin/product-configs
 * Filters: isEnabled products only
 * Enrichment: provider colors/sizes merged with stored metadata overrides
 */

/**
 * ProductConfig is a computed API view of the `products` schema row.
 * Base fields are picked directly from the Product schema type.
 * Extra fields are provider-enriched or computed at query time.
 */
type ProductConfig =
  Pick<Product, "id" | "name" | "imageUrl" | "blueprintId" | "printProviderId" | "defaultColor"> & {
    sizes: string[];
    colors: Array<{ name: string; hex: string }>;
    enabledSizes: string[];
    enabledColors: string[];
    categoryIds: string[];
    mockupsByColor: Record<string, { front?: string; lifestyle?: string }>;
    cachedMinCost: number | null;
    cachedMaxCost: number | null;
  };

function ProductConfigList() {
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, refetch } = useQuery<ProductConfig[]>({
    queryKey: ["/api/admin/product-configs"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-product-configs">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""} loaded
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-products"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-4" data-testid="product-config-list">
        {products.map((product) => (
          <ProductConfigSkin
            key={product.id}
            productId={product.id}
            productName={product.name}
            productImage={product.imageUrl ?? ""}
            sizes={product.sizes}
            colors={product.colors}
            enabledSizes={product.enabledSizes}
            enabledColors={product.enabledColors}
            defaultColor={product.defaultColor ?? undefined}
            mockupsByColor={product.mockupsByColor}
            blueprintId={product.blueprintId ?? undefined}
            printProviderId={product.printProviderId ?? undefined}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/product-configs"] })}
          />
        ))}

        {products.length === 0 && (
          <div className="text-center py-8 rounded-md border bg-muted/50">
            <p className="text-sm text-muted-foreground" data-testid="text-no-products">
              No products found. Add products via the admin panel first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StorePlanner() {
  return (
    <AdminShell
      title="Store Planner"
      subtitle="Product configs and store management hub"
      icon={LayoutGrid}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" data-testid="text-store-tools-title">
              <Package className="h-4 w-4" />
              Store Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Link href="/admin/store-builder" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="link-store-builder">
                  <Store className="h-4 w-4" />
                  Store Builder
                </Button>
              </Link>
              <Link href="/admin/pricing" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="link-pricing">
                  <DollarSign className="h-4 w-4" />
                  Pricing Settings
                </Button>
              </Link>
              <Link href="/admin/library?tab=graphics" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="link-graphics-library">
                  <QrCode className="h-4 w-4" />
                  Graphics Library
                </Button>
              </Link>
              <Link href="/admin/library?tab=templates" className="block">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="link-templates-library">
                  <Layers className="h-4 w-4" />
                  Templates Library
                </Button>
              </Link>
              <Link href="/admin/library" className="block sm:col-span-2">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="link-full-library">
                  <Image className="h-4 w-4" />
                  Full Library
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" data-testid="text-product-config-title">
              <Settings2 className="h-4 w-4" />
              Product Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductConfigList />
          </CardContent>
        </Card>

        <ProductsHarness showBuilder />
      </div>
    </AdminShell>
  );
}
