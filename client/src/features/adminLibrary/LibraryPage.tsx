import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { QrCode, Layers, ImageIcon, LayoutTemplate, Link2, Upload, Crop, Image } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";

import { LibraryProvider } from "./LibraryContext";

import GraphicsTab from "./tabs/GraphicsTab";
import TemplatesTab from "./tabs/TemplatesTab";
import ImagesTab from "./tabs/ImagesTab";
import BldDefinitionsTab from "./tabs/BldDefinitionsTab";
import AssembliesTab from "./tabs/AssembliesTab";
import SourceImagesTab from "./tabs/SourceImagesTab";
import BackgroundsTab from "./tabs/BackgroundsTab";
import CroppedImagesTab from "./tabs/CroppedImagesTab";

type TabType = "graphics" | "templates" | "images" | "bld" | "asm" | "source" | "backgrounds" | "cropped";

const TABS = [
  { id: "source"      as const, label: "Source",      icon: Upload },
  { id: "backgrounds" as const, label: "Backgrounds", icon: Image },
  { id: "cropped"     as const, label: "Cropped",     icon: Crop },
  { id: "graphics"    as const, label: "Graphics",    icon: QrCode },
  { id: "templates"   as const, label: "Templates",   icon: Layers },
  { id: "images"      as const, label: "Images",      icon: ImageIcon },
  { id: "bld"         as const, label: "BLD Defs",    icon: LayoutTemplate },
  { id: "asm"         as const, label: "Assemblies",  icon: Link2 },
];

export default function LibraryPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialTab = (params.get("tab") as TabType) || "source";
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

            {/* Horizontal scrolling tab bar — compact, mobile-friendly */}
            <div
              className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    data-testid={`tab-${t.id}`}
                    style={{ flexShrink: 0 }}
                    className={`inline-flex items-center gap-2 px-4 rounded-md font-semibold text-sm transition-all
                      ${isActive
                        ? "qr-btn--primary"
                        : "qr-btn qr-btn--outline"
                      }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card">
            {tab === "source"      && <SourceImagesTab />}
            {tab === "backgrounds" && <BackgroundsTab />}
            {tab === "cropped"     && <CroppedImagesTab />}
            {tab === "graphics"    && <GraphicsTab />}
            {tab === "templates"   && <TemplatesTab />}
            {tab === "images"      && <ImagesTab />}
            {tab === "bld"         && <BldDefinitionsTab />}
            {tab === "asm"         && <AssembliesTab />}
          </div>
        </div>
      </div>
    </LibraryProvider>
    </AdminAuthProvider>
  );
}
