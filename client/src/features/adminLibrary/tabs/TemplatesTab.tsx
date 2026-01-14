import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Image, Copy, ExternalLink, Globe, Lock } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { getDesignImageUrl } from "../shared/constants";
import { useTemplates } from "../services/useLibraryAssets";
import type { CustomDesign } from "../shared/types";

export default function TemplatesTab() {
  const [, navigate] = useLocation();
  const [selectedDesign, setSelectedDesign] = useState<CustomDesign | null>(null);
  const [visibilityTab, setVisibilityTab] = useState<"public" | "private">("public");

  const { data: templates = [], isLoading, removeFromLibrary } = useTemplates();
  
  const publicTemplates = templates.filter(t => (t as any).visibility === "public");
  const privateTemplates = templates.filter(t => (t as any).visibility !== "public");

  const handleViewLandingPage = (design: CustomDesign) => {
    window.open(`/customs/${design.id}`, "_blank");
  };

  const handleDuplicate = (_design: CustomDesign) => {
    // Coming soon: will open Product Builder with pre-filled data
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderTemplateCard = (design: CustomDesign) => (
    <Card key={design.id} className="overflow-hidden" data-testid={`card-template-${design.id}`}>
      <div className="aspect-video relative bg-muted">
        {getDesignImageUrl(design) ? (
          <SmartImage
            src={getDesignImageUrl(design)}
            alt={design.productName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="h-8 w-8 opacity-30" />
          </div>
        )}
        {design.isFeatured && (
          <Badge className="absolute top-2 left-2">Featured</Badge>
        )}
        {design.isSeasonalPromo && (
          <Badge variant="secondary" className="absolute top-2 right-2">Seasonal</Badge>
        )}
      </div>
      <CardContent className="p-4">
        <p className="font-medium truncate">{(design as any).projectName || design.productName}</p>
        <p className="text-sm text-muted-foreground truncate">{design.productName}</p>
        
        <div className="flex flex-wrap gap-1 mt-2">
          {design.storeName && (
            <Badge variant="outline" className="text-xs">{design.storeName}</Badge>
          )}
          {design.segment && (
            <Badge variant="outline" className="text-xs">{design.segment}</Badge>
          )}
        </div>
        
        {(design.topText !== null || design.bottomText !== null) && (
          <div className="mt-2 text-xs text-muted-foreground">
            {design.topText !== null && <p>Top: "{String((design.topText as Record<string, unknown>)?.text ?? "")}"</p>}
            {design.bottomText !== null && <p>Bottom: "{String((design.bottomText as Record<string, unknown>)?.text ?? "")}"</p>}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            className="flex-1 min-h-12"
            onClick={() => handleViewLandingPage(design)}
            data-testid={`button-view-${design.id}`}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="min-h-12 min-w-12"
            onClick={() => handleDuplicate(design)}
            data-testid={`button-duplicate-${design.id}`}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="min-h-12 min-w-12"
            onClick={() => removeFromLibrary.mutate(design.id)}
            disabled={removeFromLibrary.isPending}
            data-testid={`button-remove-library-${design.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderEmptyState = (message: string) => (
    <Card className="text-center py-12">
      <CardContent>
        <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Go to Product Builder and save designs with "Save to Library" option.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Design Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable designs for products. Public templates are shared with all stores.
          </p>
        </div>
        <Button onClick={() => navigate("/admin/products")} data-testid="button-go-to-builder">
          <Plus className="h-4 w-4 mr-2" />
          Create in Builder
        </Button>
      </div>

      <Tabs value={visibilityTab} onValueChange={(v) => setVisibilityTab(v as "public" | "private")}>
        <TabsList className="mb-4">
          <TabsTrigger value="public" data-testid="tab-public-templates">
            <Globe className="h-4 w-4 mr-2" />
            Public ({publicTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="private" data-testid="tab-private-templates">
            <Lock className="h-4 w-4 mr-2" />
            Private ({privateTemplates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="public">
          {publicTemplates.length === 0 ? (
            renderEmptyState("No public templates yet.")
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicTemplates.map(renderTemplateCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="private">
          {privateTemplates.length === 0 ? (
            renderEmptyState("No private templates yet.")
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {privateTemplates.map(renderTemplateCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedDesign} onOpenChange={() => setSelectedDesign(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Template Details</DialogTitle>
          </DialogHeader>
          {selectedDesign && (
            <div className="space-y-4">
              {getDesignImageUrl(selectedDesign) && (
                <div className="aspect-video rounded-md overflow-hidden">
                  <SmartImage 
                    src={getDesignImageUrl(selectedDesign)} 
                    alt={selectedDesign.productName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Product</p>
                  <p className="font-medium">{selectedDesign.productName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Store</p>
                  <p className="font-medium">{selectedDesign.storeName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Segment</p>
                  <p className="font-medium">{selectedDesign.segment || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(selectedDesign.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDesign(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
