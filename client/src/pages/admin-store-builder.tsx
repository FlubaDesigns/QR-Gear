import { useLocation, useSearch } from "wouter";
import { Store, Package, LayoutGrid } from "lucide-react";
import { MemberProductLibrary } from "@/features/storeBuilder/MemberProductLibrary";
import { StoreManagerTab } from "@/features/adminProducts/storeManager/StoreManagerTab";
import AdminShell from "@/components/AdminShell";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { PLACE_SUBNAV } from "@/components/admin/adminNavConfig";

const storeTabs: AdminTab[] = [
  { id: "placement", label: "Placement", icon: LayoutGrid },
  { id: "library", label: "Products", icon: Package },
];

export default function AdminStoreBuilderPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  // Previous catalog/channels/stores/partners links share the canonical placement editor.
  const activeTab = params.get("tab") === "library" ? "library" : "placement";
  const packetId = params.get("packetId") ?? undefined;
  return <AdminShell title="Store Builder" icon={Store} tabs={storeTabs} activeTab={activeTab}
    onTabChange={tab => { const next = new URLSearchParams(search); next.set("tab", tab); navigate(`/admin/store-builder?${next}`); }}
    sectionNav={<AdminSectionSubNav items={PLACE_SUBNAV} />}>
    {activeTab === "placement" ? <StoreManagerTab initialPacketId={packetId} initialStoreId={params.get("storeId") || undefined} initialChannelKey={params.get("channelId") || params.get("channel") || undefined} initialRole={params.get("role") || undefined} /> : <MemberProductLibrary />}
  </AdminShell>;
}
