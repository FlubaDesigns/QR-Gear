import { useState } from "react";
import { Store, Users, Package, Map, BarChart, Globe } from "lucide-react";
import { StoreBuilderHarness } from "@/features/storeBuilder/StoreBuilderHarness";
import { StoreManager } from "@/features/storeBuilder/StoreManager";
import { MemberProductLibrary } from "@/features/storeBuilder/MemberProductLibrary";
import AdminShell from "@/components/AdminShell";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";

const PLACE_SUBNAV = [
  { label: "Store Builder", href: "/admin/store-builder", icon: Store },
  { label: "Library", href: "/admin/store-library", icon: Package },
];

const storeTabs: AdminTab[] = [
  { id: "channels", label: "Channels", icon: Store },
  { id: "stores", label: "Stores", icon: Users },
  { id: "library", label: "Library", icon: Package },
];

export default function AdminStoreBuilderPage() {
  const [activeTab, setActiveTab] = useState("channels");

  return (
    <AdminShell
      title="Store Builder"
      icon={Store}
      tabs={storeTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      sectionNav={<AdminSectionSubNav items={PLACE_SUBNAV} />}
    >
      {activeTab === "channels" && (
        <StoreBuilderHarness />
      )}

      {activeTab === "stores" && (
        <StoreManager />
      )}

      {activeTab === "library" && (
        <MemberProductLibrary />
      )}
    </AdminShell>
  );
}
