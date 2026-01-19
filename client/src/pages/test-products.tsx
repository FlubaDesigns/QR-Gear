import { Link } from "wouter";
import { AlertTriangle, Image, Layers, QrCode } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";

export default function TestProductsPage() {
  return (
    <AdminAuthProvider apiBase="/api/test">
      <div className="page-wrap">
        <div className="container px-1 py-1 sm:px-4 sm:py-6 space-y-2 sm:space-y-6">
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
                <div className="flex flex-wrap gap-2">
                  <Link href="/admin/library?tab=graphics">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-graphics-library">
                      <QrCode className="h-5 w-5 mr-2" />
                      Graphics Library
                    </button>
                  </Link>
                  <Link href="/admin/library?tab=templates">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-templates-library">
                      <Layers className="h-5 w-5 mr-2" />
                      Templates Library
                    </button>
                  </Link>
                  <Link href="/admin/library">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-full-library">
                      <Image className="h-5 w-5 mr-2" />
                      Full Library
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <ProductsHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
