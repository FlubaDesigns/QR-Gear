import { useState } from "react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryProvider } from "./LibraryContext";

import TemplatesTab from "@/features/adminLibrary/tabs/TemplatesTab";
import LibraryBackgroundsTab from "@/features/adminLibrary/tabs/LibraryBackgroundsTab";
import SourceImagesTab from "@/features/adminLibrary/tabs/SourceImagesTab";
import CroppedImagesTab from "@/features/adminLibrary/tabs/CroppedImagesTab";

export default function LibraryPage() {
  const [tab, setTab] = useState<string>("templates");

  return (
    <LibraryProvider>
      <div className="container mx-auto py-6 space-y-6">
        <BreadcrumbTrail />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Library</h1>
            <p className="text-muted-foreground">
              Manage templates, backgrounds, source images, and cropped assets.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            <TabsTrigger value="library" data-testid="tab-library">Library Backgrounds</TabsTrigger>
            <TabsTrigger value="source" data-testid="tab-source">Source Images</TabsTrigger>
            <TabsTrigger value="cropped" data-testid="tab-cropped">Cropped Images</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-6">
            <TemplatesTab />
          </TabsContent>

          <TabsContent value="library" className="mt-6">
            <LibraryBackgroundsTab />
          </TabsContent>

          <TabsContent value="source" className="mt-6">
            <SourceImagesTab />
          </TabsContent>

          <TabsContent value="cropped" className="mt-6">
            <CroppedImagesTab />
          </TabsContent>
        </Tabs>
      </div>
    </LibraryProvider>
  );
}
