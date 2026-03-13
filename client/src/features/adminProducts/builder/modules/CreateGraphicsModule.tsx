import { useState, useCallback } from "react";
import { Package, Loader2, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { ImageModalView } from "@/features/shared/components/views/ModalView";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { authFetch } from "@/features/adminAuth/authFetch";
import { useToast } from "@/hooks/use-toast";
import type { PricingBreakdown } from "../types";
import { renderProductGraphic, type TextStyle as SharedTextStyle } from "@/features/shared/graphics/productGraphicRenderer";
import { renderLandingPage } from "@/features/shared/graphics/landingPageRenderer";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps/wizardTypes";
import { PacketResultDisplay } from "./PacketResultDisplay";

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
  const { state, loadGraphic, selectedRole, selectedStore, selectedChannel, resetBuilder } = useBuilderContext();
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [packetResult, setPacketResult] = useState<PacketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailLightbox, setThumbnailLightbox] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const hasPlayMedia = isPlayMode && (
    (state.content?.playMediaSource === "url" && state.content?.playMediaUrl) ||
    (state.content?.playMediaSource === "upload" && state.content?.playMediaFile)
  );
  const playPermissionOk = !isPlayMode || state.content?.playPermissionConfirmed;
  const hasPlacement = (state.selectedPlacements || []).length > 0;

  const validationErrors: string[] = [];
  const canCreate = true;

  const calculatePricing = useCallback((): PricingBreakdown | null => {
    if (!pricingSettings || !state.selectedProduct || !state.content) return null;

    const product = state.selectedProduct as any;
    const baseProductCost = parseFloat(product.maxPrice || product.basePrice || product.minPrice || product.customerPrice || "0");

    const placementCount = (state.selectedPlacements || []).length || 1;
    const additionalPlacements = Math.max(0, placementCount - 1);
    const placementCost = additionalPlacements * pricingSettings.additionalPlacementCost;

    let textLineCount = 0;
    if (state.content.headerStyle?.enabled && state.content.headerStyle.text) textLineCount++;
    if (state.content.footerStyle?.enabled && state.content.footerStyle.text) textLineCount++;
    const textUpcharge = textLineCount * pricingSettings.textLineUpcharge;

    const hostingCost = 0;

    const subtotal = baseProductCost + placementCost + textUpcharge;
    const markupAmount = (subtotal * (pricingSettings.markupPercent / 100)) + pricingSettings.markupFixed;
    const customerPrice = subtotal + markupAmount;

    return {
      baseProductCost,
      placementCost,
      textUpcharge,
      hostingCost,
      subtotal,
      markupPercent: pricingSettings.markupPercent,
      markupFixed: pricingSettings.markupFixed,
      markupAmount,
      customerPrice,
      hostingTierCode: state.content.hostingTierCode || "1_year",
    };
  }, [pricingSettings, state.selectedProduct, state.selectedPlacements, state.content, state.qrProductState]);

  const handleCreatePacket = async () => {
    console.log('[CreateGraphics] handleCreatePacket called');
    if (!canCreate || isCreating) return;

    setIsCreating(true);
    setError(null);
    setPacketResult(null);

    try {
      const pricing = calculatePricing();
      if (!pricing) throw new Error("Could not calculate pricing");

      const product = state.selectedProduct as any;
      const availableColors = product?.availableColors || [];
      const availableSizes = product?.availableSizes || [];
      const availablePlacements = product?.availablePlacements || [];

      const generateSlug = (text: string): string => {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
      };

      const landingPageSlug = generateSlug(state.content?.title || 'product') + '-' + Date.now().toString(36);

      const packetPayload: Record<string, any> = {
        qrOnlyUrl: "",
        compositeUrl: "",
        qrContent: isPlayMode ? "" : (state.content?.url || state.content?.title || "").trim(),
        headerText: state.content?.headerStyle?.enabled ? state.content.headerStyle.text : null,
        footerText: state.content?.footerStyle?.enabled ? state.content.footerStyle.text : null,
        headerStyle: state.content?.headerStyle?.enabled ? state.content.headerStyle : null,
        footerStyle: state.content?.footerStyle?.enabled ? state.content.footerStyle : null,
        backgroundUrl: state.loadedBackground?.url || null,
        pricing,
        productId: state.selectedProduct?.id || null,
        productName: state.selectedProduct?.title || product?.name || null,
        productDescription: product?.description || null,
        productImageUrl: product?.imageUrl || null,
        blueprintId: product?.blueprintId || null,
        printProviderId: product?.printProviderId || null,
        manufacturer: product?.manufacturer || null,
        madeInUSA: product?.madeInUSA || false,
        category: product?.category || null,
        defaultColor: state.selectedColor?.name || product?.defaultColor || null,
        defaultColorHex: state.selectedColor?.hex || null,
        defaultPlacement: product?.defaultPlacement || null,
        qrProductState: state.qrProductState,
        placements: state.selectedPlacements || [],
        placementConfig: state.placementConfig || {},
        placementSizes: state.placementSizes || {},
        availablePlacements,
        sizes: availableSizes,
        colors: availableColors,
        basePrice: product?.basePrice || null,
        customerPrice: product?.customerPrice || null,
        mockupsByColor: product?.mockupsByColor || null,
        landingPageTitle: state.content?.title || null,
        landingPageDescription: state.content?.description || null,
        landingPageBackgroundUrl: state.loadedBackground?.url || null,
        landingPageSlug,
        roleType: selectedRole || null,
        storeId: selectedStore?.id || null,
        storeName: selectedStore?.name || null,
        channelId: selectedChannel?.id || null,
        channelName: selectedChannel?.name || null,
        fulfillmentProvider: state.fulfillmentProvider || product?.fulfillmentProvider || 'printify',
      };

      if (isPlayMode && state.content?.playMediaSource === "url" && state.content?.playMediaUrl) {
        packetPayload.playMediaUrl = state.content.playMediaUrl;
      }

      const packetRes = await authFetch(`${apiBase}/packets`, getAuthHeaders, {
        method: "POST",
        body: JSON.stringify(packetPayload),
      });

      const packetData = await packetRes.json();
      const packetId = packetData.packetId;

      let uploadedPlayMediaUrl: string | null = null;
      let uploadedPlayMediaType: string | null = null;

      if (isPlayMode && state.content?.playMediaSource === "upload" && state.content?.playMediaFile) {
        try {
          const file = state.content.playMediaFile;
          const fileName = file.name || `media${state.content.playMediaMimeType?.includes("video") ? ".mp4" : ".gif"}`;

          if (!file.size || file.size === 0) {
            throw new Error("File is empty (0 bytes). Please select a valid video file.");
          }

          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              if (!result || result.length < 100) {
                reject(new Error("File could not be read - appears empty or corrupted"));
                return;
              }
              resolve(result);
            };
            reader.onerror = () => reject(new Error("Failed to read file: " + reader.error?.message));
            reader.readAsDataURL(file);
          });

          const authHeaders = await getAuthHeaders();
          const uploadRes = await fetch(`${apiBase}/content/upload`, {
            method: "POST",
            headers: { ...authHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "play",
              userId: "admin",
              packetId,
              base64Data,
              mimeType: file.type || state.content.playMediaMimeType || "video/mp4",
              fileName,
            }),
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData.error || `Upload failed: ${uploadRes.status}`);
          }

          const uploadData = await uploadRes.json();
          uploadedPlayMediaUrl = uploadData.publicUrl;
          uploadedPlayMediaType = file.type || state.content.playMediaMimeType || "video/mp4";
        } catch (uploadErr: any) {
          const errMsg = uploadErr?.message || uploadErr?.toString?.() || JSON.stringify(uploadErr) || "Unknown error";
          console.error("Play media upload error:", errMsg, uploadErr);
          toast({
            title: "Video Upload Failed",
            description: errMsg.slice(0, 200),
            variant: "destructive",
          });
        }
      } else if (isPlayMode && state.content?.playMediaSource === "url" && state.content?.playMediaUrl) {
        uploadedPlayMediaUrl = state.content.playMediaUrl;
        uploadedPlayMediaType = "video/url";
      }

      const baseUrl = window.location.origin;
      const isLandingPageMode = state.qrProductState === "qr_canvas" || state.qrProductState === "qr_play" || state.qrProductState === "qr_compose" || state.qrProductState === "qr_plus";
      const finalQrContent = isLandingPageMode
        ? `${baseUrl}/m/${landingPageSlug}`
        : (state.content?.url || state.content?.title || "");

      const qrUrl = generateQRCodeUrl(finalQrContent.trim(), 3000);

      const backgroundUrl = state.loadedBackground?.url || null;
      const headerStyle = state.content?.headerStyle as SharedTextStyle | null;
      const footerStyle = state.content?.footerStyle as SharedTextStyle | null;
      const titleStyle = state.content?.titleStyle as SharedTextStyle | null;
      const descriptionStyle = state.content?.descriptionStyle as SharedTextStyle | null;
      const productColorHex = state.selectedColor?.hex || null;

      const primaryPlacement = (state.selectedPlacements || ["front-center"])[0];

      let productGraphicUrl: string;
      try {
        productGraphicUrl = await renderProductGraphic({
          qrContent: finalQrContent.trim(),
          qrColor: "black",
          headerStyle: headerStyle?.enabled ? headerStyle as SharedTextStyle : null,
          footerStyle: footerStyle?.enabled ? footerStyle as SharedTextStyle : null,
          backgroundColor: productColorHex || undefined,
          transparent: true,
          placement: primaryPlacement,
          qrPositionX: state.content.qrPositionX,
          qrPositionY: state.content.qrPositionY,
          qrSizePercent: state.content.qrSizePercent,
          areaImageUrl: state.content.areaImageUrl || undefined,
          areaImageMode: state.content.areaImageMode || "behind-qr",
        });
      } catch (e) {
        console.warn('Product graphic generation failed:', e);
        productGraphicUrl = "";
      }

      let landingPageSnapshotUrl: string = "";
      if (isLandingPageMode) {
        try {
          landingPageSnapshotUrl = await renderLandingPage({
            backgroundUrl,
            titleStyle,
            descriptionStyle,
          });
        } catch (e) {
          console.warn('Landing page snapshot generation failed:', e);
        }
      }

      const mode = state.qrProductState === "qr_canvas" ? "canvas" :
                   state.qrProductState === "qr_play" ? "play" :
                   state.qrProductState === "qr_compose" ? "compose" : "basics";

      try {
        const graphicAuthHeaders = await getAuthHeaders();
        const uploadRes = await fetch(`${apiBase}/content/upload`, {
          method: "POST",
          headers: { ...graphicAuthHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            userId: "admin",
            packetId,
            base64Data: productGraphicUrl,
            mimeType: "image/png",
            fileName: `${packetId}-product-graphic.png`,
          }),
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          productGraphicUrl = uploadData.publicUrl;
        }
      } catch (uploadErr) {
        console.warn("Product graphic upload error, using data URL:", uploadErr);
      }

      if (landingPageSnapshotUrl) {
        try {
          const snapshotAuthHeaders = await getAuthHeaders();
          const uploadRes = await fetch(`${apiBase}/content/upload`, {
            method: "POST",
            headers: { ...snapshotAuthHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
              mode,
              userId: "admin",
              packetId,
              base64Data: landingPageSnapshotUrl,
              mimeType: "image/png",
              fileName: `${packetId}-landing-snapshot.png`,
            }),
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            landingPageSnapshotUrl = uploadData.publicUrl;
          }
        } catch (uploadErr) {
          console.warn("Landing page snapshot upload error:", uploadErr);
        }
      }

      await authFetch(`${apiBase}/packets/${packetId}`, getAuthHeaders, {
        method: "PATCH",
        body: JSON.stringify({
          qrOnlyUrl: qrUrl,
          productGraphicUrl,
          landingPageSnapshotUrl: landingPageSnapshotUrl || null,
          compositeUrl: productGraphicUrl,
          qrContent: finalQrContent.trim(),
          playMediaUrl: uploadedPlayMediaUrl || null,
          playMediaType: uploadedPlayMediaType || null,
        }),
      });

      const graphicsSaveHeaders = await getAuthHeaders();
      await fetch(`${apiBase}/graphics/save`, {
        method: "POST",
        headers: { ...graphicsSaveHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.content?.title || `Graphic - ${new Date().toLocaleDateString()}`,
          description: state.content?.description || "",
          category: state.qrProductState || "General",
          qrOnlyUrl: qrUrl,
          compositeUrl: productGraphicUrl,
          qrContent: finalQrContent,
          pricing,
          packetId,
        }),
      });

      const productColors = availableColors.length > 0
        ? availableColors.map((c: any) => ({ name: c.name || c, hex: c.hex || c.color || '#000000' }))
        : [{ name: state.selectedColor?.name || 'Black', hex: state.selectedColor?.hex || '#000000' }];

      const templateSaveHeaders = await getAuthHeaders();
      const templateSaveRes = await fetch(`${apiBase}/templates/full-save`, {
        method: "POST",
        headers: { ...templateSaveHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.content?.title || `Template - ${new Date().toLocaleDateString()}`,
          description: state.content?.description || "",
          category: state.qrProductState || "General",
          productId: state.selectedProduct?.id || null,
          blueprintId: product?.blueprintId || 0,
          printProviderId: product?.printProviderId || null,
          fulfillmentProvider: state.fulfillmentProvider || product?.fulfillmentProvider || 'printify',
          colors: productColors,
          placements: state.selectedPlacements || ["front"],
          placementMethods: state.placementMethods || {},
          qrSizes: ["small", "medium", "large"],
          artworkUrl: productGraphicUrl,
          artworkVariant: "black",
          thumbnailUrl: productGraphicUrl || "",
          qrContent: finalQrContent,
          pricing,
          packetId,
        }),
      });

      const templateData = await templateSaveRes.json().catch(() => ({}));
      console.log(`[CreatePacket] Template saved, mockup jobs queued: ${templateData.jobsQueued || 0}`);

      const queueHeaders = await getAuthHeaders();
      fetch(`${apiBase}/queue/process`, {
        method: "POST",
        headers: { ...queueHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      }).catch(() => {});

      if (selectedStore?.id && selectedChannel?.name) {
        try {
          const linkHeaders = await getAuthHeaders();
          const linkRes = await fetch(`${apiBase}/store-product-links`, {
            method: "POST",
            headers: { ...linkHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
              storeId: selectedStore.id,
              storeName: selectedStore.name,
              channel: selectedChannel.name,
              packetId,
              templateId: templateData.templateId || null,
              productName: state.selectedProduct?.title || product?.name || null,
              compositeUrl: productGraphicUrl,
              qrOnlyUrl: qrUrl,
              qrContent: finalQrContent,
              pricing,
              enabledColors: availableColors.map((c: any) => c.name || c),
              enabledSizes: availableSizes,
              selectedGraphicSize: state.placementSizes?.[(state.selectedPlacements || ["front"])[0]] || "medium",
              defaultColor: state.selectedColor?.name || null,
            }),
          });
          if (linkRes.ok) {
            const linkData = await linkRes.json();
            console.log(`[CreatePacket] Store product link created: ${linkData.linkId}`);
          }
        } catch (linkErr) {
          console.warn('[CreatePacket] Store product link creation error:', linkErr);
        }
      }

      loadGraphic({ compositeUrl: productGraphicUrl, qrOnlyUrl: qrUrl });

      const initialResult: PacketResult = {
        packetId,
        landingPageUrl: finalQrContent,
        landingPageSnapshotUrl: landingPageSnapshotUrl || "",
        productGraphicUrl,
        qrOnlyUrl: qrUrl,
        pricing,
        priorityMockupUrl: null,
        priorityMockupLoading: true,
      };
      setPacketResult(initialResult);

      toast({
        title: "Packet Created",
        description: "Generating digital proof...",
      });

      const selectedPlacement = (state.selectedPlacements && state.selectedPlacements.length > 0)
        ? state.selectedPlacements[0]
        : "front";
      const selectedSize = state.placementSizes?.[selectedPlacement] || "medium";
      const canonicalPlacement = (selectedPlacement || "front").toLowerCase();

      const mockupHeaders = await getAuthHeaders();
      fetch(`${apiBase}/mockup/priority`, {
        method: "POST",
        headers: { ...mockupHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintId: product?.blueprintId || 0,
          printProviderId: product?.printProviderId || null,
          colorName: state.selectedColor?.name || 'Black',
          colorHex: state.selectedColor?.hex || '#000000',
          placement: canonicalPlacement,
          artworkUrl: productGraphicUrl,
          qrSize: selectedSize,
          fulfillmentProvider: state.fulfillmentProvider || product?.fulfillmentProvider || 'printify',
        }),
      })
        .then(res => res.json())
        .then(async data => {
          if (data.success && data.mockupUrl) {
            await authFetch(`${apiBase}/packets/${packetId}`, getAuthHeaders, {
              method: "PATCH",
              body: JSON.stringify({ priorityMockupUrl: data.mockupUrl }),
            }).catch(() => {});

            setPacketResult(prev => prev ? { ...prev, priorityMockupUrl: data.mockupUrl, priorityMockupLoading: false } : prev);
            toast({ title: "Digital Proof Ready", description: "Your product preview is ready!" });
          } else {
            const errorMsg = data.error || data.message || "Mockup generation failed";
            setPacketResult(prev => prev ? { ...prev, priorityMockupLoading: false, priorityMockupError: errorMsg } : prev);
            toast({ title: "Mockup Generation Failed", description: errorMsg, variant: "destructive" });
          }
        })
        .catch((err) => {
          const errorMsg = err.message || "Failed to connect to mockup service";
          setPacketResult(prev => prev ? { ...prev, priorityMockupLoading: false, priorityMockupError: errorMsg } : prev);
          toast({ title: "Mockup Service Error", description: errorMsg, variant: "destructive" });
        });

    } catch (err: any) {
      console.error("Create packet failed:", err);
      setError(err.message || "Failed to create packet");
      toast({ title: "Error", description: err.message || "Failed to create packet", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleNext = () => {
    if (packetResult) {
      navigate(`/admin/store-builder?packetId=${packetResult.packetId}`);
    }
  };

  const handleReset = () => {
    setPacketResult(null);
    setError(null);
    resetBuilder();
  };

  const handleDeletePacket = async () => {
    if (!packetResult?.packetId || isDeleting) return;

    setIsDeleting(true);
    try {
      await authFetch(`${apiBase}/packets/${packetResult.packetId}`, getAuthHeaders, {
        method: "DELETE",
      });

      toast({ title: "Packet Deleted", description: "Starting fresh..." });
      setPacketResult(null);
      setError(null);
    } catch (err: any) {
      console.error("Delete packet failed:", err);
      toast({ title: "Delete Failed", description: err.message || "Could not delete packet", variant: "destructive" });
    } finally {
      setIsDeleting(false);
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

        <ImageModalView
          imageUrl={thumbnailLightbox}
          onClose={() => setThumbnailLightbox(null)}
        />
      </div>
    </CollapsibleModule>
  );
}
