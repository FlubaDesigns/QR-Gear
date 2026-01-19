import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Plus, Image, Edit, QrCode, Link as LinkIcon, X, Trash2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

function TemplateViewer({
  templates,
  currentIndex,
  onClose,
  onNavigate,
  onEdit,
  onDelete,
  isDeleting,
}: {
  templates: ProductTemplate[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onEdit: (packetId: string) => void;
  onDelete: (templateId: string, packetId?: string) => void;
  isDeleting: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const template = templates[currentIndex];
  
  if (!template) return null;

  const imageUrl = template.thumbnailUrl || template.artworkUrl || template.packet?.compositeUrl || template.packet?.qrOnlyUrl;
  const productName = template.packet?.productName || template.name || "Untitled Template";
  const qrMode = template.packet?.qrProductState?.replace('qr_', '').toUpperCase();

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < templates.length - 1;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && canGoPrev) onNavigate(currentIndex - 1);
    if (e.key === "ArrowRight" && canGoNext) onNavigate(currentIndex + 1);
    if (e.key === "Escape") onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent 
        className="max-w-4xl w-full p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-background/80"
            onClick={onClose}
            data-testid="button-close-viewer"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={productName}
                className="max-w-full max-h-full object-contain"
                data-testid="img-viewer-template"
              />
            ) : (
              <div className="text-muted-foreground">
                <Image className="h-16 w-16" />
              </div>
            )}

            {canGoPrev && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg"
                onClick={() => onNavigate(currentIndex - 1)}
                data-testid="button-prev-template"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            {canGoNext && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg"
                onClick={() => onNavigate(currentIndex + 1)}
                data-testid="button-next-template"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}

            <Badge variant="secondary" className="absolute top-4 left-4">
              {currentIndex + 1} / {templates.length}
            </Badge>

            {template.selectedSize && (
              <Badge variant="outline" className="absolute top-4 left-20 bg-background/80">
                Size: {template.selectedSize}
              </Badge>
            )}
          </div>

          <div className="p-4 border-t space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg truncate" data-testid="text-viewer-name">
                  {productName}
                </h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {qrMode && (
                    <Badge variant="secondary">
                      <QrCode className="h-3 w-3 mr-1" />
                      {qrMode}
                    </Badge>
                  )}
                  {template.enabledColors && template.enabledColors.length > 0 && (
                    <Badge variant="outline">
                      {template.enabledColors.length} colors
                    </Badge>
                  )}
                  {template.enabledSizes && template.enabledSizes.length > 0 && (
                    <Badge variant="outline">
                      {template.enabledSizes.length} sizes
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {template.packetId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(template.packetId!)}
                    data-testid="button-edit-template"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  data-testid="button-delete-template"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            {template.packet?.qrContent && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate flex-1" data-testid="text-viewer-url">
                  {template.packet.qrContent}
                </span>
                <a 
                  href={template.packet.qrContent} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            {(template.packet?.headerText || template.packet?.footerText) && (
              <div className="space-y-1">
                {template.packet?.headerText && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Header:</span>{" "}
                    <span className="font-medium" data-testid="text-header">{template.packet.headerText}</span>
                  </p>
                )}
                {template.packet?.footerText && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Footer:</span>{" "}
                    <span className="font-medium" data-testid="text-footer">{template.packet.footerText}</span>
                  </p>
                )}
              </div>
            )}

            {template.packet?.pricing?.customerPrice && (
              <p className="text-sm text-muted-foreground">
                Price: <span className="font-medium text-foreground">${template.packet.pricing.customerPrice.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this template and its packet?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the template and the underlying graphics packet. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  onDelete(template.id, template.packetId);
                  setShowDeleteConfirm(false);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
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
    mutationFn: async ({ templateId, packetId }: { templateId: string; packetId?: string }) => {
      const deleteRes = await fetch(`/api/test/templates/${templateId}`, {
        method: "DELETE",
      });
      if (!deleteRes.ok) throw new Error("Failed to delete template");

      if (packetId) {
        await fetch(`/api/test/packets/${packetId}`, {
          method: "DELETE",
        });
      }

      return { templateId, packetId };
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

  const handleDelete = (templateId: string, packetId?: string) => {
    deleteMutation.mutate({ templateId, packetId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-templates">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" data-testid="templates-grid">
          {templates.map((template, index) => (
            <TemplateCard 
              key={template.id} 
              template={template} 
              onClick={() => setViewerIndex(index)}
            />
          ))}
        </div>
      )}

      {viewerIndex !== null && (
        <TemplateViewer
          templates={templates}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </>
  );
}
