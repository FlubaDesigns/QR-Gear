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
import "@/styles/theme.css";
import "@/styles/layout.css";

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
      <div className="qr-admin-page">
        <header className="qr-admin-bar">
          <div className="qr-admin-bar__inner">
            <div className="qr-admin-bar__left">
              <div className="vanity-header-icon" style={{ width: '3rem', height: '3rem' }}>
                <Layers className="h-6 w-6" style={{ color: 'var(--ice-1)' }} />
              </div>
              <div>
                <h1 className="qr-admin-bar__title" style={{ color: 'var(--ice-0)' }}>Asset Library</h1>
                <p className="qr-admin-bar__subtitle">Graphics, Templates & Assets</p>
              </div>
            </div>
            <div className="qr-admin-bar__right">
              <Link href="/test-products">
                <Button variant="outline" size="sm" className="min-h-[48px] px-4" data-testid="link-test-products">
                  <Package className="h-5 w-5 mr-2" style={{ color: 'var(--ice-1)' }} />
                  Products
                </Button>
              </Link>
              <Link href="/test-store-builder">
                <Button variant="outline" size="sm" className="min-h-[48px] px-4" data-testid="link-test-store-builder">
                  <Store className="h-5 w-5 mr-2" style={{ color: 'var(--ice-1)' }} />
                  Builder
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="qr-admin-main">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="glass-card h-auto flex flex-col sm:flex-row flex-wrap gap-2 p-3 mb-6 w-full">
              <TabsTrigger 
                value="graphics" 
                className="flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] w-full sm:w-auto sm:flex-1 rounded-xl data-[state=active]:bg-[var(--ice-2)] data-[state=active]:text-[var(--bg-0)]"
                data-testid="tab-graphics"
              >
                <QrCode className="h-5 w-5" />
                Graphics
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className="flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] w-full sm:w-auto sm:flex-1 rounded-xl data-[state=active]:bg-[var(--ice-2)] data-[state=active]:text-[var(--bg-0)]"
                data-testid="tab-templates"
              >
                <Image className="h-5 w-5" />
                Templates
              </TabsTrigger>
              <TabsTrigger 
                value="backgrounds" 
                className="flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] w-full sm:w-auto sm:flex-1 rounded-xl data-[state=active]:bg-[var(--ice-2)] data-[state=active]:text-[var(--bg-0)]"
                data-testid="tab-backgrounds"
              >
                <Palette className="h-5 w-5" />
                Backgrounds
              </TabsTrigger>
              <TabsTrigger 
                value="source" 
                className="flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] w-full sm:w-auto sm:flex-1 rounded-xl data-[state=active]:bg-[var(--ice-2)] data-[state=active]:text-[var(--bg-0)]"
                data-testid="tab-source"
              >
                <Layers className="h-5 w-5" />
                Source
              </TabsTrigger>
              <TabsTrigger 
                value="cropped" 
                className="flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] w-full sm:w-auto sm:flex-1 rounded-xl data-[state=active]:bg-[var(--ice-2)] data-[state=active]:text-[var(--bg-0)]"
                data-testid="tab-cropped"
              >
                <Crop className="h-5 w-5" />
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
