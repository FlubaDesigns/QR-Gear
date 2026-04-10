import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { authFetch } from "@/features/adminAuth/authFetch";
import { useToast } from "@/hooks/use-toast";
import { renderProductGraphic, type TextStyle as SharedTextStyle } from "@/features/shared/graphics/productGraphicRenderer";
import { renderLandingPage } from "@/features/shared/graphics/landingPageRenderer";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps/wizardTypes";
import type { PricingBreakdown } from "../types";
import type { PacketResult } from "./CreateGraphicsModule";
import { useBuilderContext } from "../BuilderContext";

interface PricingSettings {
  markupPercent: number;
  markupFixed: number;
  additionalPlacementCost: number;
  textLineUpcharge: number;
  hostingTiers: { code: string; name: string; price: number }[];
}

interface UseCreatePacketArgs {
  state: any;
  selectedRole: any;
  selectedStore: any;
  selectedChannel: any;
  loadGraphic: (g: { compositeUrl: string; qrOnlyUrl: string }) => void;
  resetBuilder: () => void;
  pricingSettings: PricingSettings | undefined;
}

export function useCreatePacket({
  state, selectedRole, selectedStore, selectedChannel,
  loadGraphic, resetBuilder, pricingSettings,
}: UseCreatePacketArgs) {
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [packetResult, setPacketResult] = useState<PacketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { hasChangesFromBaseline } = useBuilderContext();

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
      baseProductCost, placementCost, textUpcharge, hostingCost, subtotal,
      markupPercent: pricingSettings.markupPercent,
      markupFixed: pricingSettings.markupFixed,
      markupAmount, customerPrice,
      hostingTierCode: state.content.hostingTierCode || "1_year",
    };
  }, [pricingSettings, state.selectedProduct, state.selectedPlacements, state.content]);

  const handleCreatePacket = async () => {
    console.log('[CreateGraphics] handleCreatePacket called');
    if (isCreating) return;

    if (state.templateBaseline && !hasChangesFromBaseline()) {
      toast({
        title: "No changes detected",
        description: "You loaded a template but haven't changed anything yet. Edit something first to save a new packet.",
      });
      return;
    }

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
      const isPlayMode = state.qrProductState === "qr_play";

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
        masterTitle: state.masterTitle || null,
        adminCatalogTitle: state.adminCatalogTitle || null,
        effectiveTitle: state.selectedProduct?.title || state.masterTitle || product?.name || "Untitled Product",
        masterDescription: state.masterDescription || null,
        adminCatalogDescription: state.adminCatalogDescription || null,
        effectiveDescription: state.adminCatalogDescription ?? state.masterDescription ?? product?.description ?? null,
        productDescription: state.adminCatalogDescription ?? state.masterDescription ?? product?.description ?? null,
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
        landingTextBlocks: state.content?.landingTextBlocks || [],
        landingPageSlug,
        roleType: selectedRole || null,
        storeId: selectedStore?.id || null,
        storeName: selectedStore?.name || null,
        channelId: selectedChannel?.id || null,
        channelName: selectedChannel?.name || null,
        fulfillmentProvider: state.fulfillmentProvider || product?.fulfillmentProvider || 'printify',
        subBottomEnabled: state.content?.subBottomStyle?.enabled || false,
        subBottomText: state.content?.subBottomStyle?.text || '',
        subBottomFontFamily: state.content?.subBottomStyle?.fontFamily || 'Arial',
        subBottomFontSize: state.content?.subBottomStyle?.fontSize || '14',
        subBottomFontWeight: state.content?.subBottomStyle?.fontWeight || '400',
        subBottomColor: state.content?.subBottomStyle?.color || '#666666',
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
          subBottomEnabled: state.content.subBottomStyle?.enabled || false,
          subBottomText: state.content.subBottomStyle?.text || "",
          subBottomFontFamily: state.content.subBottomStyle?.fontFamily || 'Arial',
          subBottomFontSize: state.content.subBottomStyle?.fontSize || '14',
          subBottomFontWeight: state.content.subBottomStyle?.fontWeight || '400',
          subBottomColor: state.content.subBottomStyle?.color || '#666666',
        });
      } catch (e) {
        console.warn('Product graphic generation failed:', e);
        productGraphicUrl = "";
      }

      let landingPageSnapshotUrl: string = "";
      if (isLandingPageMode) {
        try {
          const rawBlocks = (state.content?.landingTextBlocks || []) as any[];
          const rendererBlocks = rawBlocks
            .filter((b: any) => b.enabled && b.text)
            .map((b: any) => ({
              text: b.text,
              enabled: b.enabled,
              fontFamily: b.fontFamily,
              fontSize: b.fontSize,
              color: b.color,
              letterSpacing: b.letterSpacing,
              strokeColor: b.strokeColor,
              strokeWidth: b.strokeWidth,
              verticalOffset: b.verticalOffset,
              horizontalOffset: b.horizontalOffset,
            }));
          landingPageSnapshotUrl = await renderLandingPage({
            backgroundUrl,
            textBlocks: rendererBlocks.length > 0 ? rendererBlocks : null,
            titleStyle: rendererBlocks.length === 0 ? titleStyle : null,
            descriptionStyle: rendererBlocks.length === 0 ? descriptionStyle : null,
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
            mode, userId: "admin", packetId,
            base64Data: productGraphicUrl, mimeType: "image/png",
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
              mode, userId: "admin", packetId,
              base64Data: landingPageSnapshotUrl, mimeType: "image/png",
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
          qrOnlyUrl: qrUrl, productGraphicUrl,
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
          qrOnlyUrl: qrUrl, compositeUrl: productGraphicUrl,
          qrContent: finalQrContent, pricing, packetId,
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
          artworkUrl: productGraphicUrl, artworkVariant: "black",
          thumbnailUrl: productGraphicUrl || "",
          qrContent: finalQrContent, pricing, packetId,
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
              storeId: selectedStore.id, storeName: selectedStore.name,
              channel: selectedChannel.name, packetId,
              templateId: templateData.templateId || null,
              productName: state.selectedProduct?.title || product?.name || null,
              compositeUrl: productGraphicUrl, qrOnlyUrl: qrUrl,
              qrContent: finalQrContent, pricing,
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

      toast({ title: "Packet Created", description: "Generating digital proof..." });

      const selectedPlacement = (state.selectedPlacements && state.selectedPlacements.length > 0)
        ? state.selectedPlacements[0] : "front";
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
          placement: canonicalPlacement, artworkUrl: productGraphicUrl,
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
      await authFetch(`${apiBase}/packets/${packetResult.packetId}`, getAuthHeaders, { method: "DELETE" });
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

  return {
    isCreating, packetResult, error, isDeleting,
    calculatePricing, handleCreatePacket, handleNext, handleReset, handleDeletePacket,
    setPacketResult, setError,
  };
}
