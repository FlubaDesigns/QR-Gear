import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} products loaded from database
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
            <div className="text-center py-8 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground" data-testid="text-no-products">
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
      <div className="container mx-auto py-6 space-y-6">
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-600" data-testid="text-page-title">
              <AlertTriangle className="h-5 w-5" />
              Test Products (No Auth Required)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This is a public test version of the products page for debugging. 
              Uses /api/test endpoints instead of /api/admin endpoints.
              All changes are saved to the real database.
            </p>
            <Link href="/test-library">
              <Button variant="outline" size="sm" data-testid="link-test-library">
                <Image className="h-4 w-4 mr-2" />
                Go to Library
              </Button>
            </Link>
          </CardContent>
        </Card>

        <ProductsHarness />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-demo-title">
              <Settings2 className="h-5 w-5" />
              Product Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure product sizes, colors, and mockups. All features from admin are available here.
            </p>
            <ProductConfigDemo />
          </CardContent>
        </Card>
      </div>
    </AdminAuthProvider>
  );
}
