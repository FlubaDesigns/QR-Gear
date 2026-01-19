import { useState, useEffect } from "react";
import { QrCode, Layers, Image, Crop } from "lucide-react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

import { LibraryProvider } from "./LibraryContext";

import GraphicsTab from "./tabs/GraphicsTab";
import TemplatesTab from "./tabs/TemplatesTab";
import SourceImagesTab from "./tabs/SourceImagesTab";
import CroppedImagesTab from "./tabs/CroppedImagesTab";

type TabType = "graphics" | "templates" | "source" | "cropped";

const TABS = [
  { id: "graphics" as const, label: "Graphics", icon: QrCode },
  { id: "templates" as const, label: "Templates", icon: Layers },
  { id: "source" as const, label: "Source Images", icon: Image },
  { id: "cropped" as const, label: "Cropped", icon: Crop },
];

export default function LibraryPage() {
  const [tab, setTab] = useState<TabType>("graphics");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam && TABS.some(t => t.id === tabParam)) {
      setTab(tabParam as TabType);
    }
  }, []);

  return (
    <LibraryProvider>
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
          <BreadcrumbTrail />

          <div className="glass-card">
            <h1 className="glass-title text-lg">Library</h1>
          </div>

          <div className="flex flex-col gap-2">
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

          <div className="glass-card">
            {tab === "graphics" && <GraphicsTab />}
            {tab === "templates" && <TemplatesTab />}
            {tab === "source" && <SourceImagesTab />}
            {tab === "cropped" && <CroppedImagesTab />}
          </div>
        </div>
      </div>
    </LibraryProvider>
  );
}
