import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { BUILD_SUBNAV } from "@/components/admin/adminNavConfig";
import { PendingAssetDeletions } from '@/features/shared/components/DeleteBuildDialog';
import { useSearch, useLocation } from "wouter";
import { QrCode, Layers, ImageIcon, LayoutTemplate, Link2, Upload, Crop, Image } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";

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
  const [location, navigate] = useLocation();
  const tab = TABS.find(item => item.id === params.get("tab"))?.id ?? "source";
  function selectTab(id: TabType) {
    const next = new URLSearchParams(searchString);
    next.set("tab", id);
    navigate(`${location}?${next.toString()}`, { replace: true });
  }

  return (
    <AdminAuthProvider apiBase="/api/admin">
      <AdminShell title="Asset Library" icon={Layers} sectionNav={<AdminSectionSubNav items={BUILD_SUBNAV} />}>
        <div className="min-w-0 mobile-compact-stack">
          <div className="glass-card">
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
                    onClick={() => selectTab(t.id)}
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
            <PendingAssetDeletions />
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
      </AdminShell>
    </AdminAuthProvider>
  );
}
