import { useState, useEffect } from "react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { LibraryProvider } from "./LibraryContext";

import GraphicsTab from "./tabs/GraphicsTab";
import TemplatesTab from "./tabs/TemplatesTab";
import BackgroundsTab from "./tabs/BackgroundsTab";
import SourceImagesTab from "./tabs/SourceImagesTab";
import CroppedImagesTab from "./tabs/CroppedImagesTab";

export default function LibraryPage() {
  const [tab, setTab] = useState<string>("graphics");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam && ["graphics", "templates", "library", "source", "cropped"].includes(tabParam)) {
      setTab(tabParam);
    }
  }, []);

  return (
    <LibraryProvider>
      <div className="container mx-auto py-6 space-y-6">
        <BreadcrumbTrail />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Library</h1>
            <p className="text-muted-foreground">
              Graphics, templates, backgrounds, and source images.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="h-auto grid grid-cols-2 sm:grid-cols-5 gap-2 p-2 bg-muted/50">
            <TabsTrigger value="graphics" className="h-12 text-base" data-testid="tab-graphics">
              Graphics
            </TabsTrigger>
            <TabsTrigger value="templates" className="h-12 text-base" data-testid="tab-templates">
              Templates
            </TabsTrigger>
            <TabsTrigger value="library" className="h-12 text-base" data-testid="tab-backgrounds">
              Backgrounds
            </TabsTrigger>
            <TabsTrigger value="source" className="h-12 text-base" data-testid="tab-source">
              Source
            </TabsTrigger>
            <TabsTrigger value="cropped" className="h-12 text-base col-span-2 sm:col-span-1" data-testid="tab-cropped">
              Cropped
            </TabsTrigger>
          </TabsList>

          <TabsContent value="graphics" className="mt-6">
            <GraphicsTab />
          </TabsContent>

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
