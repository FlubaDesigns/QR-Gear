import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";
import { renderProductGraphic, type TextStyle as SharedTextStyle } from "@/features/shared/graphics/productGraphicRenderer";
import { renderLandingPage } from "@/features/shared/graphics/landingPageRenderer";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps/wizardTypes";
import type { PricingBreakdown } from "../types";
import type { PacketResult } from "./CreateGraphicsModule";
import { useBuilderContext } from "../BuilderContext";

interface CommitResult {
  instanceId: string;
  sessionId: string;
  packetId: string | null;
}

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
  selectedCollection: any;
  loadGraphic: (g: { compositeUrl: string; qrOnlyUrl: string }) => void;
  resetBuilder: () => void;
  pricingSettings: PricingSettings | undefined;
}

export function useCreatePacket({
  state, selectedRole, selectedStore, selectedChannel, selectedCollection,
  loadGraphic, resetBuilder, pricingSettings,
}: UseCreatePacketArgs) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [packetResult, setPacketResult] = useState<PacketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const { setActiveSession } = useBuilderContext();

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

    // ── Gate: QRG blank identity must exist before any schema write ────────
    const product = state.selectedProduct as any;
    const qrgBlankId: string | null = product?.qrgBlankId || null;
    if (!qrgBlankId || !/^[1-6][1-9]\d{3}$/.test(qrgBlankId)) {
      setError(
        `Cannot save: this product has no valid QRG blank identity (qrgBlankId). ` +
        `Select a product from the master catalog that has a valid STNNN blank ID (e.g. qrg_11001).`,
      );
      return;
    }

    setIsCreating(true);
    setError(null);
    setArtifactError(null);
    setPacketResult(null);

    try {
      const pricing = calculatePricing();
      if (!pricing) throw new Error("Could not calculate pricing");
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
        masterTitle: state.masterTitle ?? null,
        adminCatalogTitle: state.adminCatalogTitle ?? null,
        // PROGRESSIVE TRUTH — store only the packet-layer value, never a fallback chain.
        // NULL means "no explicit packet title/description" — display uses descriptionLayers.ts.
        effectiveTitle: state.adminCatalogTitle !== null && state.adminCatalogTitle !== undefined
          ? state.adminCatalogTitle : null,
        masterDescription: state.masterDescription ?? null,
        adminCatalogDescription: state.adminCatalogDescription ?? null,
        effectiveDescription: state.productDescription !== undefined ? state.productDescription : null,
        productDescription: state.productDescription !== undefined ? state.productDescription : null,
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
        selectedPlacements: state.selectedPlacements || [],
        placements: product?.printLocations || product?.placements || [],
        placementConfig: state.placementConfig || {},
        placementSizes: state.placementSizes || {},
        availablePlacements,
        availableSizes,
        availableColors,
        sizes: availableSizes,
        colors: availableColors,
        qrgVariants: product?.qrgVariants || {},
        options: [
          ...(availableColors.length > 0 ? [{
            name: 'Color', type: 'color', displayType: 'swatches',
            values: availableColors.map((c: any) => ({ value: c.name || c, label: c.name || c, hex: c.hex || null })),
          }] : []),
          ...(availableSizes.length > 0 ? [{
            name: 'Size', type: 'size', displayType: 'pills',
            values: availableSizes.map((s: string) => ({ value: s, label: s })),
          }] : []),
        ],
        basePrice: product?.basePrice || null,
        customerPrice: product?.customerPrice || null,
        mockupsByColor: product?.mockupsByColor || null,
        landingPageTitle: state.content?.title || null,
        landingPageDescription: state.content?.description || null,
        landingPageBackgroundUrl: state.loadedBackground?.url || null,
        landingTextBlocks: state.content?.landingTextBlocks || [],
        landingPageSlug,
        sourceMasterId: product?.docId || null,
        qrgBlankId: product?.qrgBlankId || null,
        roleType: selectedRole || null,
        storeId: selectedStore?.id || null,
        storeName: selectedStore?.name || null,
        channelId: selectedChannel?.id || null,
        channelName: selectedChannel?.name || null,
        collectionId: selectedCollection?.id || null,
        collectionName: selectedCollection?.name || null,
        folderPath: [selectedStore?.name, selectedChannel?.name, selectedCollection?.name].filter(Boolean).join(' / ') || null,
        fulfillmentProvider: state.fulfillmentProvider || product?.fulfillmentProvider || 'printify',
        subBottomEnabled: state.content?.subBottomStyle?.enabled || false,
        subBottomText: state.content?.subBottomStyle?.text || '',
        subBottomFontFamily: state.content?.subBottomStyle?.fontFamily || 'Arial',
        subBottomFontSize: state.content?.subBottomStyle?.fontSize || '14',
        subBottomFontWeight: state.content?.subBottomStyle?.fontWeight || '400',
        subBottomColor: state.content?.subBottomStyle?.color || '#666666',
        graphicLayoutMode: state.content?.graphicLayoutMode || 'zone',
        qrSizePercent: state.content?.qrSizePercent ?? 75,
        qrPositionX: state.content?.qrPositionX ?? 50,
        qrPositionY: state.content?.qrPositionY ?? 50,
        areaImageUrl: state.content?.areaImageUrl || null,
        areaImageMode: state.content?.areaImageMode || 'behind-qr',
        areaImageOffsetX: state.content?.areaImageOffsetX ?? 50,
        areaImageOffsetY: state.content?.areaImageOffsetY ?? 50,
        areaImageScale: state.content?.areaImageScale ?? 100,
        qrBasicInputType: state.content?.qrBasicInputType || 'text',
        // Full builder snapshot so loadFromPacketData can reconstruct the exact input state.
        // snapshot.content.url is the user's original QR input — never overwritten by the
        // landing-page URL rewrite that happens to packet.qrContent for canvas/play modes.
        builderSnapshot: {
          content: {
            url: state.content?.url || '',
            title: state.content?.title || '',
            description: state.content?.description || '',
            headerStyle: state.content?.headerStyle ?? null,
            footerStyle: state.content?.footerStyle ?? null,
            subBottomStyle: state.content?.subBottomStyle ?? null,
            qrPositionX: state.content?.qrPositionX ?? 50,
            qrPositionY: state.content?.qrPositionY ?? 50,
            qrSizePercent: state.content?.qrSizePercent ?? 75,
            areaImageUrl: state.content?.areaImageUrl || '',
            areaImageMode: state.content?.areaImageMode || 'behind-qr',
            areaImageOffsetX: state.content?.areaImageOffsetX ?? 50,
            areaImageOffsetY: state.content?.areaImageOffsetY ?? 50,
            areaImageScale: state.content?.areaImageScale ?? 100,
            landingTextBlocks: state.content?.landingTextBlocks || [],
            graphicLayoutMode: state.content?.graphicLayoutMode || '',
            qrBasicInputType: state.content?.qrBasicInputType || 'text',
          },
          selectedProductId: state.selectedProduct?.id || null,
          selectedPlacements: state.selectedPlacements || [],
          placementConfig: state.placementConfig || {},
          placementSizes: state.placementSizes || {},
          placementMethods: state.placementMethods || {},
          selectedColor: state.selectedColor ?? null,
          qrProductState: state.qrProductState,
          savedAt: new Date().toISOString(),
        },
      };

      if (isPlayMode && state.content?.playMediaSource === "url" && state.content?.playMediaUrl) {
        packetPayload.playMediaUrl = state.content.playMediaUrl;
      }

      const packetData = await adminFetch<any>("/packets", {
        method: "POST",
        json: packetPayload,
      });
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

          const uploadData = await adminFetch<any>("/content/upload", {
            method: "POST",
            json: {
              mode: "play",
              userId: "admin",
              packetId,
              base64Data,
              mimeType: file.type || state.content.playMediaMimeType || "video/mp4",
              fileName,
            },
          });

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
              text: b.text, enabled: b.enabled, fontFamily: b.fontFamily,
              fontSize: b.fontSize, color: b.color, letterSpacing: b.letterSpacing,
              strokeColor: b.strokeColor, strokeWidth: b.strokeWidth,
              verticalOffset: b.verticalOffset, horizontalOffset: b.horizontalOffset,
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
        const uploadData = await adminFetch<any>("/content/upload", {
          method: "POST",
          json: {
            mode, userId: "admin", packetId,
            base64Data: productGraphicUrl, mimeType: "image/png",
            fileName: `${packetId}-product-graphic.png`,
          },
        });
        if (uploadData?.publicUrl) productGraphicUrl = uploadData.publicUrl;
      } catch (uploadErr) {
        console.warn("Product graphic upload error, using data URL:", uploadErr);
      }

      if (landingPageSnapshotUrl) {
        try {
          const uploadData = await adminFetch<any>("/content/upload", {
            method: "POST",
            json: {
              mode, userId: "admin", packetId,
              base64Data: landingPageSnapshotUrl, mimeType: "image/png",
              fileName: `${packetId}-landing-snapshot.png`,
            },
          });
          if (uploadData?.publicUrl) landingPageSnapshotUrl = uploadData.publicUrl;
        } catch (uploadErr) {
          console.warn("Landing page snapshot upload error:", uploadErr);
        }
      }

      await adminFetch(`/packets/${packetId}`, {
        method: "PATCH",
        json: {
          qrOnlyUrl: qrUrl, productGraphicUrl,
          landingPageSnapshotUrl: landingPageSnapshotUrl || null,
          compositeUrl: productGraphicUrl,
          qrContent: finalQrContent.trim(),
          playMediaUrl: uploadedPlayMediaUrl || null,
          playMediaType: uploadedPlayMediaType || null,
        },
      });


      const productColors = availableColors.length > 0
        ? availableColors.map((c: any) => ({ name: c.name || c, hex: c.hex || c.color || '#000000' }))
        : [{ name: state.selectedColor?.name || 'Black', hex: state.selectedColor?.hex || '#000000' }];

      // Template auto-save is intentionally removed from the commit flow.
      // Templates are a separate concern and must not be part of schema-chain commits.
      // Call /templates/full-save independently if template persistence is needed.

      // Legacy storeProductLinks creation removed — admin_catalog_instances
      // (created by the build session commit below) is now the sole source of truth.

      // Track the committed instance so the mockup fire-and-forget can call rebuild-images afterward.
      let committedInstanceId: string | null = null;

      if (state.activeSessionId) {
        try {
          const artifactData = await adminFetch<any>(
            `/build-sessions/${state.activeSessionId}/generate-artifact`,
            {
              method: "POST",
              json: { existingPacketId: packetId, previewImageUrl: productGraphicUrl || null },
            },
          ).catch((e) => { console.error("[CreatePacket] generate-artifact failed:", e.message); return null; });

          if (artifactData) {
            console.log(`[CreatePacket] Session ${state.activeSessionId} → artifact_ready (packet ${packetId}), committing…`);
            const commitData = await adminFetch<any>(
              `/build-sessions/${state.activeSessionId}/commit`,
              { method: "POST", json: { pricing } },
            ).catch((e) => {
              console.error("[CreatePacket] auto-commit failed:", e.message);
              setActiveSession(state.activeSessionId, 'artifact_ready', null);
              setArtifactError(`Packet was created but couldn't be saved to your catalog (${e.message}). Use the commit button below to retry.`);
              return null;
            });

            if (commitData) {
              committedInstanceId = commitData.instanceId;
              setActiveSession(state.activeSessionId, 'committed', commitData.instanceId);
              setCommitResult({ instanceId: commitData.instanceId, sessionId: state.activeSessionId, packetId });
              console.log(`[CreatePacket] Auto-committed → instance ${commitData.instanceId}`);
            }
          } else {
            setArtifactError(`Packet was created but the catalog entry failed to generate. You can still proceed or retry.`);
          }
        } catch (sessionErr: any) {
          console.error("[CreatePacket] session save failed:", sessionErr.message);
          setArtifactError(`Session could not be saved (${sessionErr.message}). Your packet data may not persist.`);
        }
      }

      loadGraphic({ compositeUrl: productGraphicUrl, qrOnlyUrl: qrUrl });

      const enabledColorNames: string[] = (availableColors || [])
        .map((c: any) => (typeof c === 'string' ? c : c?.name || c?.label || null))
        .filter(Boolean);

      const initialResult: PacketResult = {
        packetId,
        landingPageUrl: finalQrContent,
        landingPageSnapshotUrl: landingPageSnapshotUrl || "",
        productGraphicUrl,
        qrOnlyUrl: qrUrl,
        pricing,
        priorityMockupUrl: null,
        priorityMockupLoading: true,
        compositeUrl: productGraphicUrl,
        printifyProductId: null,
        printifyPublishedAt: null,
        printifyVariantMap: null,
        enabledColors: enabledColorNames,
      };
      setPacketResult(initialResult);

      toast({ title: "Packet Created", description: "Generating digital proof..." });

      // Fire mockup generation for every selected placement in parallel (fire-and-forget).
      // When all results are in, save placementMockupUrls + lifestyleMockupUrl to the packet,
      // then call rebuild-images on the committed instance to update resolved.images immediately.
      const allPlacements: string[] = (state.selectedPlacements && state.selectedPlacements.length > 0)
        ? state.selectedPlacements
        : ["front"];
      const capturedInstanceId = committedInstanceId;
      const capturedPacketId = packetId;

      Promise.all(
        allPlacements.map((placement: string) =>
          adminFetch<any>("/mockup/priority", {
            method: "POST",
            json: {
              blueprintId: product?.blueprintId || 0,
              printProviderId: product?.printProviderId || null,
              colorName: state.selectedColor?.name || 'Black',
              colorHex: state.selectedColor?.hex || '#000000',
              placement: placement.toLowerCase(),
              artworkUrl: productGraphicUrl,
              qrSize: state.placementSizes?.[placement] || "medium",
              fulfillmentProvider: state.fulfillmentProvider || product?.fulfillmentProvider || 'printify',
            },
          }).catch(() => null)
        )
      ).then(async (results) => {
        const placementMockupUrls: Record<string, string> = {};
        let lifestyleMockupUrl: string | null = null;

        results.forEach((data: any, i: number) => {
          if (!data?.success || !data?.mockupUrl) return;
          const placement = allPlacements[i];
          placementMockupUrls[placement] = data.mockupUrl;
          if (!lifestyleMockupUrl && data.lifestyleMockupUrl) {
            lifestyleMockupUrl = data.lifestyleMockupUrl;
          }
        });

        const primaryMockupUrl = placementMockupUrls[allPlacements[0]] || null;

        if (!primaryMockupUrl) {
          const errorMsg = "Mockup generation failed for all placements";
          setPacketResult(prev => prev ? { ...prev, priorityMockupLoading: false, priorityMockupError: errorMsg } : prev);
          toast({ title: "Mockup Generation Failed", description: errorMsg, variant: "destructive" });
          return;
        }

        const packetPatch: Record<string, any> = {
          placementMockupUrls,
          priorityMockupUrl: primaryMockupUrl,
        };
        if (lifestyleMockupUrl) packetPatch.lifestyleMockupUrl = lifestyleMockupUrl;

        await adminFetch(`/packets/${capturedPacketId}`, {
          method: "PATCH",
          json: packetPatch,
        }).catch(() => {});

        if (capturedInstanceId) {
          await adminFetch(`/catalog-instances/${capturedInstanceId}/rebuild-images`, {
            method: "POST",
            json: {},
          }).catch(() => {});
        }

        setPacketResult(prev => prev ? {
          ...prev,
          priorityMockupUrl: primaryMockupUrl,
          priorityMockupLoading: false,
        } : prev);
        toast({ title: "Digital Proof Ready", description: "Your product preview is ready!" });
      }).catch((err) => {
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
      await adminFetch(`/packets/${packetResult.packetId}`, { method: "DELETE" });
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

  const handleCommitSession = async () => {
    if (!state.activeSessionId || isCommitting) return;
    if (state.sessionStatus !== 'artifact_ready') {
      toast({
        title: "Cannot commit yet",
        description: "Generate a packet first.",
        variant: "destructive",
      });
      return;
    }

    setIsCommitting(true);
    try {
      const data = await adminFetch<any>(`/build-sessions/${state.activeSessionId}/commit`, {
        method: "POST",
        json: {},
      });

      const result: CommitResult = {
        instanceId: data.instanceId,
        sessionId: data.sessionId,
        packetId: data.packetId || null,
      };
      setCommitResult(result);
      setActiveSession(state.activeSessionId, 'committed', data.instanceId);
      console.log(`[CreatePacket] Committed session ${state.activeSessionId} → instance ${data.instanceId}`);
      toast({
        title: "Saved as Admin Instance",
        description: `Instance ${data.instanceId.slice(0, 8)}… created successfully.`,
      });
    } catch (err: any) {
      console.error("[CreatePacket] Commit session failed:", err.message || err);
      toast({
        title: "Commit Failed",
        description: err.message || "Could not save admin instance.",
        variant: "destructive",
      });
    } finally {
      setIsCommitting(false);
    }
  };

  return {
    isCreating, packetResult, error, isDeleting,
    isCommitting, commitResult, artifactError,
    calculatePricing, handleCreatePacket, handleNext, handleReset, handleDeletePacket,
    handleCommitSession,
    setPacketResult, setError,
  };
}
