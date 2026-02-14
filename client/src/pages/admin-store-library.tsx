import { Library } from "lucide-react";
import { StoreLibraryHarness } from "@/features/adminProducts/storeLibrary/StoreLibraryHarness";

export default function AdminStoreLibraryPage() {
  return (
    <div className="page-wrap">
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
            <Library className="h-5 w-5 text-blue-400" />
            Store Library
          </h1>
        </div>

        <StoreLibraryHarness />
      </div>
    </div>
  );
}
