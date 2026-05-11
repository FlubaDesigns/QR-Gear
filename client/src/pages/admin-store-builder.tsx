import { useState } from "react";
import { useLocation } from "wouter";
import { Store, Users, Package, LayoutGrid, Hash, Globe } from "lucide-react";
import { StoreBuilderHarness } from "@/features/storeBuilder/StoreBuilderHarness";
import { StoreManager } from "@/features/storeBuilder/StoreManager";
import { MemberProductLibrary } from "@/features/storeBuilder/MemberProductLibrary";
import { StoreManagerTab } from "@/features/adminProducts/storeManager/StoreManagerTab";
import { AllChannelsManager } from "@/features/adminProducts/storeManager/AllChannelsManager";
import AdminShell from "@/components/AdminShell";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { PLACE_SUBNAV } from "@/components/admin/adminNavConfig";

const storeTabs: AdminTab[] = [
  { id: "catalog", label: "Catalog", icon: LayoutGrid },
  { id: "channels", label: "Channels", icon: Hash },
  { id: "stores", label: "Stores", icon: Users },
  { id: "partners", label: "Partners", icon: Globe },
  { id: "library", label: "Library", icon: Package },
];

export default function AdminStoreBuilderPage() {
  const [activeTab, setActiveTab] = useState("catalog");
  const [location] = useLocation();

  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const packetId = params.get("packetId") ?? undefined;

  return (
    <AdminShell
      title="Store Builder"
      icon={Store}
      tabs={storeTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      sectionNav={<AdminSectionSubNav items={PLACE_SUBNAV} />}
    >
      {activeTab === "catalog" && (
        <StoreManagerTab initialPacketId={packetId} />
      )}

      {activeTab === "channels" && (
        <AllChannelsManager />
      )}

      {activeTab === "stores" && (
        <StoreManager />
      )}

      {activeTab === "partners" && (
        <StoreBuilderHarness />
      )}

      {activeTab === "library" && (
        <MemberProductLibrary />
      )}
    </AdminShell>
  );
}
