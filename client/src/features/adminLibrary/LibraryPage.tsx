import { useState } from "react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { LibraryProvider } from "./LibraryContext";

import TemplatesTab from "./tabs/TemplatesTab";
import LibraryBackgroundsTab from "./tabs/LibraryBackgroundsTab";
import SourceImagesTab from "./tabs/SourceImagesTab";
import CroppedImagesTab from "./tabs/CroppedImagesTab";

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
              Templates, library backgrounds, source images, and cropped assets.
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
