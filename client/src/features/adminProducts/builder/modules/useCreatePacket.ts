import { queryClient } from "@/lib/queryClient";
import { refreshBuildLibrary, ORIGINALS_QK } from "@/features/adminLibrary/shared/grfQueryKeys";
import { TEMPLATE_LIBRARY_QK } from "@/features/shared/templateLibrary";
import { packetBuildFields, productGraphicOptions, requireBuilderSnapshot } from '@shared/builderSnapshot';
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";
import { renderProductGraphic, type RenderOptions } from "@/features/shared/graphics/productGraphicRenderer";
import { renderLandingPage } from "@/features/shared/graphics/landingPageRenderer";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps/wizardTypes";
import { DEFAULT_QR_PRODUCT_STATE, type PricingBreakdown } from "../types";
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
  resetBuilder: () => Promise<void>;
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
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const { setActiveSession, saveWorking, setActivePacketId, beginBuildActivity } = useBuilderContext();

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

  /**
   * If the background URL is a raw base64 data URI, upload it to Firebase Storage
   * and return the resulting Storage URL. This prevents the Firestore 1 MiB doc
   * limit from being hit by giant inline base64 strings. Returns the URL unchanged
   * if it is already a Storage URL (or null/undefined).
   */
  const resolveBackgroundUrl = async (rawUrl: string | null | undefined): Promise<string | null> => {
    if (!rawUrl) return null;
    if (!rawUrl.startsWith("data:")) return rawUrl;

    console.warn("[CreatePacket] landingPageBackgroundUrl is a base64 data URI — uploading to Storage first");
    try {
      const mimeMatch = rawUrl.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const ext = mimeType.split("/")[1] || "jpg";
      const uploadResult = await adminFetch<{ asset: { publicUrl: string } }>("/library/upload-source", {
        method: "POST",
        json: { imageUrl: rawUrl, mimeType, originalFilename: `bg-${Date.now()}.${ext}` },
      });
      if (!uploadResult.asset?.publicUrl) throw new Error("Background upload returned no registered image URL");
      void queryClient.invalidateQueries({ queryKey: ORIGINALS_QK });
      return uploadResult.asset.publicUrl;
    } catch (err: any) {
      console.error("[CreatePacket] Background upload failed — stripping base64 to prevent Firestore overflow:", err.message);
      toast({
        title: "Background image could not be saved",
        description: err.message,
        variant: "destructive",
      });
      throw new Error(`Background upload failed: ${err.message}`);
    }
  };

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

    let finish: () => void;
    try { finish = beginBuildActivity('Generating packet…'); } catch { return; }
    setIsCreating(true);
    setError(null);
    setArtifactError(null);
    setPacketResult(null);

    try {
      const snapshot = requireBuilderSnapshot(await saveWorking());
      const content = snapshot.graphics.content;
      const playMediaFile = state.content?.playMediaFile;
      const pricing = calculatePricing();
      if (!pricing) throw new Error("Could not calculate pricing");
      const availableColors = product?.availableColors || [];
      const availableSizes = product?.availableSizes || [];
      const availablePlacements = product?.availablePlacements || [];

      const generateSlug = (text: string): string => {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
      };

      const landingPageSlug = generateSlug(snapshot.title || content.title || 'product') + '-' + Date.now().toString(36);
      const isPlayMode = state.qrProductState === "qr_play";

      // Upload any base64 background to Storage before it touches any Firestore write.
      const resolvedBgUrl = await resolveBackgroundUrl(snapshot.graphics.loadedBackground?.url);
      if (snapshot.graphics.loadedBackground) snapshot.graphics.loadedBackground.url = resolvedBgUrl;

      const packetPayload: Record<string, any> = {
        qrOnlyUrl: "",
        compositeUrl: "",
        qrContent: isPlayMode ? "" : (content.url || content.title || "").trim(),
        pricing,
        productId: state.selectedProduct?.id || null,
        productName: state.selectedProduct?.title || product?.name || null,
        masterTitle: state.masterTitle ?? null,
        masterDescription: state.masterDescription ?? null,
        productImageUrl: product?.imageUrl || null,
        blueprintId: product?.blueprintId || null,
        printProviderId: product?.printProviderId || null,
        manufacturer: product?.manufacturer || null,
        madeInUSA: product?.madeInUSA || false,
        category: product?.category || null,
        defaultPlacement: product?.defaultPlacement || null,
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
        landingPageSlug,
        qrgBlankId: product?.qrgBlankId || null,
        ...packetBuildFields(snapshot),
      };

      if (isPlayMode && content.playMediaSource === "url" && content.playMediaUrl) {
        packetPayload.playMediaUrl = content.playMediaUrl;
      }

      const packetData = await adminFetch<any>("/packets", {
        method: "POST",
        json: packetPayload,
      });
      const packetId = packetData.packetId;

      let uploadedPlayMediaUrl: string | null = null;
      let uploadedPlayMediaType: string | null = null;

      if (isPlayMode && content.playMediaSource === "upload" && playMediaFile) {
        try {
          const file = playMediaFile;
          const fileName = file.name || `media${content.playMediaMimeType?.includes("video") ? ".mp4" : ".gif"}`;

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
              mimeType: file.type || content.playMediaMimeType || "video/mp4",
              fileName,
            },
          });

          uploadedPlayMediaUrl = uploadData.publicUrl;
          uploadedPlayMediaType = file.type || content.playMediaMimeType || "video/mp4";
        } catch (uploadErr: any) {
          const errMsg = uploadErr?.message || uploadErr?.toString?.() || JSON.stringify(uploadErr) || "Unknown error";
          throw new Error(`Play media upload failed: ${errMsg}`);
        }
      } else if (isPlayMode && content.playMediaSource === "url" && content.playMediaUrl) {
        uploadedPlayMediaUrl = content.playMediaUrl;
        uploadedPlayMediaType = "video/url";
      }

      const baseUrl = window.location.origin;
      const isLandingPageMode = state.qrProductState === "qr_canvas" || state.qrProductState === "qr_play" || state.qrProductState === "qr_compose" || state.qrProductState === "qr_plus";
      const finalQrContent = isLandingPageMode
        ? `${baseUrl}/m/${landingPageSlug}`
        : (content.url || content.title || "");

      const qrUrl = generateQRCodeUrl(finalQrContent.trim(), 3000);

      const backgroundUrl = resolvedBgUrl;
      const titleStyle = content.titleStyle;
      const descriptionStyle = content.descriptionStyle;
      const productColorHex = state.selectedColor?.hex || null;

      const primaryPlacement = (state.selectedPlacements || ["front-center"])[0];

      let productGraphicUrl: string;
      try {
        productGraphicUrl = await renderProductGraphic(productGraphicOptions(snapshot, finalQrContent.trim()) as RenderOptions);
      } catch (e) {
        throw new Error(`Product graphic generation failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      let landingPageSnapshotUrl: string = "";
      if (isLandingPageMode) {
        try {
          const rawBlocks = (content.landingTextBlocks || []) as any[];
          const rendererBlocks = rawBlocks
            .filter((b: any) => b.enabled && b.text)
            .map((b: any) => ({
              text: b.text, enabled: b.enabled, fontFamily: b.fontFamily,
              fontSize: b.fontSize, fontWeight: b.fontWeight, color: b.color, letterSpacing: b.letterSpacing,
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
          throw new Error(`Landing page preview failed: ${e instanceof Error ? e.message : String(e)}`);
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
        throw new Error(`Product graphic upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }

      // Safety: if the upload failed or was skipped, productGraphicUrl is still a
      // raw base64 data URI (~11 MB). Never write that to Firestore — strip it to ""
      // so the packet PATCH stays well under the 1 MB document limit.
      if (productGraphicUrl && productGraphicUrl.startsWith('data:')) {
        console.error('[CreatePacket] productGraphicUrl is still a data URI after upload — stripping to prevent Firestore overflow');
        throw new Error('Product graphic upload returned no stored file.');
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
          throw new Error(`Landing page preview upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
        }
        if (landingPageSnapshotUrl && landingPageSnapshotUrl.startsWith('data:')) {
          console.error('[CreatePacket] landingPageSnapshotUrl is still a data URI after upload — stripping');
          throw new Error('Landing page preview upload returned no stored file.');
        }
      }

      const placementGraphicUrls: Record<string, string> = { [primaryPlacement]: productGraphicUrl };
      for (const placement of snapshot.layoutConfig.selectedPlacements.slice(1)) {
        if (!snapshot.layoutConfig.providerLayouts?.[placement]?.dimensions) throw new Error(`Print dimensions are missing for ${placement}. Reload the product options.`);
        const graphic = await renderProductGraphic(productGraphicOptions(snapshot, finalQrContent.trim(), placement) as RenderOptions);
        const upload = await adminFetch<{ publicUrl: string }>('/content/upload', {
          method: 'POST', json: { mode, userId: 'admin', packetId, base64Data: graphic,
            mimeType: 'image/png', fileName: `${packetId}-${placement}.png` },
        });
        if (!upload.publicUrl) throw new Error(`Graphic upload failed for ${placement}.`);
        placementGraphicUrls[placement] = upload.publicUrl;
      }

      if (isPlayMode) snapshot.graphics.content.playMediaUrl = uploadedPlayMediaUrl;
      await adminFetch(`/packets/${packetId}`, {
        method: "PATCH",
        json: {
          ...packetBuildFields(snapshot),
          qrOnlyUrl: qrUrl, productGraphicUrl,
          landingPageSnapshotUrl: landingPageSnapshotUrl || null,
          compositeUrl: productGraphicUrl,
          placementGraphicUrls,
          qrContent: finalQrContent.trim(),
          playMediaUrl: uploadedPlayMediaUrl || null,
          playMediaType: uploadedPlayMediaType || null,
        },
      });


      const productColors = availableColors.length > 0
        ? availableColors.map((c: any) => ({ name: c.name || c, hex: c.hex || c.color || '#000000' }))
        : [{ name: state.selectedColor?.name || 'Black', hex: state.selectedColor?.hex || '#000000' }];

      // Legacy storeProductLinks creation removed — admin_catalog_instances
      // (created by the build session commit below) is now the sole source of truth.

      // Track the committed instance so the mockup fire-and-forget can call rebuild-images afterward.
      let committedInstanceId: string | null = null;
      let committedAssemblyId: string | null = null;

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
            console.log(`[CreatePacket] Session ${state.activeSessionId} → artifact_ready (packet ${packetId}), committing… | channel: ${selectedChannel?.name ?? "null"}`);
            const commitData = await adminFetch<any>(
              `/build-sessions/${state.activeSessionId}/commit`,
              {
                method: "POST",
                json: {
                  pricing,
                  // Fallback channel/store/collection for when autosave hasn't written metadata yet
                  channelId: selectedChannel?.id || null,
                  channelName: selectedChannel?.name || null,
                  storeId: selectedStore?.id || null,
                  storeName: selectedStore?.name || null,
                  collectionName: selectedCollection?.name || null,
                },
              },
            ).catch((e) => {
              console.error("[CreatePacket] auto-commit failed:", e.message);
              setActiveSession(state.activeSessionId, 'artifact_ready', null);
              setArtifactError(`Packet was created but couldn't be saved to your catalog (${e.message}). Use the commit button below to retry.`);
              return null;
            });

            if (commitData) {
              void refreshBuildLibrary(queryClient);
              committedInstanceId = commitData.instanceId;
              committedAssemblyId = commitData.assemblyId;
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

      // GRF registration is owned by the server commit. Save the reusable template.
      const grfName = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name]
        .filter(Boolean).join(' / ') || product?.title || 'Product';

      const templateColors = productColors.length > 0 ? productColors : [{ name: 'Black', hex: '#000000' }];
      await adminFetch('/templates/full-save', {
        method: 'POST',
        json: {
          name: grfName,
          builderSnapshot: snapshot,
          blueprintId: product?.blueprintId || 0,
          printProviderId: product?.printProviderId || null,
          fulfillmentProvider: state.fulfillmentProvider || product?.fulfillmentProvider || 'printify',
          colors: templateColors,
          placements: state.selectedPlacements?.length > 0 ? state.selectedPlacements : ['front'],
          placementMethods: state.placementConfig || {},
          artworkUrl: productGraphicUrl || '',
          thumbnailUrl: productGraphicUrl || '',
          packetId,
          productName: product?.title || product?.name || null,
          qrContent: finalQrContent || '',
          pricing,
          headerText: content.headerStyle?.enabled ? content.headerStyle.text : null,
          footerText: content.footerStyle?.enabled ? content.footerStyle.text : null,
          headerStyle: content.headerStyle?.enabled ? content.headerStyle : null,
          footerStyle: content.footerStyle?.enabled ? content.footerStyle : null,
          subBottomEnabled: content.subBottomStyle?.enabled || false,
          subBottomText: content.subBottomStyle?.text || '',
          subBottomFontFamily: content.subBottomStyle?.fontFamily || 'Arial',
          subBottomFontSize: content.subBottomStyle?.fontSize || '14',
          subBottomFontWeight: content.subBottomStyle?.fontWeight || '400',
          subBottomColor: content.subBottomStyle?.color || '#666666',
          backgroundUrl: resolvedBgUrl,
          qrProductState: state.qrProductState || DEFAULT_QR_PRODUCT_STATE,
          areaImageUrl: content.areaImageUrl || null,
          areaImageMode: content.areaImageMode || 'behind-qr',
          areaImageOffsetX: content.areaImageOffsetX ?? 50,
          areaImageOffsetY: content.areaImageOffsetY ?? 50,
          areaImageScale: content.areaImageScale ?? 100,
          graphicLayoutMode: content.graphicLayoutMode || 'zone',
          qrSizePercent: content.qrSizePercent ?? 75,
          qrPositionX: content.qrPositionX ?? 50,
          qrPositionY: content.qrPositionY ?? 50,
          storeId: selectedStore?.id || null,
          channelId: selectedChannel?.id || null,
        },
      }).then(() => queryClient.invalidateQueries({ queryKey: TEMPLATE_LIBRARY_QK }))
        .catch((e: any) => {
          console.warn('[CreatePacket] Template auto-save failed:', e.message);
          toast({ title: 'Template was not saved', description: 'Your packet was created, but saving its reusable template failed. ' + e.message, variant: 'destructive' });
        });

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
        assemblyId: committedAssemblyId,
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
      const allPlacements: string[] = snapshot.layoutConfig.selectedPlacements;
      const capturedInstanceId = committedInstanceId;
      const capturedPacketId = packetId;

      Promise.all(
        allPlacements.map((placement: string) =>
          adminFetch<any>("/mockup/priority", {
            method: "POST",
            json: { packetId: capturedPacketId, placement },
          }).catch((error: Error) => ({ success: false, error: error.message }))
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

        const primaryMockupUrl = allPlacements.map(placement => placementMockupUrls[placement]).find(Boolean) || null;

        if (!primaryMockupUrl) {
          const errorMsg = results.map((result: any, index: number) => `${allPlacements[index]}: ${result?.error || "No mockup returned"}`).join("; ");
          setPacketResult(prev => prev && prev.packetId === capturedPacketId ? { ...prev, priorityMockupLoading: false, priorityMockupError: errorMsg } : prev);
          toast({ title: "Mockup Generation Failed", description: errorMsg, variant: "destructive" });
          return;
        }

        const packetPatch: Record<string, any> = {
          placementMockupUrls,
          priorityMockupUrl: primaryMockupUrl,
          mockupsByColor: {
            [snapshot.qrConfig.selectedColor.name]: Object.fromEntries(
              allPlacements.flatMap((placement, index) => {
                const data = results[index];
                if (!data?.success || !data?.mockupUrl) return [];
                return [[placement, {
                  [snapshot.layoutConfig.placementSizes[placement] || 'medium']: data.mockupUrl,
                  ...(data.lifestyleMockupUrl ? { lifestyle: data.lifestyleMockupUrl } : {}),
                }]];
              }),
            ),
          },
        };
        if (lifestyleMockupUrl) packetPatch.lifestyleMockupUrl = lifestyleMockupUrl;

        await adminFetch(`/packets/${capturedPacketId}`, {
          method: "PATCH",
          json: packetPatch,
        });

        if (capturedInstanceId) {
          await adminFetch(`/catalog-instances/${capturedInstanceId}/rebuild-images`, {
            method: "POST",
            json: {},
          });
        }

        setPacketResult(prev => prev && prev.packetId === capturedPacketId ? {
          ...prev,
          priorityMockupUrl: primaryMockupUrl,
          lifestyleMockupUrl: lifestyleMockupUrl,
          placementMockupUrls: Object.keys(placementMockupUrls).length > 0 ? placementMockupUrls : null,
          priorityMockupLoading: false,
        } : prev);
        toast({ title: "Digital Proof Ready", description: "Your product preview is ready!" });
      }).catch((err) => {
        const errorMsg = err.message || "Failed to connect to mockup service";
        setPacketResult(prev => prev && prev.packetId === capturedPacketId ? { ...prev, priorityMockupLoading: false, priorityMockupError: errorMsg } : prev);
        toast({ title: "Mockup Service Error", description: errorMsg, variant: "destructive" });
      });

    } catch (err: any) {
      console.error("Create packet failed:", err);
      setError(err.message || "Failed to create packet");
      toast({ title: "Error", description: err.message || "Failed to create packet", variant: "destructive" });
    } finally {
      finish();
      setIsCreating(false);
    }
  };

  const handleNext = () => {
    if (packetResult) {
      navigate(`/admin/store-builder?packetId=${packetResult.packetId}`);
    }
  };

  const handleReset = async () => {
    try {
      await resetBuilder();
      setPacketResult(null); setError(null);
    } catch (error: any) {
      toast({ title: 'Could not start a new build', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeletePacket = () => {
    // The shared dialog has deleted the complete build, including its saved session.
    setActivePacketId(null);
    setActiveSession(null, null, null);
    setCommitResult(null);
    setArtifactError(null);
    setPacketResult(null);
    setError(null);
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

    let finish: () => void;
    try { finish = beginBuildActivity("Saving generated product…"); } catch { return; }
    setIsCommitting(true);
    try {
      const data = await adminFetch<any>(`/build-sessions/${state.activeSessionId}/commit`, {
        method: "POST",
        json: {
          storeId: selectedStore?.id || null,
          storeName: selectedStore?.name || null,
          channelId: selectedChannel?.id || null,
          channelName: selectedChannel?.name || null,
          collectionId: selectedCollection?.id || null,
          collectionName: selectedCollection?.name || null,
        },
      });

      const result: CommitResult = {
        instanceId: data.instanceId,
        sessionId: data.sessionId,
        packetId: data.packetId || null,
      };
      void refreshBuildLibrary(queryClient);
      setCommitResult(result);
      setActiveSession(state.activeSessionId, 'committed', data.instanceId);
      setPacketResult(prev => prev ? { ...prev, assemblyId: data.assemblyId } : prev);
      setArtifactError(null);
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
      finish();
      setIsCommitting(false);
    }
  };

  return {
    isCreating, packetResult, error,
    isCommitting, commitResult, artifactError,
    calculatePricing, handleCreatePacket, handleNext, handleReset, handleDeletePacket,
    handleCommitSession,
    setPacketResult, setError, setCommitResult, setArtifactError,
  };
}
