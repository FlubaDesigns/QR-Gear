import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Trash2, Image, Copy, ExternalLink } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { getDesignImageUrl } from "../shared/constants";
import type { CustomDesign } from "../shared/types";

export default function TemplatesTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedDesign, setSelectedDesign] = useState<CustomDesign | null>(null);

  const { data: templates = [], isLoading } = useQuery<CustomDesign[]>({
    queryKey: ["/api/admin/library/templates"],
  });

  const removeFromLibraryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/admin/custom-designs/${id}`, { savedToLibrary: false });
      return await response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Template Removed", 
        description: "The design has been removed from your library. It's still available in Product Builder.",
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library/templates"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Remove Failed", 
        description: error?.message || "Couldn't remove the template. Please try again.", 
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleViewLandingPage = (design: CustomDesign) => {
    window.open(`/customs/${design.id}`, "_blank");
  };

  const handleDuplicate = (design: CustomDesign) => {
    toast({ 
      title: "Coming Soon", 
      description: "Duplicate functionality will open Product Builder with pre-filled data.",
      duration: 3000,
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Saved Design Templates</h2>
          <p className="text-sm text-muted-foreground">
            Custom designs saved to library. Create new templates in Product Builder.
          </p>
        </div>
        <Button onClick={() => navigate("/admin/products")} data-testid="button-go-to-builder">
          <Plus className="h-4 w-4 mr-2" />
          Create in Builder
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No templates saved to library yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Go to Product Builder and save designs with "Save to Library" option.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((design) => (
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
                    onClick={() => removeFromLibraryMutation.mutate(design.id)}
                    disabled={removeFromLibraryMutation.isPending}
                    data-testid={`button-remove-library-${design.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
