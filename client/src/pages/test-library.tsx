import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryProvider } from "@/features/adminLibrary/LibraryContext";
import SourceImagesTab from "@/features/adminLibrary/tabs/SourceImagesTab";
import CroppedImagesTab from "@/features/adminLibrary/tabs/CroppedImagesTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function TestLibraryPage() {
  const [tab, setTab] = useState<string>("source");

  return (
    <LibraryProvider apiBase="/api/test" usePublicFetch={true}>
      <div className="container mx-auto py-6 space-y-6">
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Test Library (No Auth Required)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is a public test version of the library for debugging. 
              Uses /api/test endpoints instead of /api/admin endpoints.
            </p>
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
            <TabsTrigger value="source" className="flex-1 min-w-[120px]">Source Images</TabsTrigger>
            <TabsTrigger value="cropped" className="flex-1 min-w-[120px]">Cropped Images</TabsTrigger>
          </TabsList>

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
