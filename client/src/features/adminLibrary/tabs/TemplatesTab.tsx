import { useState, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Image, ChevronLeft, ChevronRight, X, ImageIcon, Layers, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { TemplateCardSkin, TemplateDetailSkin } from "@/features/shared/components/skins/TemplateSkin";
import type { SkinItem } from "@/features/shared/components/skins/types";
import { adminFetch } from "@/lib/adminFetch";

// ── Types ─────────────────────────────────────────────────────────────────────

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
    priorityMockupUrl?: string | null;
    landingPageSnapshotUrl?: string | null;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function templateToSkinItem(template: ProductTemplate): SkinItem {
  const packet = template.packet;
  const price = typeof template.customerPrice === "number"
    ? template.customerPrice
    : typeof template.customerPrice === "string"
      ? parseFloat(template.customerPrice)
      : template.pricing?.customerPrice;

  const images: { url: string; label: string }[] = [];
  if (packet?.priorityMockupUrl) images.push({ url: packet.priorityMockupUrl, label: "Mockup" });
  if (packet?.compositeUrl)       images.push({ url: packet.compositeUrl,       label: "Graphic" });
  if (packet?.landingPageSnapshotUrl) images.push({ url: packet.landingPageSnapshotUrl, label: "Landing Page" });

  return {
    id:           template.id,
    packetId:     template.packetId,
    name:         packet?.productName || template.name || "Untitled Template",
    primaryImage: packet?.priorityMockupUrl || packet?.compositeUrl,
    secondaryImage: packet?.compositeUrl,
    images:       images.length > 0 ? images : undefined,
    qrContent:    packet?.qrContent || template.qrContent,
    headerText:   packet?.headerText,
    footerText:   packet?.footerText,
    // Fix 2: qrMode label preserved — mode comes from qrProductState but images are Mockup/Graphic
    qrMode:       packet?.qrProductState?.replace("qr_", "").toUpperCase(),
    price:        typeof price === "number" && !isNaN(price) ? price : null,
    createdAt:    template.createdAt,
  };
}

// ── Error boundary ────────────────────────────────────────────────────────────

// Fix 5: Error boundary so crashes are recoverable
class TemplatesBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TemplatesTab] CRASH:", error.message, error.stack);
    console.error("[TemplatesTab] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
          <h3 className="font-bold text-lg mb-2">Templates Error</h3>
          <p className="text-sm mb-2">{this.state.error?.message}</p>
          <pre className="text-xs overflow-auto max-h-40 bg-black/20 p-2 rounded">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded"
            data-testid="button-retry-templates"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Inner tab ─────────────────────────────────────────────────────────────────

function TemplatesTabInner() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showPrimary,   setShowPrimary]   = useState(true);
  const [showConfirm,   setShowConfirm]   = useState(false);

  // Fix 1: destructure error from useQuery
  const { data, isLoading, error: queryError } = useQuery<{ success: boolean; templates: ProductTemplate[] }>({
    queryKey: ["/api/admin/templates", "templates-tab"],
    queryFn:  () => adminFetch<{ success: boolean; templates: ProductTemplate[] }>("/templates"),
  });

  const templates = data?.templates ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const template = templates.find(t => t.id === templateId);
      await adminFetch(`/templates/${templateId}`, { method: "DELETE" });
      if (template?.packetId) {
        try {
          await adminFetch(`/packets/${template.packetId}`, { method: "DELETE" });
        } catch (err) {
          // Fix 4: surface packet delete failures instead of swallowing them
          console.error("[TemplatesTab] Packet delete failed:", err);
          toast({
            title: "Template deleted — packet not removed",
            description: "The template was deleted but its linked packet could not be removed. Check the Packets section.",
            variant: "destructive",
          });
        }
      }
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packets"] });
      toast({ title: "Deleted", description: "Template and packet have been deleted" });
      // Fix 3: clear modal state so it doesn't stay open on a deleted item
      setSelectedIndex(null);
      setShowPrimary(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    },
  });

  const skinItems = templates.map(templateToSkinItem);

  const selectedItem    = selectedIndex !== null ? skinItems[selectedIndex] : null;
  const hasPrev         = selectedIndex !== null && selectedIndex > 0;
  const hasNext         = selectedIndex !== null && selectedIndex < skinItems.length - 1;
  // Fix 2: label correctly — primaryImage is the mockup, secondaryImage is the graphic
  const hasSecondaryImage = !!(selectedItem?.secondaryImage && selectedItem?.primaryImage);
  const displayImage    = selectedItem
    ? (showPrimary ? selectedItem.primaryImage : selectedItem.secondaryImage) || selectedItem.primaryImage || selectedItem.secondaryImage
    : null;

  const handlePrev  = () => { if (hasPrev) { setSelectedIndex(selectedIndex! - 1); setShowPrimary(true); } };
  const handleNext  = () => { if (hasNext) { setSelectedIndex(selectedIndex! + 1); setShowPrimary(true); } };
  const handleClose = () => { setSelectedIndex(null); setShowPrimary(true); };

  const handleEdit   = (packetId: string) => navigate(`/admin/store-builder?packetId=${packetId}`);
  const handleDelete = (templateId: string) => deleteMutation.mutate(templateId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-templates">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Fix 7: GRF context note */}
      <div
        className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 mb-4"
        data-testid="info-grf-templates"
      >
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Product templates. Graphics embedded here should be GRF-07-5-NNNNNN (template_graphic) assets. Mint them from the Graphics tab.
        </p>
      </div>

      {/* Fix 1: show query error */}
      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4" data-testid="error-templates">
          <p className="text-sm font-medium">Failed to load templates</p>
          <p className="text-xs text-muted-foreground">{(queryError as Error).message}</p>
        </div>
      )}

      {/* Fix 6: template count header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" data-testid="text-template-count">{templates.length} Templates</h3>
      </div>

      {templates.length === 0 && !queryError ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-templates">
            No templates saved yet. Create a template from the Store Builder.
          </p>
        </div>
      ) : (
        <ScrollGridView
          items={skinItems}
          columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          height="auto"
          emptyMessage="No items to display."
          emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
          footer={null}
          renderItem={(item, index) => (
            <TemplateCardSkin
              item={item}
              actions={{ onEdit: handleEdit, onDelete: handleDelete }}
              onClick={() => setSelectedIndex(index)}
            />
          )}
        />
      )}

      <ModalView
        open={selectedIndex !== null}
        onOpenChange={(open) => !open && handleClose()}
        title={selectedItem?.name || "Item Preview"}
        showCloseButton={false}
      >
        <div className="relative">
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70"
            onClick={handleClose}
            data-testid="button-gallery-close"
          >
            <X className="h-5 w-5 text-white" />
          </Button>

          <div className="relative aspect-square sm:aspect-video bg-muted flex items-center justify-center">
            {displayImage ? (
              <img
                src={displayImage}
                alt={selectedItem?.name || "Preview"}
                className="max-w-full max-h-full object-contain"
                data-testid="img-gallery-preview"
              />
            ) : (
              <ImageIcon className="h-24 w-24 text-muted-foreground" />
            )}

            {hasPrev && (
              <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={handlePrev} data-testid="button-gallery-prev">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {hasNext && (
              <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={handleNext} data-testid="button-gallery-next">
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            {/* Fix 2: correct labels — primary = Mockup, secondary = Graphic */}
            {hasSecondaryImage && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  variant={showPrimary ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setShowPrimary(true)}
                  data-testid="button-show-mockup"
                >
                  Mockup
                </Button>
                <Button
                  variant={!showPrimary ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setShowPrimary(false)}
                  data-testid="button-show-graphic"
                >
                  Graphic
                </Button>
              </div>
            )}

            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {(selectedIndex ?? 0) + 1} / {skinItems.length}
            </div>
          </div>

          <div className="p-4 border-t flex flex-col items-center">
            {selectedItem && (
              <TemplateDetailSkin
                item={selectedItem}
                actions={{
                  onEdit:   handleEdit,
                  onDelete: () => setShowConfirm(true),
                }}
                isActionPending={deleteMutation.isPending}
                onClose={handleClose}
                onPrev={handlePrev}
                onNext={handleNext}
                hasPrev={hasPrev}
                hasNext={hasNext}
              />
            )}
          </div>
        </div>
      </ModalView>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template and its associated packet. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedItem) handleDelete(selectedItem.id);
                setShowConfirm(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-action"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function TemplatesTab() {
  return (
    <TemplatesBoundary>
      <TemplatesTabInner />
    </TemplatesBoundary>
  );
}
