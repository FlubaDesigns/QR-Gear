import { Link } from "wouter";
import { AlertTriangle, Store, Package, DollarSign, QrCode, Layers, Image } from "lucide-react";
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
                <div className="flex flex-wrap gap-2">
                  <Link href="/test-products">
                    <button className="qr-btn qr-btn--primary qr-btn--touch" data-testid="link-test-products">
                      <Package className="h-5 w-5 mr-2" />
                      Products
                    </button>
                  </Link>
                  <Link href="/test-pricing">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-test-pricing">
                      <DollarSign className="h-5 w-5 mr-2" />
                      Pricing
                    </button>
                  </Link>
                  <Link href="/admin/library?tab=graphics">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-graphics-library">
                      <QrCode className="h-5 w-5 mr-2" />
                      Graphics
                    </button>
                  </Link>
                  <Link href="/admin/library?tab=templates">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-templates-library">
                      <Layers className="h-5 w-5 mr-2" />
                      Templates
                    </button>
                  </Link>
                  <Link href="/admin/library">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-full-library">
                      <Image className="h-5 w-5 mr-2" />
                      Library
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
