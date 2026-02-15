import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { QrCode, Layers, Image, Crop, FolderOpen } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";

import { LibraryProvider } from "./LibraryContext";

import GraphicsTab from "./tabs/GraphicsTab";
import TemplatesTab from "./tabs/TemplatesTab";
import SourceImagesTab from "./tabs/SourceImagesTab";
import CroppedImagesTab from "./tabs/CroppedImagesTab";
import BackgroundsTab from "./tabs/BackgroundsTab";

type TabType = "graphics" | "templates" | "backgrounds" | "source" | "cropped";

const TABS = [
  { id: "graphics" as const, label: "Graphics", icon: QrCode },
  { id: "templates" as const, label: "Templates", icon: Layers },
  { id: "backgrounds" as const, label: "Backgrounds", icon: Image },
  { id: "cropped" as const, label: "Cropped", icon: Crop },
  { id: "source" as const, label: "Source", icon: FolderOpen },
];

export default function LibraryPage() {
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
    <AdminAuthProvider apiBase="/api/admin">
    <LibraryProvider>
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
<div className="glass-card">
            <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
              <Layers className="h-5 w-5 text-blue-400" />
              Asset Library
            </h1>

            <h2 className="glass-title text-base mb-4">Select Tab</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`qr-btn qr-btn--touch aspect-square flex flex-col items-center justify-center text-center ${isActive ? "qr-btn--primary" : "qr-btn--outline"}`}
                    data-testid={`tab-${t.id}`}
                  >
                    <Icon className="h-6 w-6 mb-1" />
                    <span className="text-sm">{t.label}</span>
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
    </AdminAuthProvider>
  );
}
