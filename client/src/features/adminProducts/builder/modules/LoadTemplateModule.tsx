import { useState, useEffect, useCallback } from "react";
import { FolderOpen, Loader2, AlertTriangle, X, Image, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { authFetch } from "@/features/adminAuth/authFetch";
import { useToast } from "@/hooks/use-toast";
import type { CatalogProduct } from "../types";

interface PacketInfo {
  id: string;
  compositeUrl?: string;
  qrOnlyUrl?: string;
  qrContent?: string;
  headerText?: string;
  footerText?: string;
  qrProductState?: string;
  productName?: string;
  priorityMockupUrl?: string | null;
  landingPageSnapshotUrl?: string | null;
  blueprintId?: number | null;
  printProviderId?: number | null;
  productId?: number | null;
  fulfillmentProvider?: string;
  defaultColor?: string;
  defaultColorHex?: string;
  placements?: string[];
  placementConfig?: Record<string, string>;
  placementSizes?: Record<string, string>;
  headerStyle?: Record<string, any>;
  footerStyle?: Record<string, any>;
  subBottomEnabled?: boolean;
  subBottomText?: string;
  subBottomFontFamily?: string;
  subBottomFontSize?: string;
  subBottomFontWeight?: string;
  subBottomColor?: string;
  qrContent2?: string;
  landingPageTitle?: string;
  landingPageDescription?: string;
  backgroundUrl?: string;
  landingPageBackgroundUrl?: string;
  builderSnapshot?: { content?: Record<string, any> };
  [key: string]: any;
}

interface TemplateItem {
  id: string;
  name: string;
  packetId?: string;
  packet?: PacketInfo | null;
}

function TemplatePickerCard({
  item,
  onSelect,
}: {
  item: TemplateItem;
  onSelect: (item: TemplateItem) => void;
}) {
  const packet = item.packet;
  const imageUrl = packet?.priorityMockupUrl || packet?.compositeUrl;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onSelect(item)}
      data-testid={`load-template-card-${item.id}`}
    >
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-10 w-10" />
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="font-medium text-sm truncate" data-testid="text-load-template-name">
          {packet?.productName || item.name}
        </p>
        {packet?.qrContent && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            {packet.qrContent}
          </p>
        )}
        {packet?.headerText && (
          <p className="text-xs text-muted-foreground truncate">
            {packet.headerText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function LoadTemplateModule() {
  const { loadFromPacketData, setTemplateProductResolved, state } = useBuilderContext();
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const hint = state.templateProductHint;
  const productUnavailable = !!hint && !state.selectedProduct;

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await authFetch(`/api/admin/templates`, getAuthHeaders);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast({ title: "Could not load templates", variant: "destructive" });
    } finally {
      setLoadingTemplates(false);
    }
  }, [apiBase, getAuthHeaders, toast]);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const resolveProduct = useCallback(async (packet: PacketInfo): Promise<CatalogProduct | null> => {
    const provider = packet.fulfillmentProvider || 'printify';
    const blueprintId = packet.blueprintId;
    if (!blueprintId) return null;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/master-catalog`);
      if (!res.ok) return null;
      const data = await res.json();
      const allCategories: Array<{ items: CatalogProduct[] }> = Array.isArray(data) ? data : [];
      for (const cat of allCategories) {
        const items: CatalogProduct[] = cat.items || [];
        const match = items.find(p => {
          if (provider === 'printful') return p.fulfillmentProvider === 'printful' && Number(p.id) === Number(blueprintId);
          return (!p.fulfillmentProvider || p.fulfillmentProvider === 'printify') && Number(p.blueprintId || p.id) === Number(blueprintId);
        });
        if (match) return match;
      }
      return null;
    } catch {
      return null;
    }
  }, [apiBase, getAuthHeaders]);

  const handleSelect = useCallback(async (item: TemplateItem) => {
    const packet = item.packet;
    if (!packet) {
      toast({ title: "Template has no packet data", variant: "destructive" });
      return;
    }

    setSelecting(true);
    try {
      const resolvedProduct = await resolveProduct(packet);
      loadFromPacketData(packet, resolvedProduct);

      if (!resolvedProduct && packet.blueprintId) {
        toast({
          title: "Template loaded",
          description: `The original product "${packet.productName || 'Unknown'}" isn't available — please select a replacement below.`,
        });
      } else {
        toast({ title: "Template loaded", description: "All settings restored. Make your changes and create a new packet." });
      }
      setOpen(false);
    } catch {
      toast({ title: "Failed to load template", variant: "destructive" });
    } finally {
      setSelecting(false);
    }
  }, [loadFromPacketData, resolveProduct, toast]);

  const handleDismissBanner = useCallback(() => {
    setTemplateProductResolved(null);
  }, [setTemplateProductResolved]);

  const skinItems = templates.map(t => ({
    id: t.id,
    name: t.packet?.productName || t.name || 'Untitled',
    primaryImage: t.packet?.priorityMockupUrl || t.packet?.compositeUrl,
    secondaryImage: t.packet?.compositeUrl,
    qrContent: t.packet?.qrContent,
    headerText: t.packet?.headerText,
    footerText: t.packet?.footerText,
  }));

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/40 rounded-md border">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">Start from a template</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Load a saved design and create a new packet from it
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="default"
          onClick={() => setOpen(true)}
          data-testid="button-load-template"
          className="w-full sm:w-auto flex-shrink-0"
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Load Template
        </Button>
      </div>

      {productUnavailable && hint && (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md" data-testid="banner-product-unavailable">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Original product not available
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              "{hint.productName || 'Unknown product'}" wasn't found in your catalog. Select a replacement product below to continue.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismissBanner}
            className="flex-shrink-0 h-6 w-6 text-amber-600 dark:text-amber-400"
            data-testid="button-dismiss-unavailable"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <ModalView
        open={open}
        onOpenChange={setOpen}
        title="Choose a Template"
      >
        <div className="p-4">
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-16" data-testid="loader-template-picker">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Image className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No templates saved yet.</p>
              <p className="text-xs mt-1">Create and save a packet to have it appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {templates.map(item => (
                <div key={item.id} className="relative">
                  {selecting && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                  <TemplatePickerCard item={item} onSelect={handleSelect} />
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalView>
    </div>
  );
}
