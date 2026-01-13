import { useState } from "react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * MIGRATION STRATEGY:
 * Start by pointing every tab at the OLD working components (from the godfile).
 * Then replace ONE import at a time with your new split tab file.
 */

// Phase 1 (stabilize): use legacy tabs (whatever is currently "most working")
import {
  LegacyTemplatesTab,
  LegacyLibraryBackgroundsTab,
  LegacySourceImagesTab,
  LegacyCroppedImagesTab,
} from "@/features/adminLibrary/legacy/LegacyTabs";

// Phase 2 (migrate): swap these in ONE AT A TIME (comment in when ready)
// import TemplatesTab from "@/features/adminLibrary/tabs/TemplatesTab";
// import LibraryBackgroundsTab from "@/features/adminLibrary/tabs/LibraryBackgroundsTab";
// import SourceImagesTab from "@/features/adminLibrary/tabs/SourceImagesTab";
// import CroppedImagesTab from "@/features/adminLibrary/tabs/CroppedImagesTab";

export default function LibraryPage() {
  const [tab, setTab] = useState("templates");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <BreadcrumbTrail
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Library", href: "/admin/library" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-muted-foreground">
            Templates, backgrounds, source images, and cropped assets.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="library">Library Backgrounds</TabsTrigger>
          <TabsTrigger value="source">Source Images</TabsTrigger>
          <TabsTrigger value="cropped">Cropped Images</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          {/* Phase 1 */}
          <LegacyTemplatesTab />
          {/* Phase 2 (swap later): <TemplatesTab /> */}
        </TabsContent>

        <TabsContent value="library" className="mt-6">
          <LegacyLibraryBackgroundsTab />
          {/* later: <LibraryBackgroundsTab /> */}
        </TabsContent>

        <TabsContent value="source" className="mt-6">
          <LegacySourceImagesTab />
          {/* later: <SourceImagesTab /> */}
        </TabsContent>

        <TabsContent value="cropped" className="mt-6">
          <LegacyCroppedImagesTab />
          {/* later: <CroppedImagesTab /> */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
