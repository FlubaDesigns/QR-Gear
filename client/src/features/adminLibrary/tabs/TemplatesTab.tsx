import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Image, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SharedViewer, type GalleryViewItem } from "@/features/shared/components/SharedViewer";

interface ProductTemplate {
  id: string;
  packetId?: string;
  name?: string;
  thumbnailUrl?: string;
  artworkUrl?: string;
  selectedSize?: string;
  enabledColors?: string[];
  enabledSizes?: string[];
  defaultColor?: string;
  isActive?: boolean;
  packet?: {
    productName?: string;
    compositeUrl?: string;
    qrOnlyUrl?: string;
    qrContent?: string;
    headerText?: string;
    footerText?: string;
    qrProductState?: string;
    pricing?: {
      customerPrice?: number;
    };
  };
  createdAt?: string | null;
}

function TemplateCard({ 
  template, 
  onClick 
}: { 
  template: ProductTemplate; 
  onClick: () => void;
}) {
  const imageUrl = template.thumbnailUrl || template.artworkUrl || template.packet?.compositeUrl;
  const productName = template.packet?.productName || template.name || "Untitled Template";

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover-elevate transition-all" 
      onClick={onClick}
      data-testid={`template-card-${template.id}`}
    >
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={productName}
            className="w-full h-full object-contain"
            data-testid="img-template"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-12 w-12" />
          </div>
        )}
        {template.selectedSize && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
            {template.selectedSize}
          </Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <h3 className="font-medium text-sm truncate" data-testid="text-template-name">
          {productName}
        </h3>
        {template.packet?.qrContent && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            {template.packet.qrContent}
          </p>
        )}
        {(template.packet?.headerText || template.packet?.footerText) && (
          <p className="text-xs text-muted-foreground truncate">
            {template.packet?.headerText || template.packet?.footerText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function templateToGalleryItem(template: ProductTemplate): GalleryViewItem {
  return {
    id: template.id,
    packetId: template.packetId,
    name: template.packet?.productName || template.name || "Untitled Template",
    primaryImage: template.thumbnailUrl || template.artworkUrl || template.packet?.compositeUrl,
    secondaryImage: template.packet?.qrOnlyUrl,
    qrContent: template.packet?.qrContent,
    headerText: template.packet?.headerText,
    footerText: template.packet?.footerText,
    qrMode: template.packet?.qrProductState?.replace('qr_', '').toUpperCase(),
    selectedSize: template.selectedSize,
    colorCount: template.enabledColors?.length,
    sizeCount: template.enabledSizes?.length,
    price: template.packet?.pricing?.customerPrice,
  };
}

export default function TemplatesTab() {
  const [, navigate] = useLocation();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; templates: ProductTemplate[] }>({
    queryKey: ["/api/test/templates", "library"],
    queryFn: async () => {
      const res = await fetch("/api/test/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const template = templates.find(t => t.id === templateId);
      
      const deleteRes = await fetch(`/api/test/templates/${templateId}`, {
        method: "DELETE",
      });
      if (!deleteRes.ok) throw new Error("Failed to delete template");

      if (template?.packetId) {
        await fetch(`/api/test/packets/${template.packetId}`, {
          method: "DELETE",
        });
      }

      return { templateId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/test/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/test/packets"] });
      toast({ title: "Deleted", description: "Template and packet have been deleted" });
      setViewerIndex(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    },
  });

  const templates = data?.templates || [];

  const handleEdit = (packetId: string) => {
    navigate(`/test-store-builder?packetId=${packetId}`);
  };

  const handleDelete = (templateId: string) => {
    deleteMutation.mutate(templateId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-templates">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const galleryItems = templates.map(templateToGalleryItem);

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Design Templates</h2>
          <p className="text-sm text-muted-foreground">
            Templates linked to product packets. Click to view details.
          </p>
        </div>
        <Button onClick={() => navigate("/test-products")} data-testid="button-go-to-builder">
          <Plus className="h-4 w-4 mr-2" />
          Create New
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-templates">
            No templates saved yet. Create graphics and assign them to a store.
          </p>
        </div>
      ) : (
        <SharedViewer mode="grid">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" data-testid="templates-grid">
            {templates.map((template, index) => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onClick={() => setViewerIndex(index)}
              />
            ))}
          </div>
        </SharedViewer>
      )}

      {viewerIndex !== null && (
        <SharedViewer
          mode="gallery"
          galleryProps={{
            items: galleryItems,
            currentIndex: viewerIndex,
            onClose: () => setViewerIndex(null),
            onNavigate: setViewerIndex,
            onEdit: handleEdit,
            onAction: handleDelete,
            isActionPending: deleteMutation.isPending,
            actionType: "delete",
            actionConfirmTitle: "Delete this template and its packet?",
            actionConfirmDescription: "This will permanently delete the template and the underlying graphics packet. This action cannot be undone.",
          }}
        />
      )}
    </>
  );
}
