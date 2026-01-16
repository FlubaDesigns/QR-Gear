import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Image, Settings2, Loader2 } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";
import { ProductConfigSkin } from "@/features/shared/components/ProductConfigSkin";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface MockProductConfig {
  id: string;
  name: string;
  imageUrl: string;
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  enabledSizes: string[];
  enabledColors: string[];
  defaultColor: string;
  mockupsByColor: Record<string, { front?: string; lifestyle?: string }>;
}

function ProductConfigDemo() {
  const [savedChanges, setSavedChanges] = useState<Record<string, any>>({});
  
  const { data: mockProducts = [], isLoading } = useQuery<MockProductConfig[]>({
    queryKey: ["/api/test/product-configs"],
  });

  const handleSizesChange = (productId: string, enabledSizes: string[]) => {
    setSavedChanges(prev => ({
      ...prev,
      [productId]: { ...prev[productId], enabledSizes }
    }));
    console.log(`[Demo] Product ${productId} sizes changed:`, enabledSizes);
  };

  const handleColorsChange = (productId: string, enabledColors: string[]) => {
    setSavedChanges(prev => ({
      ...prev,
      [productId]: { ...prev[productId], enabledColors }
    }));
    console.log(`[Demo] Product ${productId} colors changed:`, enabledColors);
  };

  const handleDefaultColorChange = (productId: string, colorName: string) => {
    setSavedChanges(prev => ({
      ...prev,
      [productId]: { ...prev[productId], defaultColor: colorName }
    }));
    console.log(`[Demo] Product ${productId} default color changed to:`, colorName);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-product-configs">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SharedViewer
      mode="grid"
      className="w-full"
    >
      <div className="space-y-4" data-testid="product-config-list">
        {mockProducts.map((product) => (
          <ProductConfigSkin
            key={product.id}
            productId={product.id}
            productName={product.name}
            productImage={product.imageUrl}
            sizes={product.sizes}
            colors={product.colors}
            enabledSizes={savedChanges[product.id]?.enabledSizes || product.enabledSizes}
            enabledColors={savedChanges[product.id]?.enabledColors || product.enabledColors}
            defaultColor={savedChanges[product.id]?.defaultColor || product.defaultColor}
            mockupsByColor={product.mockupsByColor}
            onSizesChange={(sizes) => handleSizesChange(product.id, sizes)}
            onColorsChange={(colors) => handleColorsChange(product.id, colors)}
            onDefaultColorChange={(color) => handleDefaultColorChange(product.id, color)}
          />
        ))}
        
        {mockProducts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-products">
            No mock products available. Check the /api/test/product-configs endpoint.
          </p>
        )}
      </div>
    </SharedViewer>
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
            </p>
            <Link href="/test-library">
              <Button variant="outline" size="sm" data-testid="link-test-library">
                <Image className="h-4 w-4 mr-2" />
                Go to Library
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-demo-title">
              <Settings2 className="h-5 w-5" />
              ProductConfigSkin Demo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This demonstrates the ProductConfigSkin component with mock data. 
              Toggle sizes and colors, pick default display images.
            </p>
            <ProductConfigDemo />
          </CardContent>
        </Card>

        <ProductsHarness />
      </div>
    </AdminAuthProvider>
  );
}
