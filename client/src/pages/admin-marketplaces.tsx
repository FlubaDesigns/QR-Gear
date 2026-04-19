import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { PLACE_SUBNAV } from "@/components/admin/adminNavConfig";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import { Settings, Layers, Link2, ListChecks, ScrollText } from "lucide-react";
import { AccountsSection, SurfacesSection } from "./marketplaces-accounts";
import { ListingsSection, JobsSection, LogsSection } from "./marketplaces-listings";

const SECTION_TABS: AdminTab[] = [
  { id: "accounts", label: "Accounts", icon: Settings },
  { id: "surfaces", label: "Surfaces", icon: Layers },
  { id: "listings", label: "Listings", icon: Link2 },
  { id: "jobs", label: "Jobs", icon: ListChecks },
  { id: "logs", label: "Logs", icon: ScrollText },
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
      {activeTab === "surfaces" && <SurfacesSection />}
      {activeTab === "listings" && <ListingsSection />}
      {activeTab === "jobs" && <JobsSection />}
      {activeTab === "logs" && <LogsSection />}
    </AdminShell>
  );
}
