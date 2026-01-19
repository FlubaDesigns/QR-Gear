import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { LibraryProvider } from "@/features/adminLibrary/LibraryContext";
import SourceImagesTab from "@/features/adminLibrary/tabs/SourceImagesTab";
import CroppedImagesTab from "@/features/adminLibrary/tabs/CroppedImagesTab";
import TemplatesTab from "@/features/adminLibrary/tabs/TemplatesTab";
import GraphicsTab from "@/features/adminLibrary/tabs/GraphicsTab";
import BackgroundsTab from "@/features/adminLibrary/tabs/BackgroundsTab";
import { Package, Store, QrCode, Layers, Image, Crop, DollarSign, Library } from "lucide-react";

type TabType = "graphics" | "templates" | "backgrounds" | "source" | "cropped";

const TABS = [
  { id: "graphics" as const, label: "Graphics", icon: QrCode },
  { id: "templates" as const, label: "Templates", icon: Layers },
  { id: "backgrounds" as const, label: "Backgrounds", icon: Image },
  { id: "cropped" as const, label: "Cropped", icon: Crop },
  { id: "source" as const, label: "Source", icon: Image },
];

export default function TestLibraryPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialTab = (params.get("tab") as TabType) || "graphics";
  const [tab, setTab] = useState<TabType>(initialTab);

  useEffect(() => {
    const newTab = params.get("tab") as TabType;
    if (newTab && TABS.some(t => t.id === newTab) && newTab !== tab) {
      setTab(newTab);
    }
  }, [searchString]);

  return (
    <LibraryProvider apiBase="/api/test">
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
          <div className="glass-card">
            <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
              <Layers className="h-5 w-5 text-blue-400" />
              Asset Library
            </h1>
            <div className="flex flex-col gap-3 mb-6">
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
              <Link href="/test-stores" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-test-stores">
                  <Library className="h-5 w-5" />
                  Store Library
                </button>
              </Link>
            </div>
          </div>

          <div className="glass-card">
            <h2 className="glass-title text-base mb-4">Select Tab</h2>
            <div className="flex flex-col gap-3 mb-6">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`qr-btn qr-btn--touch qr-btn--full ${isActive ? "qr-btn--primary" : "qr-btn--outline"}`}
                    data-testid={`tab-${t.id}`}
                  >
                    <Icon className="h-5 w-5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card">
            {tab === "graphics" && <GraphicsTab />}
            {tab === "templates" && <TemplatesTab />}
            {tab === "backgrounds" && <BackgroundsTab />}
            {tab === "source" && <SourceImagesTab />}
            {tab === "cropped" && <CroppedImagesTab />}
          </div>
        </div>
      </div>
    </LibraryProvider>
  );
}
