import { Link } from "wouter";
import { DollarSign, Image, Layers, QrCode, Store } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";

export default function AdminProducts() {
  return (
    <AdminAuthProvider apiBase="/api">
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">

          <div className="glass-card">
            <h1 className="glass-title text-lg mb-4 flex items-center gap-2" data-testid="text-page-title">
              Product Management
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

          <ProductsHarness showCatalog showBuilder showSync />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
