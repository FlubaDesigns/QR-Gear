import { useState, useEffect } from "react";
import { Package, Loader2, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { ImageModalView } from "@/features/shared/components/views/ModalView";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
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
  const { state, loadGraphic, selectedRole, selectedStore, selectedChannel, resetBuilder, setActivePacketId } = useBuilderContext();
  const { apiBase } = useAdminAuth();
  const [thumbnailLightbox, setThumbnailLightbox] = useState<string | null>(null);

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
    handleCreatePacket, handleNext, handleReset, handleDeletePacket,
  } = useCreatePacket({
    state, selectedRole, selectedStore, selectedChannel,
    loadGraphic, resetBuilder, pricingSettings,
  });

  useEffect(() => {
    if (packetResult?.packetId) {
      setActivePacketId(packetResult.packetId);
    }
  }, [packetResult?.packetId]);

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

        <ImageModalView
          imageUrl={thumbnailLightbox}
          onClose={() => setThumbnailLightbox(null)}
        />
      </div>
    </CollapsibleModule>
  );
}
