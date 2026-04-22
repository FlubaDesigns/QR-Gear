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
  name?: string;
  productName?: string;
  thumbnailUrl?: string;
  artworkUrl?: string;
  updatedAt?: string;
  createdAt?: string;
  packetId?: string;
  packet?: PacketInfo | null;
  // Normalized picker fields returned by the backend
  previewTitle?: string;
  previewImageUrl?: string | null;
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return null; }
}

function TemplatePickerCard({
  item,
  onSelect,
}: {
  item: TemplateItem;
  onSelect: (item: TemplateItem) => void;
}) {
  // ── Image: layered fallbacks ────────────────────────────────────────────────
  const imageUrl =
    item.previewImageUrl ||
    item.packet?.priorityMockupUrl ||
    item.packet?.compositeUrl ||
    item.thumbnailUrl ||
    item.artworkUrl ||
    null;

  // ── Title: layered fallbacks ────────────────────────────────────────────────
  const title =
    item.previewTitle ||
    item.packet?.productName ||
    item.productName ||
    item.name ||
    'Untitled Template';

  // ── Subtitle: date or QR content for secondary cue ─────────────────────────
  const subtitle =
    item.packet?.qrContent ||
    formatDate(item.updatedAt) ||
    formatDate(item.createdAt) ||
    null;

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
            alt={title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Image className="h-8 w-8 opacity-40" />
            <span className="text-xs opacity-60">No preview</span>
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="font-medium text-sm truncate" data-testid="text-load-template-name">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            {item.packet?.qrContent
              ? <LinkIcon className="h-3 w-3 flex-shrink-0" />
              : null}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function LoadTemplateModule() {
  const { loadFromPacketData, setTemplateProductResolved, setActiveSession, state } = useBuilderContext();
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
    setSelecting(true);
    try {
      let packet = item.packet;

      // Snapshot missing but packetId present — fetch the packet live
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
        toast({ title: "Template has no packet data", description: "The packet linked to this template could not be found.", variant: "destructive" });
        return;
      }

      console.log(`[LoadTemplateModule] Loading template ${item.id} | packet ${packet.id}`);

      const resolvedProduct = await resolveProduct(packet);
      console.log(`[LoadTemplateModule] Resolved product: ${resolvedProduct?.title ?? 'NOT FOUND'} (docId: ${resolvedProduct?.docId ?? 'none'})`);

      // Clear any prior session BEFORE hydrating the UI so the autosave effect
      // does not write the incoming template state into the wrong (previous) session.
      setActiveSession(null, null, null);

      // Determine sourceMasterId: prefer Firestore doc ID, fall back to the
      // packet's productId (numeric blueprint — the CF handles the numeric→doc lookup).
      const sourceMasterId: string | null =
        resolvedProduct?.docId ||
        (packet.productId ? String(packet.productId) : null) ||
        (packet.blueprintId ? String(packet.blueprintId) : null);

      if (sourceMasterId) {
        try {
          const headers = await getAuthHeaders();
          const sessionRes = await fetch(`${apiBase}/build-sessions/from-master`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceMasterId }),
          });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            console.log(
              `[LoadTemplateModule] Session ${sessionData.isExisting ? 'resumed' : 'created'}: ${sessionData.sessionId} ` +
              `(sourceMasterId: ${sourceMasterId})`
            );
            // Set session and hydrate UI together — React 18 batches these into one
            // render, so the autosave effect sees the correct session + template content
            // at the same time, preventing a blank-state overwrite of the new session.
            setActiveSession(sessionData.sessionId, 'working', null);
          } else {
            const errBody = await sessionRes.json().catch(() => ({}));
            console.warn(`[LoadTemplateModule] Session creation failed (${sessionRes.status}):`, errBody);
            // Builder will load the template visually but autosave will be inactive
            // until the user selects the product from the picker (which creates a session).
          }
        } catch (e) {
          console.warn('[LoadTemplateModule] Session creation error:', e);
        }
      } else {
        console.warn('[LoadTemplateModule] No sourceMasterId available — template loaded without a session. Autosave inactive.');
      }

      // Always hydrate the builder from the template, regardless of session outcome.
      // Called after setActiveSession so React 18 can batch both state updates in
      // one render, ensuring autosave fires with the correct session + template state.
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
  }, [apiBase, getAuthHeaders, loadFromPacketData, resolveProduct, setActiveSession, toast]);

  const handleDismissBanner = useCallback(() => {
    setTemplateProductResolved(null);
  }, [setTemplateProductResolved]);

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
