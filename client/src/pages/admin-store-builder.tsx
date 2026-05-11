import { useState } from "react";
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

const VALID_TABS = ["catalog", "channels", "stores", "partners", "library"];

const storeTabs: AdminTab[] = [
  { id: "catalog", label: "Catalog", icon: LayoutGrid },
  { id: "channels", label: "Channels", icon: Hash },
  { id: "stores", label: "Stores", icon: Users },
  { id: "partners", label: "Partners", icon: Globe },
  { id: "library", label: "Library", icon: Package },
];

function getInitialTab(): string {
  if (typeof window === "undefined") return "catalog";
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") ?? "";
  return VALID_TABS.includes(tab) ? tab : "catalog";
}

export default function AdminStoreBuilderPage() {
  const [activeTab, setActiveTab] = useState(getInitialTab);

  const packetId =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("packetId") ?? undefined)
      : undefined;

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
