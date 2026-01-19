import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SkinGridViewer } from "@/features/shared/components/SkinGridViewer";
import { TemplateCardSkin, TemplateDetailSkin } from "@/features/shared/components/skins/TemplateSkin";
import type { SkinItem } from "@/features/shared/components/skins/types";

interface ProductTemplate {
  id: string;
  name?: string;
  packetId?: string;
  qrContent?: string;
  customerPrice?: number | string;
  pricing?: {
    customerPrice?: number;
  };
  createdAt?: string | null;
  packet?: {
    id: string;
    compositeUrl?: string;
    qrOnlyUrl?: string;
    qrContent?: string;
    headerText?: string;
    footerText?: string;
    qrProductState?: string;
    productName?: string;
  } | null;
}

function templateToSkinItem(template: ProductTemplate): SkinItem {
  const packet = template.packet;
  const price = typeof template.customerPrice === 'number' 
    ? template.customerPrice 
    : typeof template.customerPrice === 'string'
      ? parseFloat(template.customerPrice)
      : template.pricing?.customerPrice;

  return {
    id: template.id,
    packetId: template.packetId,
    name: packet?.productName || template.name || "Untitled Template",
    primaryImage: packet?.compositeUrl,
    secondaryImage: packet?.qrOnlyUrl,
    qrContent: packet?.qrContent || template.qrContent,
    headerText: packet?.headerText,
    footerText: packet?.footerText,
    qrMode: packet?.qrProductState?.replace('qr_', '').toUpperCase(),
    price: price,
    createdAt: template.createdAt,
  };
}

export default function TemplatesTab() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; templates: ProductTemplate[] }>({
    queryKey: ["/api/test/templates", "templates-tab"],
    queryFn: async () => {
      const res = await fetch("/api/test/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const templates = data?.templates || [];

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const template = templates.find(t => t.id === templateId);
      
      const templateRes = await fetch(`/api/test/templates/${templateId}`, { method: "DELETE" });
      if (!templateRes.ok) throw new Error("Failed to delete template");
      
      if (template?.packetId) {
        const packetRes = await fetch(`/api/test/packets/${template.packetId}`, { method: "DELETE" });
        if (!packetRes.ok) {
          console.warn("Failed to delete associated packet");
        }
      }
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/test/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/test/packets"] });
      toast({ title: "Deleted", description: "Template and packet have been deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    },
  });

  const templatesWithPackets = templates.filter(t => t.packet?.compositeUrl || t.packet?.qrOnlyUrl);
  const skinItems = templatesWithPackets.map(templateToSkinItem);

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

  if (templatesWithPackets.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg">
        <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground" data-testid="text-no-templates">
          No templates saved yet. Create a template from the Store Builder.
        </p>
      </div>
    );
  }

  return (
    <SkinGridViewer
      items={skinItems}
      CardSkin={TemplateCardSkin}
      DetailSkin={TemplateDetailSkin}
      actions={{
        onEdit: handleEdit,
        onDelete: handleDelete,
      }}
      isActionPending={deleteMutation.isPending}
      confirmAction={{
        type: "delete",
        title: "Delete this template?",
        description: "This will permanently delete the template and its associated packet. This action cannot be undone.",
      }}
    />
  );
}
