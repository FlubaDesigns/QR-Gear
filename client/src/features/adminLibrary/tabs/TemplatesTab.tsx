import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Image, Edit, QrCode, Link as LinkIcon } from "lucide-react";

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
    qrProductState?: string;
  };
  createdAt?: string | null;
}

function TemplateCard({ template, onEdit }: { template: ProductTemplate; onEdit: (packetId: string) => void }) {
  const imageUrl = template.thumbnailUrl || template.artworkUrl || template.packet?.compositeUrl;
  const productName = template.packet?.productName || template.name || "Untitled Template";
  const qrMode = template.packet?.qrProductState?.replace('qr_', '').toUpperCase();

  return (
    <Card className="overflow-hidden group" data-testid={`template-card-${template.id}`}>
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
          <Badge variant="secondary" className="absolute top-2 right-2">
            {template.selectedSize}
          </Badge>
        )}
        {template.packetId && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onEdit(template.packetId!)}
            data-testid={`button-edit-${template.id}`}
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-medium truncate" data-testid="text-template-name">
          {productName}
        </h3>
        <div className="flex flex-wrap gap-1">
          {qrMode && (
            <Badge variant="outline" className="text-xs">
              <QrCode className="h-3 w-3 mr-1" />
              {qrMode}
            </Badge>
          )}
          {template.enabledColors && template.enabledColors.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {template.enabledColors.length} colors
            </Badge>
          )}
          {template.enabledSizes && template.enabledSizes.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {template.enabledSizes.length} sizes
            </Badge>
          )}
        </div>
        {template.packet?.qrContent && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate" data-testid="text-qr-content">{template.packet.qrContent}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TemplatesTab() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ success: boolean; templates: ProductTemplate[] }>({
    queryKey: ["/api/test/templates", "library"],
    queryFn: async () => {
      const res = await fetch("/api/test/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const templates = data?.templates || [];

  const handleEdit = (packetId: string) => {
    navigate(`/test-store-builder?packetId=${packetId}`);
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
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Design Templates</h2>
          <p className="text-sm text-muted-foreground">
            Templates linked to product packets. Click Edit to modify (creates a new version).
          </p>
        </div>
        <Button onClick={() => navigate("/admin/products")} data-testid="button-go-to-builder">
          <Plus className="h-4 w-4 mr-2" />
          Create in Builder
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-templates">
            No templates saved yet. Use the Products Builder and assign to a store to create templates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="templates-grid">
          {templates.map(template => (
            <TemplateCard key={template.id} template={template} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </>
  );
}
