import { Link } from "wouter";
import { Store, Package, DollarSign, QrCode, Layers, Image } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { StoreBuilderHarness } from "@/features/storeBuilder/StoreBuilderHarness";

export default function TestStoreBuilderPage() {
  return (
    <AdminAuthProvider apiBase="/api/test">
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">

          <div className="glass-card">
            <h1 className="glass-title text-lg mb-4 flex items-center gap-2" data-testid="text-page-title">
              <Store className="h-5 w-5 text-blue-400" />
              Store Builder
            </h1>
            <div className="flex flex-col gap-3">
              <Link href="/test-products" className="block">
                <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full" data-testid="link-test-products">
                  <Package className="h-5 w-5" />
                  Products
                </button>
              </Link>
              <Link href="/test-pricing" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-test-pricing">
                  <DollarSign className="h-5 w-5" />
                  Pricing
                </button>
              </Link>
              <Link href="/admin/library?tab=graphics" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-graphics-library">
                  <QrCode className="h-5 w-5" />
                  Graphics
                </button>
              </Link>
              <Link href="/admin/library?tab=templates" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-templates-library">
                  <Layers className="h-5 w-5" />
                  Templates
                </button>
              </Link>
              <Link href="/admin/library" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-full-library">
                  <Image className="h-5 w-5" />
                  Library
                </button>
              </Link>
            </div>
          </div>

          <StoreBuilderHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
