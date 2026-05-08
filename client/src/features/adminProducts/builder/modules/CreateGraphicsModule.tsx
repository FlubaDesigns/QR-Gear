import { useState, useEffect } from "react";
import { Package, Loader2, Check, BookmarkCheck, CheckCircle2, Copy, Pencil, QrCode, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { ImageModalView } from "@/features/shared/components/views/ModalView";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { adminFetch } from "@/lib/adminFetch";
import { GRF_PACKET_SLOTS } from "@shared/GRF_engine";
import { useToast } from "@/hooks/use-toast";
import type { PricingBreakdown } from "../types";
import { PacketResultDisplay } from "./PacketResultDisplay";
import { useCreatePacket } from "./useCreatePacket";

interface HostingTier {
  code: string;
  name: string;
  price: number;
}

interface PricingSettings {
  markupPercent: number;
  markupFixed: number;
  additionalPlacementCost: number;
  textLineUpcharge: number;
  hostingTiers: HostingTier[];
}

export interface PacketResult {
  packetId: string;
  landingPageUrl: string;
  landingPageSnapshotUrl: string;
  productGraphicUrl: string;
  qrOnlyUrl: string;
  pricing: PricingBreakdown;
  priorityMockupUrl?: string | null;
  priorityMockupLoading?: boolean;
  priorityMockupError?: string | null;
  compositeUrl?: string | null;
  assemblyId?: string | null;
  printifyProductId?: string | null;
  printifyPublishedAt?: string | Date | null;
  printifyVariantMap?: Record<string, number> | null;
  enabledColors?: string[];
}

export function CreateGraphicsModule() {
  const { state, setContent, loadGraphic, selectedRole, selectedStore, selectedChannel, selectedCollection, resetBuilder, setActivePacketId, setActiveSession } = useBuilderContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [thumbnailLightbox, setThumbnailLightbox] = useState<string | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  const [isCloningSession, setIsCloningSession] = useState(false);
  const [isSavingQr, setIsSavingQr] = useState(false);
  const [isSavingCanvas, setIsSavingCanvas] = useState(false);
  const [qrSaved, setQrSaved] = useState(false);
  const [canvasSaved, setCanvasSaved] = useState(false);

  const hasActiveSession = !!state.activeSessionId;
  const sessionStatus = state.sessionStatus;

  const { data: pricingSettings } = useQuery<PricingSettings>({
    queryKey: ["/api/pricing-settings"],
    queryFn: async () => {
      const res = await fetch(`/api/pricing-settings`);
      if (!res.ok) throw new Error(`pricing-settings HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60000,
  });

  // Auto-seed content.title from full folder path when not already set
  useEffect(() => {
    if (!state.content?.title) {
      const parts = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name].filter(Boolean);
      if (parts.length > 0) {
        setContent({ title: parts.join(' / ') });
      }
    }
  }, [selectedStore?.name, selectedChannel?.name, selectedCollection?.name]);

  const isPlayMode = state.qrProductState === "qr_play";
  const isBasicsOrPlusMode = state.qrProductState === "qr_basics" || state.qrProductState === "qr_plus";

  const validationErrors: string[] = [];
  if (!selectedCollection) {
    validationErrors.push("Select a collection (folder) above before creating a packet");
  }
  const canCreate = validationErrors.length === 0;

  const {
    isCreating, packetResult, error, isDeleting,
    isCommitting, artifactError, handleCreatePacket, handleNext, handleReset, handleDeletePacket,
    handleCommitSession, setPacketResult,
  } = useCreatePacket({
    state, selectedRole, selectedStore, selectedChannel, selectedCollection,
    loadGraphic, resetBuilder, pricingSettings,
  });

  // Reset save state whenever a new packet is created
  useEffect(() => {
    if (packetResult?.packetId) {
      setActivePacketId(packetResult.packetId);
      setQrSaved(false);
      setCanvasSaved(false);
    }
  }, [packetResult?.packetId]);

  const graphicName = (() => {
    const parts = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : (state.content?.title || null);
  })();

  const handleSaveQrGraphic = async () => {
    if (isSavingQr || !packetResult?.qrOnlyUrl) return;
    setIsSavingQr(true);
    try {
      await adminFetch('/graphics/save-grf', {
        method: 'POST',
        json: {
          ...GRF_PACKET_SLOTS.qrStandalone,
          imageUrl: packetResult.qrOnlyUrl,
          name: graphicName ? `${graphicName} — QR Standalone` : 'QR Standalone',
          relatedPacketId: packetResult.packetId || null,
        },
      });
      setQrSaved(true);
      toast({ title: 'QR Graphic saved to library' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSavingQr(false);
    }
  };

  const handleSaveCanvasDesign = async () => {
    if (isSavingCanvas || !packetResult?.compositeUrl) return;
    setIsSavingCanvas(true);
    try {
      await adminFetch('/graphics/save-grf', {
        method: 'POST',
        json: {
          ...GRF_PACKET_SLOTS.qrComposite,
          imageUrl: packetResult.compositeUrl,
          name: graphicName ? `${graphicName} — QR Composite` : 'QR Composite',
          relatedPacketId: packetResult.packetId || null,
        },
      });
      setCanvasSaved(true);
      toast({ title: 'Canvas Design saved to library' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSavingCanvas(false);
    }
  };

  // When re-selecting a product whose session already has a packet, restore
  // the PacketResultDisplay automatically instead of showing "Create Packet".
  useEffect(() => {
    if (!state.activePacketId || packetResult || (sessionStatus !== 'artifact_ready' && sessionStatus !== 'committed')) return;
    let cancelled = false;

    const restore = async () => {
      try {
        interface PacketGetResponse { success: boolean; packet: Record<string, unknown>; landingPage?: Record<string, unknown> }
        const data = await adminFetch<PacketGetResponse>(`/packets/${state.activePacketId}`);
        if (cancelled) return;
        const p: Record<string, unknown> = data.landingPage || data.packet || (data as unknown as Record<string, unknown>);
        // Accept either `packetId` (legacy field) or `id` (canonical Firestore doc id)
        if (!p || (!p.packetId && !p.id) || cancelled) return;
        const rawColors: unknown[] = (p.colors as unknown[] | undefined) || (p.enabledColors as unknown[] | undefined) || [];
        const enabledColors: string[] = rawColors
          .map((c) => (typeof c === 'string' ? c : (c as Record<string, string>)?.name || (c as Record<string, string>)?.label || null))
          .filter((c): c is string => typeof c === 'string' && c.length > 0);
        const str = (v: unknown): string => (typeof v === 'string' ? v : '');
        const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
        setPacketResult({
          packetId: state.activePacketId ?? '',
          landingPageUrl: str(p.qrContent) || str(p.landingPageUrl),
          landingPageSnapshotUrl: str(p.landingPageSnapshotUrl),
          productGraphicUrl: str(p.productGraphicUrl) || str(p.compositeUrl),
          qrOnlyUrl: str(p.qrOnlyUrl),
          pricing: p.pricing as PricingBreakdown,
          priorityMockupUrl: strOrNull(p.priorityMockupUrl),
          priorityMockupLoading: false,
          compositeUrl: strOrNull(p.compositeUrl),
          assemblyId: strOrNull(p.assemblyId),
          printifyProductId: strOrNull(p.printifyProductId),
          printifyPublishedAt: strOrNull(p.printifyPublishedAt),
          printifyVariantMap: (p.printifyVariantMap as Record<string, number> | null | undefined) ?? null,
          enabledColors,
        });
        console.log(`[CreateGraphicsModule] Restored packetResult for ${state.activePacketId}`);
      } catch {
        // silent — fallback to showing Create Packet button
      }
    };

    restore();
    return () => { cancelled = true; };
  }, [state.activePacketId, packetResult, sessionStatus]);

  const handleUpdateSaved = async () => {
    if (isReopening || !state.activeSessionId) return;
    setIsReopening(true);
    try {
      const data = await adminFetch<any>(`/build-sessions/${state.activeSessionId}/reopen`, {
        method: "POST",
        json: {},
      });
      setActiveSession(state.activeSessionId, 'working', data.committedInstanceId || state.committedInstanceId);
      toast({ title: 'Ready to edit', description: 'Make changes, create a new packet, then save as admin instance.' });
    } catch (err: any) {
      toast({ title: 'Could not reopen', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsReopening(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (isCloningSession || !state.activeSessionId) return;
    setIsCloningSession(true);
    try {
      const data = await adminFetch<any>("/build-sessions/clone", {
        method: "POST",
        json: { sourceSessionId: state.activeSessionId },
      });
      window.location.href = `/admin/products?resume=${data.sessionId}`;
    } catch (err: any) {
      toast({ title: 'Could not save as new', description: err.message || 'Please try again.', variant: 'destructive' });
      setIsCloningSession(false);
    }
  };

  if (!state.selectedProduct || !state.qrProductState || !state.content) {
    return null;
  }

  return (
    <CollapsibleModule
      title="Create Packet"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {!packetResult && (
          <>
            {validationErrors.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/50 rounded-md border border-amber-200 dark:border-amber-800">
                <p className="text-base font-semibold text-amber-700 dark:text-amber-300 mb-3">Complete these items first:</p>
                <ul className="text-base text-amber-600 dark:text-amber-400 list-disc list-inside space-y-2">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationErrors.length === 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-md border border-green-200 dark:border-green-800">
                <p className="text-base text-green-700 dark:text-green-300 flex items-center gap-3">
                  <Check className="h-5 w-5" />
                  Ready to create your product packet
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={!canCreate || isCreating}
              onClick={handleCreatePacket}
              className={`qr-btn qr-btn--primary qr-btn--touch qr-btn--full qr-btn--xxl ${(!canCreate || isCreating) ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid="button-create-packet"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin" />
                  Creating Packet...
                </>
              ) : (
                <>
                  <Package className="h-7 w-7" />
                  Create Packet
                </>
              )}
            </button>
          </>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-md border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {packetResult && (
          <PacketResultDisplay
            packetResult={packetResult}
            selectedColor={state.selectedColor}
            selectedStore={selectedStore}
            selectedChannel={selectedChannel}
            isPlayMode={isPlayMode}
            isBasicsOrPlusMode={isBasicsOrPlusMode}
            pricingSettings={pricingSettings}
            isDeleting={isDeleting}
            thumbnailLightbox={thumbnailLightbox}
            onThumbnailLightbox={setThumbnailLightbox}
            onNext={handleNext}
            onReset={handleReset}
            onDelete={handleDeletePacket}
            artifactError={artifactError}
            onPrintifyPublished={(result) => {
              setPacketResult((prev: PacketResult | null) => prev ? {
                ...prev,
                printifyProductId: result.printifyProductId,
                enabledColors: result.enabledColors,
                printifyPublishedAt: result.printifyPublishedAt,
                printifyVariantMap: result.printifyVariantMap,
              } : prev);
            }}
          />
        )}

        {/* Save to Library — shown whenever a packet has saveable graphic URLs */}
        {packetResult && (packetResult.qrOnlyUrl || packetResult.compositeUrl) && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Save graphics to library</p>
            <div className="flex flex-wrap gap-2">
              {packetResult.qrOnlyUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveQrGraphic}
                  disabled={isSavingQr || qrSaved}
                  data-testid="button-save-qr-graphic"
                >
                  {isSavingQr ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : qrSaved ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                  ) : (
                    <QrCode className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {qrSaved ? 'QR Saved' : 'Save QR Graphic'}
                </Button>
              )}
              {packetResult.compositeUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveCanvasDesign}
                  disabled={isSavingCanvas || canvasSaved}
                  data-testid="button-save-canvas-design"
                >
                  {isSavingCanvas ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : canvasSaved ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                  ) : (
                    <Layers className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {canvasSaved ? 'Canvas Saved' : 'Save Canvas Design'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Build session commit — only shown when session artifact is ready */}
        {packetResult && hasActiveSession && sessionStatus === 'artifact_ready' && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs text-muted-foreground">
              Packet is ready. Save this as a permanent admin catalog instance.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={handleCommitSession}
              disabled={isCommitting}
              data-testid="button-commit-session"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                <>
                  <BookmarkCheck className="h-4 w-4 mr-2" />
                  Save as Admin Instance
                </>
              )}
            </Button>
          </div>
        )}

        {/* Committed confirmation + Phase 2 actions */}
        {packetResult && hasActiveSession && sessionStatus === 'committed' && (
          <div className="pt-2 border-t space-y-3">
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2" data-testid="status-committed-confirm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Saved as admin catalog instance
              {state.committedInstanceId && (
                <span className="text-xs text-muted-foreground ml-1">({state.committedInstanceId.slice(0, 8)}…)</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpdateSaved}
                disabled={isReopening}
                data-testid="button-update-saved"
              >
                {isReopening
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <Pencil className="h-3.5 w-3.5 mr-1.5" />
                }
                Update Saved Item
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAsNew}
                disabled={isCloningSession}
                data-testid="button-save-as-new"
              >
                {isCloningSession
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <Copy className="h-3.5 w-3.5 mr-1.5" />
                }
                Save as New
              </Button>
            </div>
          </div>
        )}

        <ImageModalView
          imageUrl={thumbnailLightbox}
          onClose={() => setThumbnailLightbox(null)}
        />
      </div>
    </CollapsibleModule>
  );
}
