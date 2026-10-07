import { Package } from "lucide-react";
import { StoreLibraryHarness } from "@/features/adminProducts/storeLibrary/StoreLibraryHarness";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { PLACE_SUBNAV } from "@/components/admin/adminNavConfig";

export default function AdminStoreLibraryPage() {
  return (
    <AdminShell
      title="Store Products"
      icon={Package}
      sectionNav={<AdminSectionSubNav items={PLACE_SUBNAV} />}
    >
      <StoreLibraryHarness />
    </AdminShell>
  );
}
