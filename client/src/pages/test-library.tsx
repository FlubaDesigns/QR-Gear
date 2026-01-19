import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryProvider } from "@/features/adminLibrary/LibraryContext";
import SourceImagesTab from "@/features/adminLibrary/tabs/SourceImagesTab";
import CroppedImagesTab from "@/features/adminLibrary/tabs/CroppedImagesTab";
import BackgroundsTab from "@/features/adminLibrary/tabs/BackgroundsTab";
import TemplatesTab from "@/features/adminLibrary/tabs/TemplatesTab";
import GraphicsTab from "@/features/adminLibrary/tabs/GraphicsTab";
import { Button } from "@/components/ui/button";
import { Package, Store, Image, QrCode, Layers, Crop, Palette } from "lucide-react";

export default function TestLibraryPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialTab = params.get("tab") || "graphics";
  const [tab, setTab] = useState<string>(initialTab);

  useEffect(() => {
    const newTab = params.get("tab");
    if (newTab && newTab !== tab) {
      setTab(newTab);
    }
  }, [searchString]);

  return (
    <LibraryProvider apiBase="/api/test">
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Asset Library</h1>
                  <p className="text-sm text-muted-foreground">
                    Manage your graphics, templates, and assets
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/test-products">
                  <Button variant="outline" size="sm" data-testid="link-test-products">
                    <Package className="h-4 w-4 mr-2" />
                    Products
                  </Button>
                </Link>
                <Link href="/test-store-builder">
                  <Button variant="outline" size="sm" data-testid="link-test-store-builder">
                    <Store className="h-4 w-4 mr-2" />
                    Store Builder
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="h-auto flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg mb-6">
              <TabsTrigger 
                value="graphics" 
                className="flex items-center gap-2 px-4 py-2"
                data-testid="tab-graphics"
              >
                <QrCode className="h-4 w-4" />
                Graphics
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className="flex items-center gap-2 px-4 py-2"
                data-testid="tab-templates"
              >
                <Image className="h-4 w-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger 
                value="backgrounds" 
                className="flex items-center gap-2 px-4 py-2"
                data-testid="tab-backgrounds"
              >
                <Palette className="h-4 w-4" />
                Backgrounds
              </TabsTrigger>
              <TabsTrigger 
                value="source" 
                className="flex items-center gap-2 px-4 py-2"
                data-testid="tab-source"
              >
                <Layers className="h-4 w-4" />
                Source
              </TabsTrigger>
              <TabsTrigger 
                value="cropped" 
                className="flex items-center gap-2 px-4 py-2"
                data-testid="tab-cropped"
              >
                <Crop className="h-4 w-4" />
                Cropped
              </TabsTrigger>
            </TabsList>

            <TabsContent value="graphics" className="mt-0">
              <GraphicsTab />
            </TabsContent>

            <TabsContent value="templates" className="mt-0">
              <TemplatesTab />
            </TabsContent>

            <TabsContent value="backgrounds" className="mt-0">
              <BackgroundsTab />
            </TabsContent>

            <TabsContent value="source" className="mt-0">
              <SourceImagesTab />
            </TabsContent>

            <TabsContent value="cropped" className="mt-0">
              <CroppedImagesTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </LibraryProvider>
  );
}
