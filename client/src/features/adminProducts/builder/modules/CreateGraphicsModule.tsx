import { useState, useEffect } from "react";
import { Package, Loader2, Check, BookmarkCheck, CheckCircle2, Copy, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { ImageModalView } from "@/features/shared/components/views/ModalView";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
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
}

export function CreateGraphicsModule() {
  const { state, loadGraphic, selectedRole, selectedStore, selectedChannel, resetBuilder, setActivePacketId, setActiveSession } = useBuilderContext();
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [thumbnailLightbox, setThumbnailLightbox] = useState<string | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  const [isCloningSession, setIsCloningSession] = useState(false);

  const hasActiveSession = !!state.activeSessionId;
  const sessionStatus = state.sessionStatus;

  const { data: pricingSettings } = useQuery<PricingSettings>({
    queryKey: [`${apiBase}/pricing-settings`],
    queryFn: async () => {
      const res = await fetch(`/api/pricing-settings`);
      if (!res.ok) throw new Error(`pricing-settings HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60000,
  });

  const isPlayMode = state.qrProductState === "qr_play";
  const isBasicsOrPlusMode = state.qrProductState === "qr_basics" || state.qrProductState === "qr_plus";

  const validationErrors: string[] = [];
  const canCreate = true;

  const {
    isCreating, packetResult, error, isDeleting,
    isCommitting, handleCreatePacket, handleNext, handleReset, handleDeletePacket,
    handleCommitSession, setPacketResult,
  } = useCreatePacket({
    state, selectedRole, selectedStore, selectedChannel,
    loadGraphic, resetBuilder, pricingSettings,
  });

  // Sync activePacketId when a new packet is freshly created
  useEffect(() => {
    if (packetResult?.packetId) {
      setActivePacketId(packetResult.packetId);
    }
  }, [packetResult?.packetId]);

  // When re-selecting a product whose session already has a packet, restore
  // the PacketResultDisplay automatically instead of showing "Create Packet".
  useEffect(() => {
    if (!state.activePacketId || packetResult || sessionStatus !== 'artifact_ready') return;
    let cancelled = false;

    const restore = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/packets/${state.activePacketId}`, { headers });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const p = data.landingPage || data.packet || data;
        if (!p || !p.packetId || cancelled) return;
        setPacketResult({
          packetId: state.activePacketId,
          landingPageUrl: p.qrContent || p.landingPageUrl || '',
          landingPageSnapshotUrl: p.landingPageSnapshotUrl || '',
          productGraphicUrl: p.productGraphicUrl || p.compositeUrl || '',
          qrOnlyUrl: p.qrOnlyUrl || '',
          pricing: p.pricing as PricingBreakdown,
          priorityMockupUrl: p.priorityMockupUrl || null,
          priorityMockupLoading: false,
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
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/build-sessions/${state.activeSessionId}/reopen`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/build-sessions/clone`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSessionId: state.activeSessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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
          />
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
