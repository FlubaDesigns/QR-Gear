import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { LibraryProvider } from "@/features/adminLibrary/LibraryContext";
import SourceImagesTab from "@/features/adminLibrary/tabs/SourceImagesTab";
import CroppedImagesTab from "@/features/adminLibrary/tabs/CroppedImagesTab";
import TemplatesTab from "@/features/adminLibrary/tabs/TemplatesTab";
import GraphicsTab from "@/features/adminLibrary/tabs/GraphicsTab";
import BackgroundsTab from "@/features/adminLibrary/tabs/BackgroundsTab";
import { Package, Store, QrCode, Layers, Image, Crop } from "lucide-react";

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
      <div className="qr-admin-page">
        <header className="qr-admin-bar">
          <div className="qr-admin-bar__inner">
            <div className="qr-admin-bar__left">
              <div className="vanity-header-icon">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h1 className="qr-admin-bar__title">Asset Library</h1>
                <p className="qr-admin-bar__subtitle">Graphics, Templates & Assets</p>
              </div>
            </div>
            <div className="qr-admin-bar__right">
              <Link href="/test-products">
                <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-test-products">
                  <Package className="h-5 w-5" />
                  Products
                </button>
              </Link>
              <Link href="/test-store-builder">
                <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-test-store-builder">
                  <Store className="h-5 w-5" />
                  Builder
                </button>
              </Link>
            </div>
          </div>
        </header>

        <main className="qr-admin-main">
          <div className="grid-2x2 mb-6">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`qr-btn--square ${isActive ? "active" : ""}`}
                  data-testid={`tab-${t.id}`}
                >
                  <Icon />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="glass-card">
            {tab === "graphics" && <GraphicsTab />}
            {tab === "templates" && <TemplatesTab />}
            {tab === "backgrounds" && <BackgroundsTab />}
            {tab === "source" && <SourceImagesTab />}
            {tab === "cropped" && <CroppedImagesTab />}
          </div>
        </main>
      </div>
    </LibraryProvider>
  );
}
