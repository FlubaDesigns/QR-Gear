import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Image, Settings2, Loader2, RefreshCw } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";
import { ProductConfigSkin } from "@/features/shared/components/ProductConfigSkin";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ProductConfig {
  id: string;
  name: string;
  imageUrl: string;
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  enabledSizes: string[];
  enabledColors: string[];
  defaultColor: string | null;
  mockupsByColor: Record<string, { front?: string; lifestyle?: string }>;
  blueprintId?: number;
  printProviderId?: number;
  cachedMinCost?: number | null;
  cachedMaxCost?: number | null;
}

function ProductConfigDemo() {
  const queryClient = useQueryClient();
  
  const { data: products = [], isLoading, refetch } = useQuery<ProductConfig[]>({
    queryKey: ["/api/test/product-configs"],
  });

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/test/product-configs"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-product-configs">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="glass-body">
          {products.length} products loaded from database
        </p>
        <button
          onClick={() => refetch()}
          className="qr-btn qr-btn--outline qr-btn--touch"
          data-testid="button-refresh-products"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Refresh
        </button>
      </div>
      
      <SharedViewer mode="grid" className="w-full">
        <div className="space-y-4" data-testid="product-config-list">
          {products.map((product) => (
            <ProductConfigSkin
              key={product.id}
              productId={product.id}
              productName={product.name}
              productImage={product.imageUrl}
              sizes={product.sizes}
              colors={product.colors}
              enabledSizes={product.enabledSizes}
              enabledColors={product.enabledColors}
              defaultColor={product.defaultColor || undefined}
              mockupsByColor={product.mockupsByColor}
              blueprintId={product.blueprintId}
              printProviderId={product.printProviderId}
              apiBase="/api/test"
              onUpdate={handleUpdate}
            />
          ))}
          
          {products.length === 0 && (
            <div className="text-center py-8 glass-button rounded-lg">
              <p className="glass-body" data-testid="text-no-products">
                No products found. Add products via the admin panel first.
              </p>
            </div>
          )}
        </div>
      </SharedViewer>
    </div>
  );
}

export default function TestProductsPage() {
  return (
    <AdminAuthProvider apiBase="/api/test">
      <div className="page-wrap">
        <div className="container py-8 space-y-8">
          {/* Header Card */}
          <div className="glass-card">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="glass-icon">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="glass-title text-xl mb-2" data-testid="text-page-title">
                  Test Products (No Auth Required)
                </h1>
                <p className="glass-body mb-4">
                  This is a public test version of the products page for debugging. 
                  Uses /api/test endpoints. All changes are saved to the real database.
                </p>
                <Link href="/test-library">
                  <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-test-library">
                    <Image className="h-5 w-5 mr-2" />
                    Go to Library
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Products Harness */}
          <ProductsHarness />

          {/* Product Configuration */}
          <div className="glass-card">
            <div className="flex items-center gap-4 mb-6">
              <div className="glass-icon">
                <Settings2 className="h-6 w-6" />
              </div>
              <h2 className="glass-title text-xl" data-testid="text-demo-title">
                Product Configuration
              </h2>
            </div>
            <p className="glass-body mb-6">
              Configure product sizes, colors, and mockups. All features from admin are available here.
            </p>
            <ProductConfigDemo />
          </div>
        </div>
      </div>
    </AdminAuthProvider>
  );
}
