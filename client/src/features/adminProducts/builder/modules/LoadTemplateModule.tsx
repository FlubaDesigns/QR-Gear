import { useState, useEffect, useCallback } from "react";
import { FolderOpen, Loader2, AlertTriangle, X, Image, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { TemplateCardSkin } from "@/features/shared/components/skins/TemplateSkin";
import type { SkinItem } from "@/features/shared/components/skins/types";
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
  name?: string;
  productName?: string;
  thumbnailUrl?: string;
  artworkUrl?: string;
  updatedAt?: string;
  createdAt?: string;
  packetId?: string;
  packet?: PacketInfo | null;
  previewTitle?: string;
  previewImageUrl?: string | null;
  previewPrice?: number | null;
}

function templateToSkinItem(item: TemplateItem): SkinItem {
  const primaryImage =
    item.previewImageUrl ||
    item.packet?.priorityMockupUrl ||
    item.packet?.compositeUrl ||
    item.thumbnailUrl ||
    item.artworkUrl ||
    null;

  const name =
    item.previewTitle ||
    item.packet?.productName ||
    item.productName ||
    item.name ||
    "Untitled Template";

  const price: number | null =
    typeof item.previewPrice === "number" ? item.previewPrice : null;

  return {
    id: item.id,
    packetId: item.packetId || null,
    name,
    primaryImage,
    qrContent: item.packet?.qrContent || null,
    price,
    metadata: item,
  };
}

export function LoadTemplateModule() {
  const { loadFromPacketData, setTemplateProductResolved, setActiveSession, state } = useBuilderContext();
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  }, [getAuthHeaders, toast]);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const resolveProduct = useCallback(
    async (packet: PacketInfo): Promise<CatalogProduct | null> => {
      const provider = packet.fulfillmentProvider || "printify";
      const blueprintId = packet.blueprintId;
      if (!blueprintId) return null;

      try {
        const res = await fetch(`/api/master-catalog`);
        if (!res.ok) return null;
        const data = await res.json();
        const allCategories: Array<{ items: CatalogProduct[] }> = Array.isArray(data) ? data : [];
        for (const cat of allCategories) {
          const items: CatalogProduct[] = cat.items || [];
          const match = items.find((p) => {
            if (provider === "printful")
              return p.fulfillmentProvider === "printful" && Number(p.id) === Number(blueprintId);
            return (
              (!p.fulfillmentProvider || p.fulfillmentProvider === "printify") &&
              Number(p.blueprintId || p.id) === Number(blueprintId)
            );
          });
          if (match) return match;
        }
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  const handleSelect = useCallback(
    async (skinItem: SkinItem) => {
      setSelecting(true);
      try {
        const item = skinItem.metadata as TemplateItem;
        let packet = item.packet;

        if (!packet && item.packetId) {
          const headers = await getAuthHeaders();
          const res = await fetch(`${apiBase}/packets/${item.packetId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            const p = data.landingPage || data.packet || data;
            if (p && (p.packetId || p.id)) {
              packet = { ...p, id: p.packetId || p.id };
            }
          }
        }

        if (!packet) {
          toast({
            title: "Template has no packet data",
            description: "The packet linked to this template could not be found.",
            variant: "destructive",
          });
          return;
        }

        console.log(`[LoadTemplateModule] Loading template ${item.id} | packet ${packet.id}`);

        const resolvedProduct = await resolveProduct(packet);
        console.log(
          `[LoadTemplateModule] Resolved product: ${resolvedProduct?.title ?? "NOT FOUND"} (docId: ${resolvedProduct?.docId ?? "none"})`
        );

        setActiveSession(null, null, null);

        const sourceMasterId: string | null =
          resolvedProduct?.docId ||
          (packet.productId ? String(packet.productId) : null) ||
          (packet.blueprintId ? String(packet.blueprintId) : null);

        if (sourceMasterId) {
          try {
            const headers = await getAuthHeaders();
            const sessionRes = await fetch(`${apiBase}/build-sessions/from-master`, {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ sourceMasterId }),
            });
            if (sessionRes.ok) {
              const sessionData = await sessionRes.json();
              console.log(
                `[LoadTemplateModule] Session ${sessionData.isExisting ? "resumed" : "created"}: ${sessionData.sessionId} ` +
                  `(sourceMasterId: ${sourceMasterId})`
              );
              setActiveSession(sessionData.sessionId, "working", null);
            } else {
              const errBody = await sessionRes.json().catch(() => ({}));
              console.warn(`[LoadTemplateModule] Session creation failed (${sessionRes.status}):`, errBody);
            }
          } catch (e) {
            console.warn("[LoadTemplateModule] Session creation error:", e);
          }
        } else {
          console.warn(
            "[LoadTemplateModule] No sourceMasterId — template loaded without session. Autosave inactive."
          );
        }

        loadFromPacketData(packet, resolvedProduct);

        if (!resolvedProduct && packet.blueprintId) {
          toast({
            title: "Template loaded",
            description: `The original product "${packet.productName || "Unknown"}" isn't available — please select a replacement below.`,
          });
        } else {
          toast({
            title: "Template loaded",
            description: "All settings restored. Make your changes and create a new packet.",
          });
        }
        setOpen(false);
      } catch {
        toast({ title: "Failed to load template", variant: "destructive" });
      } finally {
        setSelecting(false);
      }
    },
    [apiBase, getAuthHeaders, loadFromPacketData, resolveProduct, setActiveSession, toast]
  );

  const handleDelete = useCallback(
    async (skinItem: SkinItem) => {
      const item = skinItem.metadata as TemplateItem;
      if (!window.confirm(`Delete template "${skinItem.name}"? This cannot be undone.`)) return;

      setDeletingId(item.id);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/templates/${item.id}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        setTemplates((prev) => prev.filter((t) => t.id !== item.id));
        toast({ title: "Template deleted" });
      } catch (err: any) {
        toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      } finally {
        setDeletingId(null);
      }
    },
    [getAuthHeaders, toast]
  );

  const handleDismissBanner = useCallback(() => {
    setTemplateProductResolved(null);
  }, [setTemplateProductResolved]);

  const skinItems: SkinItem[] = templates.map(templateToSkinItem);

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
        <div
          className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md"
          data-testid="banner-product-unavailable"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Original product not available
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              "{hint.productName || "Unknown product"}" wasn't found in your catalog. Select a replacement
              product below to continue.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismissBanner}
            className="flex-shrink-0 text-amber-600 dark:text-amber-400"
            data-testid="button-dismiss-unavailable"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <ModalView open={open} onOpenChange={setOpen} title="Choose a Template">
        <div className="p-4">
          <ScrollGridView
            items={skinItems}
            isLoading={loadingTemplates}
            height="60vh"
            columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            emptyMessage="No templates saved yet. Create and save a packet to see it here."
            emptyIcon={
              <Image className="h-12 w-12 mx-auto mb-3 opacity-40 text-muted-foreground" />
            }
            renderItem={(skinItem) => (
              <div className="relative">
                {selecting && deletingId !== skinItem.id && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-md">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 z-10"
                  disabled={deletingId === skinItem.id || selecting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(skinItem);
                  }}
                  data-testid={`button-delete-template-${skinItem.id}`}
                >
                  {deletingId === skinItem.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
                <TemplateCardSkin
                  item={skinItem}
                  onClick={() => !selecting && handleSelect(skinItem)}
                />
              </div>
            )}
          />
        </div>
      </ModalView>
    </div>
  );
}
