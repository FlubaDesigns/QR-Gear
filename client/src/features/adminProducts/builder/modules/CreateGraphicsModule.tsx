import { ColorSwatchPicker } from '@/features/shared/components/ColorSwatchPicker';
import type { PricingSettings } from '@shared/schema-orders';
import { useState, useEffect, useRef } from "react";
import { Package, Loader2, Check, CheckCircle2, Copy, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { ImageModalView } from "@/features/shared/components/shapes/ModalView";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { adminFetch } from "@/lib/adminFetch";
import { GRF_PACKET_SLOTS } from "@shared/graphicCodes";
import { useToast } from "@/hooks/use-toast";
import type { PricingBreakdown } from "../types";
import { PacketResultDisplay } from "./PacketResultDisplay";
import { useCreatePacket } from "./useCreatePacket";
import { replaceLeadPhoto } from './replaceLeadPhoto';
import { queryClient } from '@/lib/queryClient';
import { refreshBuildLibrary } from '@/features/adminLibrary/shared/grfQueryKeys';
import { packetLeadColor } from '@shared/productImages';

interface HostingTier {
  code: string;
  name: string;
  price: number;
}



export interface PacketResult {
  packetId: string;
  fulfillmentProvider: string | null;
  landingPageUrl: string;
  landingPageSnapshotUrl: string;
  productGraphicUrl: string;
  qrOnlyUrl: string;
  pricing: PricingBreakdown;
  priorityMockupUrl?: string | null;
  priorityMockupLoading?: boolean;
  priorityMockupError?: string | null;
  lifestyleMockupUrl?: string | null;
  placementMockupUrls?: Record<string, string> | null;
  compositeUrl?: string | null;
  assemblyId?: string | null;
  printifyProductId?: string | null;
  printifyPublishedAt?: string | Date | null;
  printifyVariantMap?: Record<string, number> | null;
  enabledColors?: string[];
}

export function CreateGraphicsModule({ generateRequested = false, onGenerateHandled }: { generateRequested?: boolean; onGenerateHandled?: () => void } = {}) {
  const { state, setContent, setProductTitle, setProductDescription, loadGraphic, selectedRole, selectedStore, selectedChannel, selectedCollection, resetBuilder, resumeSession, setActivePacketId, setActiveSession, beginBuildActivity } = useBuilderContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [thumbnailLightbox, setThumbnailLightbox] = useState<string | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  const [isCloningSession, setIsCloningSession] = useState(false);
  const [leadPhoto, setLeadPhoto] = useState<File | null>(null);
  const [leadPhotoColor, setLeadPhotoColor] = useState('');
  const [savingLeadPhoto, setSavingLeadPhoto] = useState(false);
  const [leadPhotoError, setLeadPhotoError] = useState<string | null>(null);
  const leadPhotoInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setLeadPhoto(null);
    setLeadPhotoColor('');
    setLeadPhotoError(null);
    if (leadPhotoInput.current) leadPhotoInput.current.value = '';
  }, [state.activePacketId]);

  const hasActiveSession = !!state.activeSessionId;
  const sessionStatus = state.sessionStatus;

  const { data: pricingSettings, isLoading: pricingLoading, error: pricingError } = useQuery<PricingSettings>({
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
    if (state.selectedProduct && !state.content?.title) {
      const parts = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name].filter(Boolean);
      if (parts.length > 0) {
        setContent({ title: parts.join(' / ') });
      }
    }
  }, [selectedStore?.name, selectedChannel?.name, selectedCollection?.name]);

  const isPlayMode = state.qrProductState === "qr_play";
  const isBasicsOrPlusMode = state.qrProductState === "qr_basics" || state.qrProductState === "qr_plus";

  const validationErrors: string[] = [];
  if (!state.activeSessionId) validationErrors.push('Wait for the product session to finish loading');
  if (!state.selectedProduct) validationErrors.push('Select a product');
  if (state.placementsLoading) validationErrors.push('Wait for product options to finish loading');
  if (state.placementsError) validationErrors.push(state.placementsError);
  if (!pricingSettings) validationErrors.push(pricingError ? 'Pricing could not be loaded' : 'Wait for pricing to finish loading');
  if (!state.content.graphicLayoutMode) validationErrors.push('Select a design layout');
  if (!state.selectedPlacements.length) validationErrors.push('Select a print placement');
  if (!selectedCollection) {
    validationErrors.push("Select a collection (folder) above before creating a packet");
  }
  const canCreate = validationErrors.length === 0;

  const {
    isCreating, packetResult, error,
    isCommitting, commitResult,
    artifactError, handleCreatePacket, handleNext, handleReset, handleDeletePacket,
    handleCommitSession,
    setPacketResult, setCommitResult, setArtifactError,
  } = useCreatePacket({
    state, selectedRole, selectedStore, selectedChannel, selectedCollection,
    loadGraphic, resetBuilder, pricingSettings,
  });

  const generationRequestHandled = useRef(false);
  useEffect(() => {
    if (!generateRequested) { generationRequestHandled.current = false; return; }
    if (generationRequestHandled.current || pricingLoading || state.placementsLoading) return;
    generationRequestHandled.current = true;
    onGenerateHandled?.();
    if (packetResult || (state.activePacketId && sessionStatus !== 'working') || state.sessionStatus === 'committed') return;
    if (!canCreate) {
      toast({ title: 'Complete the build first', description: validationErrors.join('. '), variant: 'destructive' });
      return;
    }
    void handleCreatePacket();
  }, [generateRequested, pricingLoading, state.placementsLoading, canCreate, handleCreatePacket, onGenerateHandled]);

  // Sync active packet ID whenever a new packet is created
  useEffect(() => {
    if (packetResult?.packetId) {
      setActivePacketId(packetResult.packetId);
    }
  }, [packetResult?.packetId]);

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
        setLeadPhotoColor(packetLeadColor(p) || '');
        setPacketResult({
          packetId: state.activePacketId ?? '',
          fulfillmentProvider: strOrNull(p.fulfillmentProvider),
          landingPageUrl: str(p.qrContent) || str(p.landingPageUrl),
          landingPageSnapshotUrl: str(p.landingPageSnapshotUrl),
          productGraphicUrl: str(p.productGraphicUrl) || str(p.compositeUrl),
          qrOnlyUrl: str(p.qrOnlyUrl),
          pricing: p.pricing as PricingBreakdown,
          priorityMockupUrl: strOrNull(p.priorityMockupUrl),
          priorityMockupLoading: false,
          lifestyleMockupUrl: strOrNull(p.lifestyleMockupUrl),
          placementMockupUrls: (p.placementMockupUrls as Record<string, string> | null) ?? null,
          compositeUrl: strOrNull(p.compositeUrl),
          assemblyId: strOrNull(p.assemblyId),
          printifyProductId: strOrNull(p.printifyProductId),
          printifyPublishedAt: strOrNull(p.printifyPublishedAt),
          printifyVariantMap: (p.printifyVariantMap as Record<string, number> | null | undefined) ?? null,
          enabledColors,
        });
        console.log(`[CreateGraphicsModule] Restored packetResult for ${state.activePacketId}`);
      } catch (error: any) {
        if (!cancelled) setArtifactError(`Could not load saved packet: ${error.message}`);
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
      setActivePacketId(null);
      setPacketResult(null);
      setCommitResult(null);
      setArtifactError(null);
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
      await resumeSession(data.sessionId);
    } catch (err: any) {
      toast({ title: 'Could not save as new', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally { setIsCloningSession(false); }
  };

  const handleLeadPhoto = async () => {
    if (!leadPhoto || !packetResult || !state.committedInstanceId || savingLeadPhoto) return;
    let finish: () => void;
    try { finish = beginBuildActivity('Saving lead photo…'); } catch { return; }
    setSavingLeadPhoto(true);
    setLeadPhotoError(null);
    const packetId = packetResult.packetId;
    try {
      const color = leadPhotoColor || state.selectedColor?.name;
      if (!color || !state.selectedProduct?.availableColors.some(option => option.name === color)) throw new Error('Choose an available shirt color.');
      const result = await replaceLeadPhoto(packetId, state.committedInstanceId, leadPhoto, color);
      setPacketResult(prev => prev?.packetId === packetId ? { ...prev,
        priorityMockupUrl: result.url, placementMockupUrls: result.placementMockupUrls,
        lifestyleMockupUrl: result.lifestyleMockupUrl } : prev);
      void refreshBuildLibrary(queryClient);
      void queryClient.invalidateQueries({ predicate: query => query.queryKey.some(key => typeof key === 'string' && /catalog-instances|\/shop\//.test(key)) });
      setLeadPhoto(null);
      if (leadPhotoInput.current) leadPhotoInput.current.value = '';
      toast({ title: 'Lead photo saved', description: `The new photo is first for ${result.color}.` });
    } catch (error: any) {
      console.error('[Products] Lead photo save failed:', error);
      setLeadPhotoError(error.message || 'Could not save the lead photo.');
    } finally { setSavingLeadPhoto(false); finish(); }
  };


  if (!state.selectedProduct || !state.qrProductState || !state.content) {
    return null;
  }

  return (
    <CollapsibleModule
      title="Finalize"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {!packetResult && (!state.activePacketId || sessionStatus === 'working') && (
          <>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Product title</span>
              <input
                className="w-full min-h-12 rounded-md border bg-background px-3 py-2"
                value={state.adminCatalogTitle ?? state.masterTitle ?? state.selectedProduct.title ?? ''}
                onChange={event => setProductTitle(event.target.value, 'manual')}
                disabled={isCreating || !['working', 'artifact_ready'].includes(sessionStatus || '')}
                maxLength={140}
                data-testid="input-output-product-title"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Product description</span>
              <textarea
                className="w-full min-h-28 rounded-md border bg-background px-3 py-2"
                value={state.productDescription ?? state.masterDescription ?? ''}
                onChange={event => setProductDescription(event.target.value, 'manual')}
                disabled={isCreating || !['working', 'artifact_ready'].includes(sessionStatus || '')}
                maxLength={5000}
                data-testid="textarea-output-product-description"
              />
            </label>
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

        {artifactError && !packetResult && <p role="alert" className="text-sm text-destructive">{artifactError}</p>}
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


        {/* Auto-commit in progress indicator */}
        {packetResult && hasActiveSession && sessionStatus === 'artifact_ready' && isCommitting && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              Saving to catalog…
            </p>
          </div>
        )}

        {hasActiveSession && sessionStatus === 'artifact_ready' && !isCommitting && (
          <Button onClick={handleCommitSession} disabled={isCreating} data-testid="button-retry-commit">
            Retry catalog save
          </Button>
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
            <div className="space-y-3 rounded-md border p-4">
              <label htmlFor="lead-photo-input" className="block text-base font-semibold">Replace lead photo</label>
              <p className="text-sm text-muted-foreground">Choose the photo and matching shirt color shown first in the store and on the product page. Your print design and QR page stay the same.</p>
              <ColorSwatchPicker label="Lead photo shirt color" displayType="dropdown"
                colors={state.selectedProduct.availableColors} disabled={savingLeadPhoto}
                selectedColor={leadPhotoColor || state.selectedColor?.name || ''}
                onChange={color => setLeadPhotoColor(color.name)} />
              <input id="lead-photo-input" ref={leadPhotoInput} type="file" accept="image/png,image/jpeg,image/webp"
                className="block w-full min-h-12 text-sm" disabled={savingLeadPhoto || packetResult.priorityMockupLoading}
                onChange={event => { setLeadPhoto(event.target.files?.[0] || null); setLeadPhotoError(null); }} />
              {leadPhotoError && <p role="alert" className="text-sm text-destructive">{leadPhotoError} The photo is kept here so you can retry.</p>}
              <Button className="min-h-12" onClick={handleLeadPhoto} disabled={!leadPhoto || savingLeadPhoto || packetResult.priorityMockupLoading}>
                {savingLeadPhoto ? 'Saving lead photo…' : leadPhotoError ? 'Retry photo save' : 'Save lead photo'}
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
