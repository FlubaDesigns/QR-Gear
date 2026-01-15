import { useState } from "react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { LibraryProvider } from "./LibraryContext";

import TemplatesTab from "./tabs/TemplatesTab";
import BackgroundsTab from "./tabs/BackgroundsTab";
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
          <TabsList className="h-auto flex flex-wrap gap-2 p-2 bg-muted/50">
            <TabsTrigger value="templates" className="flex-1 min-w-[120px]">Templates</TabsTrigger>
            <TabsTrigger value="library" className="flex-1 min-w-[120px]">Library Backgrounds</TabsTrigger>
            <TabsTrigger value="source" className="flex-1 min-w-[120px]">Source Images</TabsTrigger>
            <TabsTrigger value="cropped" className="flex-1 min-w-[120px]">Cropped Images</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-6">
            <TemplatesTab />
          </TabsContent>

          <TabsContent value="library" className="mt-6">
            <BackgroundsTab />
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
