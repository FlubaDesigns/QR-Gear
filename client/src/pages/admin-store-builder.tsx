import { useState } from "react";
import { Store, Users, Package } from "lucide-react";
import { StoreBuilderHarness } from "@/features/storeBuilder/StoreBuilderHarness";
import { StoreManager } from "@/features/storeBuilder/StoreManager";
import { MemberProductLibrary } from "@/features/storeBuilder/MemberProductLibrary";
import AdminShell from "@/components/AdminShell";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import AdminBottomNav from "@/components/admin/AdminBottomNav";

const storeTabs: AdminTab[] = [
  { id: "channels", label: "Channels", icon: Store },
  { id: "stores", label: "Stores", icon: Users },
  { id: "library", label: "Library", icon: Package },
];

export default function AdminStoreBuilderPage() {
  const [activeTab, setActiveTab] = useState("channels");

  return (
    <>
      <AdminShell
        title="Store Builder"
        icon={Store}
        tabs={storeTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
      <AdminBottomNav />
    </>
  );
}
