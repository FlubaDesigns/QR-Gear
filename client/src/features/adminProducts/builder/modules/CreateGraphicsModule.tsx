import { useState, useCallback } from "react";
import { Package, Loader2, Check, QrCode, Image, DollarSign, ArrowRight, Link2, Shirt, ListChecks } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBuilderContext } from "../BuilderContext";
import { useToast } from "@/hooks/use-toast";
import type { PricingBreakdown } from "../types";

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

interface PacketResult {
  packetId: string;
  landingPageUrl: string;
  landingPageSnapshotUrl: string;
  productGraphicUrl: string;
  qrOnlyUrl: string;
  pricing: PricingBreakdown;
  priorityMockupUrl?: string | null;
  priorityMockupLoading?: boolean;
}

function generateQRCodeUrl(content: string, size: number = 3000, qrColor: "black" | "white" = "black"): string {
  const color = qrColor === "white" ? "ffffff" : "000000";
  const bgColor = qrColor === "white" ? "00000000" : "ffffff";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}&format=png&qzone=2&ecc=H&color=${color}&bgcolor=${bgColor}`;
}

function getLuminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => parseInt(c, 16) / 255);
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastQRColor(productColorHex: string): "black" | "white" {
  const luminance = getLuminance(productColorHex);
  return luminance > 0.5 ? "black" : "white";
}

interface TextStyle {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset: number;
  horizontalOffset: number;
}

interface ProductGraphicOptions {
  qrUrl: string;
  productColorHex: string | null;
  headerStyle: TextStyle | null;
  footerStyle: TextStyle | null;
  useTransparentBackground?: boolean;
}

async function generateProductGraphic(options: ProductGraphicOptions): Promise<string> {
  const { qrUrl, productColorHex, headerStyle, footerStyle, useTransparentBackground } = options;
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1920;
  const QR_SIZE = 400;
  
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  if (useTransparentBackground) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else if (productColorHex) {
    ctx.fillStyle = productColorHex;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  try {
    const qrImg = await loadImage(qrUrl);
    const qrX = (CANVAS_WIDTH - QR_SIZE) / 2;
    const qrY = (CANVAS_HEIGHT - QR_SIZE) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 20, qrY - 20, QR_SIZE + 40, QR_SIZE + 40);
    ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);
  } catch (e) {
    console.warn('Failed to load QR image:', e);
  }

  if (headerStyle?.enabled && headerStyle.text) {
    const fontSize = parseInt(headerStyle.fontSize) || 144;
    const scaledFontSize = Math.round(fontSize * (CANVAS_WIDTH / 1200));
    ctx.font = `bold ${scaledFontSize}px ${headerStyle.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const qrCenterY = CANVAS_HEIGHT / 2;
    const qrTopEdge = qrCenterY - (QR_SIZE / 2) - 20;
    const verticalOffset = headerStyle.verticalOffset ?? 20;
    const textY = qrTopEdge - (verticalOffset * 4);
    const horizontalOffset = headerStyle.horizontalOffset ?? 0;
    const textX = (CANVAS_WIDTH / 2) + (horizontalOffset * 5);
    if (headerStyle.strokeColor && headerStyle.strokeWidth > 0) {
      ctx.strokeStyle = headerStyle.strokeColor;
      ctx.lineWidth = headerStyle.strokeWidth * 2;
      ctx.strokeText(headerStyle.text, textX, textY);
    }
    ctx.fillStyle = headerStyle.color;
    ctx.fillText(headerStyle.text, textX, textY);
  }

  if (footerStyle?.enabled && footerStyle.text) {
    const fontSize = parseInt(footerStyle.fontSize) || 144;
    const scaledFontSize = Math.round(fontSize * (CANVAS_WIDTH / 1200));
    ctx.font = `bold ${scaledFontSize}px ${footerStyle.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const qrCenterY = CANVAS_HEIGHT / 2;
    const qrBottomEdge = qrCenterY + (QR_SIZE / 2) + 20;
    const verticalOffset = footerStyle.verticalOffset ?? 20;
    const textY = qrBottomEdge + (verticalOffset * 4);
    const horizontalOffset = footerStyle.horizontalOffset ?? 0;
    const textX = (CANVAS_WIDTH / 2) + (horizontalOffset * 5);
    if (footerStyle.strokeColor && footerStyle.strokeWidth > 0) {
      ctx.strokeStyle = footerStyle.strokeColor;
      ctx.lineWidth = footerStyle.strokeWidth * 2;
      ctx.strokeText(footerStyle.text, textX, textY);
    }
    ctx.fillStyle = footerStyle.color;
    ctx.fillText(footerStyle.text, textX, textY);
  }

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

interface LandingPageSnapshotOptions {
  backgroundUrl: string | null;
  titleStyle: TextStyle | null;
  descriptionStyle: TextStyle | null;
}

async function generateLandingPageSnapshot(options: LandingPageSnapshotOptions): Promise<string> {
  const { backgroundUrl, titleStyle, descriptionStyle } = options;
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1920;
  
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (backgroundUrl) {
    try {
      const bgImg = await loadImage(backgroundUrl);
      const scale = Math.max(CANVAS_WIDTH / bgImg.width, CANVAS_HEIGHT / bgImg.height);
      const scaledWidth = bgImg.width * scale;
      const scaledHeight = bgImg.height * scale;
      const x = (CANVAS_WIDTH - scaledWidth) / 2;
      const y = (CANVAS_HEIGHT - scaledHeight) / 2;
      ctx.drawImage(bgImg, x, y, scaledWidth, scaledHeight);
    } catch (e) {
      console.warn('Failed to load background image for landing page:', e);
    }
  }

  if (titleStyle?.text) {
    const fontSize = parseInt(titleStyle.fontSize) || 72;
    const scaledFontSize = Math.round(fontSize * (CANVAS_WIDTH / 1200));
    ctx.font = `bold ${scaledFontSize}px ${titleStyle.fontFamily || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const verticalOffset = titleStyle.verticalOffset ?? 84;
    const horizontalOffset = titleStyle.horizontalOffset ?? 8;
    const textY = CANVAS_HEIGHT * (1 - verticalOffset / 100);
    const textX = (CANVAS_WIDTH / 2) + (horizontalOffset * 5);
    if (titleStyle.strokeColor && titleStyle.strokeWidth > 0) {
      ctx.strokeStyle = titleStyle.strokeColor;
      ctx.lineWidth = titleStyle.strokeWidth * 2;
      ctx.strokeText(titleStyle.text, textX, textY);
    }
    ctx.fillStyle = titleStyle.color || '#ffffff';
    ctx.fillText(titleStyle.text, textX, textY);
  }

  if (descriptionStyle?.text) {
    const fontSize = parseInt(descriptionStyle.fontSize) || 48;
    const scaledFontSize = Math.round(fontSize * (CANVAS_WIDTH / 1200));
    ctx.font = `${scaledFontSize}px ${descriptionStyle.fontFamily || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const verticalOffset = descriptionStyle.verticalOffset ?? 72;
    const horizontalOffset = descriptionStyle.horizontalOffset ?? 10;
    const textY = CANVAS_HEIGHT * (1 - verticalOffset / 100);
    const textX = (CANVAS_WIDTH / 2) + (horizontalOffset * 5);
    if (descriptionStyle.strokeColor && descriptionStyle.strokeWidth > 0) {
      ctx.strokeStyle = descriptionStyle.strokeColor;
      ctx.lineWidth = descriptionStyle.strokeWidth * 2;
      ctx.strokeText(descriptionStyle.text, textX, textY);
    }
    ctx.fillStyle = descriptionStyle.color || '#cccccc';
    ctx.fillText(descriptionStyle.text, textX, textY);
  }

  return canvas.toDataURL('image/png');
}

export function CreateGraphicsModule() {
  const { state, loadGraphic, selectedRole, selectedStore, selectedChannel } = useBuilderContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [packetResult, setPacketResult] = useState<PacketResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: pricingSettings } = useQuery<PricingSettings>({
    queryKey: ["/api/test/pricing-settings"],
    queryFn: async () => {
      const res = await fetch("/api/test/pricing-settings");
      if (!res.ok) throw new Error(`pricing-settings HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60000,
  });

  const isPlayMode = state.qrProductState === "qr_play";
  const isBasicsOrPlusMode = state.qrProductState === "qr_basics" || state.qrProductState === "qr_plus";
  const isHostedMode = state.qrProductState === "qr_canvas" || state.qrProductState === "qr_play" || state.qrProductState === "qr_dynamics";
  
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
    
    const requiresHosting = state.qrProductState === "qr_canvas" || 
                            state.qrProductState === "qr_play" || 
                            state.qrProductState === "qr_dynamics";
    
    let hostingCost = 0;
    if (requiresHosting) {
      const selectedTier = pricingSettings.hostingTiers.find(t => t.code === state.content.hostingTierCode) || pricingSettings.hostingTiers[0];
      hostingCost = selectedTier?.price || 0;
    }
    
    const subtotal = baseProductCost + placementCost + textUpcharge + hostingCost;
    const markupAmount = (subtotal * (pricingSettings.markupPercent / 100)) + pricingSettings.markupFixed;
    const customerPrice = subtotal + markupAmount;

    return {
      baseProductCost,
      placementCost,
      textUpcharge,
      hostingCost,
      subtotal,
      markupAmount,
      customerPrice,
      hostingTierCode: state.content.hostingTierCode || "1_year",
    };
  }, [pricingSettings, state.selectedProduct, state.selectedPlacements, state.content, state.qrProductState]);

  const handleCreatePacket = async () => {
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
        // Role/Store/Channel from top of page
        roleType: selectedRole || null,
        storeId: selectedStore?.id || null,
        storeName: selectedStore?.name || null,
        channelId: selectedChannel?.id || null,
        channelName: selectedChannel?.name || null,
      };

      if (isPlayMode && state.content?.playMediaSource === "url" && state.content?.playMediaUrl) {
        packetPayload.playMediaUrl = state.content.playMediaUrl;
      }

      const packetRes = await fetch("/api/test/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packetPayload),
      });

      if (!packetRes.ok) {
        const errData = await packetRes.json().catch(() => ({}));
        throw new Error(errData.error || `Packet API error ${packetRes.status}`);
      }

      const packetData = await packetRes.json();
      const packetId = packetData.packetId;

      if (isPlayMode && state.content?.playMediaSource === "upload" && state.content?.playMediaFile) {
        try {
          const file = state.content.playMediaFile;
          const fileName = file.name || `media${state.content.playMediaMimeType?.includes("video") ? ".mp4" : ".gif"}`;
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          });
          await fetch("/api/test/content/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "play",
              userId: "admin",
              packetId,
              base64Data,
              mimeType: file.type || state.content.playMediaMimeType || "video/mp4",
              fileName,
            }),
          });
        } catch (uploadErr) {
          console.warn("Play media upload error:", uploadErr);
        }
      }

      const baseUrl = window.location.origin;
      const isLandingPageMode = state.qrProductState === "qr_canvas" || state.qrProductState === "qr_play" || state.qrProductState === "qr_dynamics";
      const finalQrContent = isLandingPageMode
        ? `${baseUrl}/m/${landingPageSlug}`
        : (state.content?.url || state.content?.title || "");
      
      const productColorForQr = state.selectedColor?.hex || "#ffffff";
      const qrColorForFinal = getContrastQRColor(productColorForQr);
      const finalQrUrl = generateQRCodeUrl(finalQrContent.trim(), 3000, qrColorForFinal);

      const backgroundUrl = state.loadedBackground?.url || null;
      const headerStyle = state.content?.headerStyle as TextStyle | null;
      const footerStyle = state.content?.footerStyle as TextStyle | null;
      const titleStyle = state.content?.titleStyle as TextStyle | null;
      const descriptionStyle = state.content?.descriptionStyle as TextStyle | null;
      const productColorHex = state.selectedColor?.hex || null;
      
      let productGraphicUrl: string;
      try {
        productGraphicUrl = await generateProductGraphic({
          qrUrl: finalQrUrl,
          productColorHex,
          headerStyle,
          footerStyle,
          useTransparentBackground: false,
        });
      } catch (e) {
        console.warn('Product graphic generation failed:', e);
        productGraphicUrl = state.selectedProduct?.imageUrl || "";
      }

      let landingPageSnapshotUrl: string = "";
      if (isLandingPageMode) {
        try {
          landingPageSnapshotUrl = await generateLandingPageSnapshot({
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
                   state.qrProductState === "qr_dynamics" ? "dynamics" : "basics";
      
      try {
        const uploadRes = await fetch("/api/test/content/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          const uploadRes = await fetch("/api/test/content/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

      await fetch(`/api/test/packets/${packetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrOnlyUrl: finalQrUrl,
          productGraphicUrl,
          landingPageSnapshotUrl: landingPageSnapshotUrl || null,
          compositeUrl: productGraphicUrl,
          qrContent: finalQrContent.trim(),
        }),
      });

      await fetch("/api/test/graphics/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.content?.title || `Graphic - ${new Date().toLocaleDateString()}`,
          description: state.content?.description || "",
          category: state.qrProductState || "General",
          qrOnlyUrl: finalQrUrl,
          compositeUrl: productGraphicUrl,
          qrContent: finalQrContent,
          pricing,
          packetId,
        }),
      });

      const productColors = availableColors.length > 0 
        ? availableColors.map((c: any) => ({ name: c.name || c, hex: c.hex || c.color || '#000000' }))
        : [{ name: state.selectedColor?.name || 'Black', hex: state.selectedColor?.hex || '#000000' }];

      const templateSaveRes = await fetch("/api/test/templates/full-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.content?.title || `Template - ${new Date().toLocaleDateString()}`,
          description: state.content?.description || "",
          category: state.qrProductState || "General",
          productId: state.selectedProduct?.id || null,
          blueprintId: product?.blueprintId || 0,
          printProviderId: product?.printProviderId || 0,
          colors: productColors,
          placements: state.selectedPlacements || ["front"],
          qrSizes: ["small", "medium", "large"],
          artworkUrl: productGraphicUrl,
          artworkVariant: "black",
          thumbnailUrl: state.selectedProduct?.imageUrl || "",
          qrContent: finalQrContent,
          pricing,
          packetId,
        }),
      });
      
      const templateData = await templateSaveRes.json().catch(() => ({}));
      console.log(`[CreatePacket] Template saved, mockup jobs queued: ${templateData.jobsQueued || 0}`);

      fetch("/api/test/queue/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      }).catch(() => {});

      loadGraphic({ compositeUrl: productGraphicUrl, qrOnlyUrl: finalQrUrl });

      const initialResult: PacketResult = {
        packetId,
        landingPageUrl: finalQrContent,
        landingPageSnapshotUrl: landingPageSnapshotUrl || "",
        productGraphicUrl,
        qrOnlyUrl: finalQrUrl,
        pricing,
        priorityMockupUrl: null,
        priorityMockupLoading: true,
      };
      setPacketResult(initialResult);

      toast({
        title: "Packet Created",
        description: "Generating digital proof...",
      });

      const selectedPlacement = (state.selectedPlacements || ["front"])[0];
      const selectedSize = state.placementSizes?.[selectedPlacement] || "medium";
      
      fetch("/api/test/mockup/priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintId: product?.blueprintId || 0,
          printProviderId: product?.printProviderId || 99,
          colorName: state.selectedColor?.name || 'Black',
          colorHex: state.selectedColor?.hex || '#000000',
          placement: selectedPlacement + "-center",
          artworkUrl: productGraphicUrl,
          qrSize: selectedSize,
        }),
      })
        .then(res => res.json())
        .then(async data => {
          if (data.success && data.mockupUrl) {
            // Save the priority mockup URL to the packet so Store Builder can load it
            await fetch(`/api/test/packets/${packetId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ priorityMockupUrl: data.mockupUrl }),
            }).catch(() => {});
            
            setPacketResult(prev => prev ? { ...prev, priorityMockupUrl: data.mockupUrl, priorityMockupLoading: false } : prev);
            toast({ title: "Digital Proof Ready", description: "Your product preview is ready!" });
          } else {
            setPacketResult(prev => prev ? { ...prev, priorityMockupLoading: false } : prev);
          }
        })
        .catch(() => {
          setPacketResult(prev => prev ? { ...prev, priorityMockupLoading: false } : prev);
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
      navigate(`/test-store-builder?packetId=${packetResult.packetId}`);
    }
  };

  const handleReset = () => {
    setPacketResult(null);
    setError(null);
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
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-md border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">Complete these items first:</p>
                <ul className="text-sm text-amber-600 dark:text-amber-400 list-disc list-inside space-y-1">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationErrors.length === 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-950/50 rounded-md border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Ready to create your product packet
                </p>
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="w-full h-14 text-base bg-blue-600 hover:bg-blue-700"
              disabled={!canCreate || isCreating}
              onClick={handleCreatePacket}
              data-testid="button-create-packet"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating Packet...
                </>
              ) : (
                <>
                  <Package className="h-5 w-5 mr-2" />
                  Create Packet
                </>
              )}
            </Button>
          </>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-md border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {packetResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-5 w-5" />
              <span className="font-semibold">Packet Created Successfully</span>
            </div>

            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-300 dark:border-blue-700">
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Shirt className="h-5 w-5" />
                  Digital Proof - Your Product Preview
                </p>
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                  {packetResult.priorityMockupLoading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-sm">Generating preview...</span>
                    </div>
                  ) : packetResult.priorityMockupUrl ? (
                    <img
                      src={packetResult.priorityMockupUrl}
                      alt="Product Preview"
                      className="max-w-full max-h-[300px] h-auto object-contain rounded"
                      data-testid="img-priority-mockup"
                    />
                  ) : (
                    <div 
                      className="rounded-lg p-4 flex items-center justify-center"
                      style={{ backgroundColor: state.selectedColor?.hex || '#f9fafb' }}
                    >
                      <img
                        src={packetResult.productGraphicUrl}
                        alt="Product Graphic Preview"
                        className="max-w-[200px] h-auto object-contain"
                        data-testid="img-packet-product-graphic-fallback"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
              <CardContent className="p-3">
                <p className="text-sm font-medium mb-2 flex items-center gap-2 text-green-700 dark:text-green-300">
                  <ListChecks className="h-4 w-4" />
                  Completed Steps
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" />
                    <span>Packet created with pricing data</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" />
                    <span>QR code generated</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" />
                    <span>Composite graphic saved</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" />
                    <span>Mockup queue started for all colors</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3">
                <p className="text-xs font-medium mb-2 flex items-center gap-1 text-blue-700 dark:text-blue-300">
                  <Link2 className="h-3 w-3" />
                  Landing Page URL
                </p>
                <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border break-all">
                  {packetResult.landingPageUrl}
                </p>
              </CardContent>
            </Card>

            <p className="text-sm font-semibold mb-2">Generated Thumbnails</p>
            <div className="grid grid-cols-2 gap-3">
              <Card className="overflow-hidden">
                <CardContent className="p-2">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    Landing Page
                  </p>
                  <div className="bg-gray-900 rounded p-1 flex items-center justify-center min-h-[100px]">
                    {packetResult.landingPageSnapshotUrl ? (
                      <img
                        src={packetResult.landingPageSnapshotUrl}
                        alt="Landing Page Snapshot"
                        className="w-full max-w-[80px] h-auto object-contain"
                        data-testid="img-packet-landing-snapshot"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardContent className="p-2">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    Product Graphic
                  </p>
                  <div 
                    className="rounded p-1 flex items-center justify-center min-h-[100px]"
                    style={{ backgroundColor: state.selectedColor?.hex || '#f9fafb' }}
                  >
                    <img
                      src={packetResult.productGraphicUrl}
                      alt="Product Graphic"
                      className="w-full max-w-[80px] h-auto object-contain"
                      data-testid="img-packet-product-graphic"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardContent className="p-2">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <QrCode className="h-3 w-3" />
                    QR Code
                  </p>
                  <div className="bg-white rounded p-1 flex items-center justify-center min-h-[100px]">
                    <img
                      src={packetResult.qrOnlyUrl}
                      alt="QR Code"
                      className="w-full max-w-[80px] h-auto"
                      data-testid="img-packet-qr"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardContent className="p-2">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Shirt className="h-3 w-3" />
                    Mockup
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded p-1 flex items-center justify-center min-h-[100px]">
                    {packetResult.priorityMockupLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : packetResult.priorityMockupUrl ? (
                      <img
                        src={packetResult.priorityMockupUrl}
                        alt="Product Mockup"
                        className="w-full max-w-[80px] h-auto object-contain"
                        data-testid="img-packet-mockup"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">Generating...</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {pricingSettings && (
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4" />
                    Itemized Pricing
                  </h4>
                  
                  <div className="flex justify-between text-sm">
                    <span>Base Product Cost</span>
                    <span className="font-medium">${packetResult.pricing.baseProductCost.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Extra Placements</span>
                    <span className="font-medium">
                      {packetResult.pricing.placementCost > 0 ? `+$${packetResult.pricing.placementCost.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Text Lines</span>
                    <span className="font-medium">
                      {packetResult.pricing.textUpcharge > 0 ? `+$${packetResult.pricing.textUpcharge.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Hosting ({packetResult.pricing.hostingTierCode})</span>
                    <span className="font-medium">
                      {packetResult.pricing.hostingCost > 0 ? `+$${packetResult.pricing.hostingCost.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span>Subtotal</span>
                    <span className="font-medium">${packetResult.pricing.subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span>Markup</span>
                    <span className="font-medium">+${packetResult.pricing.markupAmount.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-lg font-bold border-t pt-2 text-green-700 dark:text-green-300">
                    <span>Customer Price</span>
                    <span>${packetResult.pricing.customerPrice.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1"
                data-testid="button-create-another"
              >
                Create Another
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="button-next-store-builder"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
