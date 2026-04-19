import { Library, Store, Package } from "lucide-react";
import { StoreLibraryHarness } from "@/features/adminProducts/storeLibrary/StoreLibraryHarness";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";

const PLACE_SUBNAV = [
  { label: "Store Builder", href: "/admin/store-builder", icon: Store },
  { label: "Library", href: "/admin/store-library", icon: Package },
];

export default function AdminStoreLibraryPage() {
  return (
    <AdminShell
      title="Store Library"
      icon={Library}
      sectionNav={<AdminSectionSubNav items={PLACE_SUBNAV} />}
    >
      <StoreLibraryHarness />
    </AdminShell>
  );
}
