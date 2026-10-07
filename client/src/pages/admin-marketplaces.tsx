import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { PLACE_SUBNAV } from "@/components/admin/adminNavConfig";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import { Settings, Link2, ListChecks } from "lucide-react";
import { AccountsSection } from "./marketplaces-accounts";
import { ListingsSection, ActivitySection } from "./marketplaces-listings";

const SECTION_TABS: AdminTab[] = [
  { id: "accounts", label: "Accounts", icon: Settings },
  { id: "listings", label: "Listings", icon: Link2 },
  { id: "activity", label: "Activity", icon: ListChecks },
];

export default function AdminMarketplaces() {
  const [activeTab, setActiveTab] = useState("accounts");

  return (
    <AdminShell
      title="Marketplaces"
      tabs={SECTION_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      sectionNav={<AdminSectionSubNav items={PLACE_SUBNAV} />}
    >
      {activeTab === "accounts" && <AccountsSection />}
      {activeTab === "listings" && <ListingsSection onOpenAccounts={() => setActiveTab("accounts")} />}
      {activeTab === "activity" && <ActivitySection />}
    </AdminShell>
  );
}
