import { useState } from "react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryProvider } from "@/features/adminLibrary/LibraryContext";
import SourceImagesTab from "@/features/adminLibrary/tabs/SourceImagesTab";
import CroppedImagesTab from "@/features/adminLibrary/tabs/CroppedImagesTab";
import BackgroundsTab from "@/features/adminLibrary/tabs/BackgroundsTab";
import TemplatesTab from "@/features/adminLibrary/tabs/TemplatesTab";
import GraphicsTab from "@/features/adminLibrary/tabs/GraphicsTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, Store } from "lucide-react";

export default function TestLibraryPage() {
  const [tab, setTab] = useState<string>("source");

  return (
    <LibraryProvider apiBase="/api/test">
      <div className="container mx-auto py-6 space-y-6">
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Test Library (No Auth Required)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This is a public test version of the library for debugging. 
              Uses /api/test endpoints instead of /api/admin endpoints.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/test-products">
                <Button variant="outline" size="sm" data-testid="link-test-products">
                  <Package className="h-4 w-4 mr-2" />
                  Products Builder
                </Button>
              </Link>
              <Link href="/test-store-builder">
                <Button variant="outline" size="sm" data-testid="link-test-store-builder">
                  <Store className="h-4 w-4 mr-2" />
                  Store Builder
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Test Library</h1>
            <p className="text-muted-foreground">
              Source images and cropped assets - no authentication required.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="h-auto flex flex-wrap gap-2 p-2 bg-muted/50">
            <TabsTrigger value="source" className="flex-1 min-w-[100px]">Source</TabsTrigger>
            <TabsTrigger value="cropped" className="flex-1 min-w-[100px]">Cropped</TabsTrigger>
            <TabsTrigger value="backgrounds" className="flex-1 min-w-[100px]">Backgrounds</TabsTrigger>
            <TabsTrigger value="templates" className="flex-1 min-w-[100px]">Templates</TabsTrigger>
            <TabsTrigger value="graphics" className="flex-1 min-w-[100px]">Graphics</TabsTrigger>
          </TabsList>

          <TabsContent value="source" className="mt-6">
            <SourceImagesTab />
          </TabsContent>

          <TabsContent value="cropped" className="mt-6">
            <CroppedImagesTab />
          </TabsContent>

          <TabsContent value="backgrounds" className="mt-6">
            <BackgroundsTab />
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <TemplatesTab />
          </TabsContent>

          <TabsContent value="graphics" className="mt-6">
            <GraphicsTab />
          </TabsContent>
        </Tabs>
      </div>
    </LibraryProvider>
  );
}
