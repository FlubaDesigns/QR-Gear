import { useState } from "react";
import { Link } from "wouter";
import { DollarSign, Image, Layers, Package, QrCode, Store, Settings2, Palette, Box, Film, Type, Zap } from "lucide-react";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";
import AdminShell from "@/components/AdminShell";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { BUILD_SUBNAV } from "@/components/admin/adminNavConfig";

const productTabs: AdminTab[] = [
  { id: "builder", label: "Builder", icon: Settings2 },
  { id: "tools", label: "Tools", icon: Palette },
];

export default function AdminProducts() {
  const [activeTab, setActiveTab] = useState("builder");

  return (
    <>
      <AdminShell
        title="Product Management"
        icon={Package}
        tabs={productTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sectionNav={<AdminSectionSubNav items={BUILD_SUBNAV} />}
      >
        {activeTab === "builder" && (
          <ProductsHarness showBuilder />
        )}

        {activeTab === "tools" && (
          <div className="flex flex-col gap-3">
            <AdminSectionCard title="Quick Actions" icon={Store}>
              <div className="flex flex-col gap-2">
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
            </AdminSectionCard>
          </div>
        )}
      </AdminShell>
    </>
  );
}
