import { Link } from "wouter";
import { DollarSign, Image, Layers, Package, QrCode, Store, Settings2, Loader2, RefreshCw } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";
import { ProductConfigSkin } from "@/features/shared/components/ProductConfigSkin";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

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
    queryKey: ["/api/admin/product-configs"],
  });

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/product-configs"] });
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {products.length} products loaded
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
              apiBase="/api/admin"
              onUpdate={handleUpdate}
            />
          ))}

          {products.length === 0 && (
            <div className="text-center py-8 border rounded-md bg-muted/50">
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

export default function StorePage() {
  return (
    <AdminAuthProvider apiBase="/api">
      <div className="min-h-screen flex flex-col">
        <SEO
          title="Shop QR Products | QR Gear"
          description="Browse our collection of merchandise for your custom QR codes. T-shirts, hats, mugs, bags and more ready for customization."
          keywords="QR code products, custom merchandise, promotional items, QR shirts, QR hats"
        />
        <Navbar />
        <main className="flex-1">
          <div className="container mobile-compact mobile-compact-stack py-6 px-4 sm:px-6">

            <div className="glass-card">
              <h1 className="glass-title text-lg mb-4 flex items-center gap-2" data-testid="text-page-title">
                <Package className="h-5 w-5" />
                Shop QR Products
              </h1>
              <div className="flex flex-col gap-3">
                <Link href="/admin/store-builder" className="block">
                  <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full" data-testid="link-store-builder">
                    <Store className="h-5 w-5" />
                    Store Builder
                  </button>
                </Link>
                <Link href="/admin/pricing" className="block">
                  <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-pricing">
                    <DollarSign className="h-5 w-5" />
                    Pricing Settings
                  </button>
                </Link>
                <Link href="/admin/library?tab=graphics" className="block">
                  <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-graphics-library">
                    <QrCode className="h-5 w-5" />
                    Graphics Library
                  </button>
                </Link>
                <Link href="/admin/library?tab=templates" className="block">
                  <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-templates-library">
                    <Layers className="h-5 w-5" />
                    Templates Library
                  </button>
                </Link>
                <Link href="/admin/library" className="block">
                  <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-full-library">
                    <Image className="h-5 w-5" />
                    Full Library
                  </button>
                </Link>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" data-testid="text-demo-title">
                  <Settings2 className="h-5 w-5" />
                  Product Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductConfigDemo />
              </CardContent>
            </Card>

            <ProductsHarness showCatalog showBuilder />
          </div>
        </main>
        <Footer />
      </div>
    </AdminAuthProvider>
  );
}
