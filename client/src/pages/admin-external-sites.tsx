import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import { Building2, Layout, MapPin, DollarSign, PieChart, FileText, CreditCard } from "lucide-react";
import { HostsSection, ProfilesSection } from "./external-sites-hosts";
import { PlacementsSection, PricingSection } from "./external-sites-placements";
import { RevenueSection, AttributionsSection, PayoutsSection } from "./external-sites-revenue";

const SECTION_TABS: AdminTab[] = [
  { id: "hosts", label: "Hosts", icon: Building2 },
  { id: "profiles", label: "Profiles", icon: Layout },
  { id: "placements", label: "Placements", icon: MapPin },
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "revenue", label: "Revenue", icon: PieChart },
  { id: "attributions", label: "Attribution", icon: FileText },
  { id: "payouts", label: "Payouts", icon: CreditCard },
];

export default function AdminExternalSites() {
  const [activeTab, setActiveTab] = useState("hosts");

  return (
    <AdminShell
      title="External Sites"
      tabs={SECTION_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "hosts" && <HostsSection />}
      {activeTab === "profiles" && <ProfilesSection />}
      {activeTab === "placements" && <PlacementsSection />}
      {activeTab === "pricing" && <PricingSection />}
      {activeTab === "revenue" && <RevenueSection />}
      {activeTab === "attributions" && <AttributionsSection />}
      {activeTab === "payouts" && <PayoutsSection />}
    </AdminShell>
  );
}
