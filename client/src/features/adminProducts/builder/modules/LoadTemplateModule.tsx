import { useState, useEffect, useCallback } from "react";
import { FolderOpen, Loader2, Image, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { TemplateCardSkin } from "@/features/shared/components/skins/TemplateSkin";
import type { SkinItem } from "@/features/shared/components/skins/types";
import { useBuilderContext } from "../BuilderContext";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";

// Packet restoration consumes builderSnapshot; display projections are for thumbnails only.
type PacketInfo = Record<string, any>;

interface TemplateItem {
  builderSnapshot?: Record<string, any>;
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
    packetId: item.packetId || undefined,
    name,
    primaryImage,
    qrContent: item.packet?.qrContent || null,
    price,
    metadata: item,
  };
}

interface LoadTemplateModuleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideCard?: boolean;
}

export function LoadTemplateModule({ open: externalOpen, onOpenChange: onExternalOpenChange, hideCard }: LoadTemplateModuleProps = {}) {
  const { startFromTemplate, busy } = useBuilderContext();
  const { toast } = useToast();

  const controlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? externalOpen! : internalOpen;

  const setOpen = (v: boolean) => {
    if (!controlled) setInternalOpen(v);
    if (onExternalOpenChange) onExternalOpenChange(v);
  };

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);


  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await adminFetch<{ templates: TemplateItem[] }>("/templates");
      setTemplates(data.templates || []);
    } catch {
      toast({ title: "Could not load templates", variant: "destructive" });
    } finally {
      setLoadingTemplates(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const handleSelect = async (skinItem: SkinItem) => {
    if (selecting || busy || deletingId) return;
    setSelecting(true);
    try {
      await startFromTemplate(skinItem.metadata as TemplateItem);
      setOpen(false);
      toast({ title: 'Template loaded', description: 'A separate draft is ready to edit.' });
    } catch (error: any) {
      toast({ title: 'Could not load template', description: error.message, variant: 'destructive' });
    } finally { setSelecting(false); }
  };

  const handleDelete = useCallback(
    async (skinItem: SkinItem) => {
      const item = skinItem.metadata as TemplateItem;
      if (!window.confirm(`Delete template "${skinItem.name}"? This cannot be undone.`)) return;

      setDeletingId(item.id);
      try {
        await adminFetch(`/templates/${item.id}`, { method: "DELETE" });
        setTemplates((prev) => prev.filter((t) => t.id !== item.id));
        toast({ title: "Template deleted" });
      } catch (err: any) {
        toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      } finally {
        setDeletingId(null);
      }
    },
    [toast]
  );

  const skinItems: SkinItem[] = templates.map(templateToSkinItem);

  return (
    <div className="space-y-2">
      {!hideCard && (
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
      )}

      <ModalView
        open={open}
        onOpenChange={value => { if (!selecting && !busy) setOpen(value); }}
        title="Choose a Template"
        maxWidth="sm:max-w-2xl"
        className="max-sm:!fixed max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:!top-auto max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!w-full max-sm:!max-w-full max-sm:!rounded-t-2xl max-sm:!rounded-b-none max-sm:!h-[88svh] max-sm:!max-h-[88svh]"
      >
        <div className="p-4 overflow-y-auto h-full">
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
