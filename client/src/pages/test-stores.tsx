import { Link } from "wouter";
import { Package, Library, Store, DollarSign, Layers } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { StoreLibraryHarness } from "@/features/adminProducts/storeLibrary/StoreLibraryHarness";

export default function TestStoresPage() {
  return (
    <AdminAuthProvider apiBase="/api/test">
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
          <div className="glass-card">
            <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
              <Library className="h-5 w-5 text-blue-400" />
              Store Library
            </h1>
            <div className="flex flex-col gap-3">
              <Link href="/test-products" className="block">
                <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full" data-testid="link-test-products">
                  <Package className="h-5 w-5" />
                  Products
                </button>
              </Link>
              <Link href="/test-store-builder" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-test-store-builder">
                  <Store className="h-5 w-5" />
                  Store Builder
                </button>
              </Link>
              <Link href="/test-pricing" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-test-pricing">
                  <DollarSign className="h-5 w-5" />
                  Pricing
                </button>
              </Link>
              <Link href="/test-library" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-test-library">
                  <Layers className="h-5 w-5" />
                  Library
                </button>
              </Link>
            </div>
          </div>

          <StoreLibraryHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
