import { Link } from "wouter";
import { DollarSign, Image, Layers, Package, QrCode, Store } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

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

            <ProductsHarness showCatalog showBuilder showSync />
          </div>
        </main>
        <Footer />
      </div>
    </AdminAuthProvider>
  );
}
