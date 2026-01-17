import { Link } from "wouter";
import { AlertTriangle, Store, Package } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { StoreBuilderHarness } from "@/features/storeBuilder/StoreBuilderHarness";

export default function TestStoreBuilderPage() {
  return (
    <AdminAuthProvider apiBase="/api/test">
      <div className="page-wrap">
        <div className="container py-8 space-y-8">
          <div className="glass-card">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="glass-icon">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="glass-title text-xl mb-2" data-testid="text-page-title">
                  Test Store Builder (No Auth Required)
                </h1>
                <p className="glass-body mb-4">
                  Assign saved product packages to stores and channels. 
                  Uses /api/test endpoints. Load a product from Products Builder first.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/test-products">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-test-products">
                      <Package className="h-5 w-5 mr-2" />
                      Go to Products
                    </button>
                  </Link>
                  <Link href="/test-library">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-test-library">
                      <Store className="h-5 w-5 mr-2" />
                      Go to Library
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <StoreBuilderHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
