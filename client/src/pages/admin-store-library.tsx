import { Library } from "lucide-react";
import { StoreLibraryHarness } from "@/features/adminProducts/storeLibrary/StoreLibraryHarness";
import AdminShell from "@/components/AdminShell";
import AdminBottomNav from "@/components/admin/AdminBottomNav";

export default function AdminStoreLibraryPage() {
  return (
    <>
      <AdminShell
        title="Store Library"
        icon={Library}
      >
        <StoreLibraryHarness />
      </AdminShell>
      <AdminBottomNav />
    </>
  );
}
