import { useState, useCallback } from "react";
import { Package, Loader2, Check, QrCode, Image, DollarSign, ArrowRight, Link2, Shirt, ListChecks, Trash2, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { ImageLightbox } from "@/features/shared/components/views/ImageLightbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
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
  priorityMockupError?: string | null;
}

// Always generates black QR code on white background for universal readability
function generateQRCodeUrl(content: string, size: number = 3000): string {
  // Black QR code on white background - always readable regardless of product color
  const qrColor = "000000";
  const bgColor = "ffffff";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}&format=png&qzone=2&ecc=H&color=${qrColor}&bgcolor=${bgColor}`;
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

async function fetchImageAsDataUrl(url: string): Promise<string> {
  try {
    console.log('[fetchImageAsDataUrl] Fetching:', url);
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const blob = await response.blob();
    console.log('[fetchImageAsDataUrl] Blob received, size:', blob.size);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        console.log('[fetchImageAsDataUrl] Converted to data URL successfully');
        resolve(reader.result as string);
      };
      reader.onerror = (e) => {
        console.error('[fetchImageAsDataUrl] FileReader error:', e);
        reject(e);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('[fetchImageAsDataUrl] Failed:', url, e);
    throw e;
  }
}

async function generateProductGraphic(options: ProductGraphicOptions): Promise<string> {
  // NOTE: This function generates ONLY QR code + text on a TRANSPARENT background
  // NO background image is used here - backgroundUrl is only for landing page snapshot
  const { qrUrl, productColorHex, headerStyle, footerStyle, useTransparentBackground } = options;
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1920;
  const QR_SIZE = 400;
  
  console.log('[generateProductGraphic] GENERATING TRANSPARENT PRODUCT GRAPHIC');
  console.log('[generateProductGraphic] Options:', { 
    qrUrl: qrUrl.substring(0, 50) + '...', 
    productColorHex, 
    useTransparentBackground,
    hasHeader: !!headerStyle?.enabled,
    hasFooter: !!footerStyle?.enabled 
  });
  console.log('[generateProductGraphic] NO BACKGROUND IMAGE WILL BE USED');
  
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas not supported');

  // ALWAYS start with a transparent canvas - no background image, no solid fill
  console.log('[generateProductGraphic] Clearing canvas to TRANSPARENT');
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Only fill with color if NOT using transparent background (but we always use transparent now)
  if (!useTransparentBackground && productColorHex) {
    console.log('[generateProductGraphic] WARNING: Filling with product color (not transparent)');
    ctx.fillStyle = productColorHex;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else if (!useTransparentBackground) {
    console.log('[generateProductGraphic] WARNING: Filling with white (not transparent)');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  try {
    // Fetch QR as data URL to avoid CORS issues with external QR API
    const qrDataUrl = await fetchImageAsDataUrl(qrUrl);
    const qrImg = await loadImage(qrDataUrl);
    const qrX = (CANVAS_WIDTH - QR_SIZE) / 2;
    const qrY = (CANVAS_HEIGHT - QR_SIZE) / 2;
    // Only add white background behind QR if NOT using transparent background
    if (!useTransparentBackground) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX - 20, qrY - 20, QR_SIZE + 40, QR_SIZE + 40);
    }
    ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);
    console.log('[generateProductGraphic] QR drawn successfully');
  } catch (e) {
    console.warn('[generateProductGraphic] Failed to load QR image:', e);
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
    img.onerror = (e) => {
      console.error(`[loadImage] Failed to load: ${src}`, e);
      reject(new Error(`Failed to load image: ${src}`));
    };
    // Convert relative URLs to absolute for canvas CORS
    const absoluteSrc = src.startsWith('/') ? `${window.location.origin}${src}` : src;
    console.log(`[loadImage] Loading: ${absoluteSrc}`);
    img.src = absoluteSrc;
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
  
  console.log('[generateLandingPageSnapshot] Starting with:', { backgroundUrl, titleStyle, descriptionStyle });
  
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (backgroundUrl) {
    try {
      console.log('[generateLandingPageSnapshot] Loading background...');
      const bgImg = await loadImage(backgroundUrl);
      const scale = Math.min(CANVAS_WIDTH / bgImg.width, CANVAS_HEIGHT / bgImg.height);
      const scaledWidth = bgImg.width * scale;
      const scaledHeight = bgImg.height * scale;
      const x = (CANVAS_WIDTH - scaledWidth) / 2;
      const y = (CANVAS_HEIGHT - scaledHeight) / 2;
      ctx.drawImage(bgImg, x, y, scaledWidth, scaledHeight);
      console.log('[generateLandingPageSnapshot] Background drawn successfully');
    } catch (e) {
      console.warn('[generateLandingPageSnapshot] Failed to load background image:', e);
    }
  } else {
    console.log('[generateLandingPageSnapshot] No background URL provided');
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
  const { apiBase } = useAdminAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [packetResult, setPacketResult] = useState<PacketResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailLightbox, setThumbnailLightbox] = useState<string | null>(null);

  const { data: pricingSettings } = useQuery<PricingSettings>({
    queryKey: [`${apiBase}/pricing-settings`],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/pricing-settings`);
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
    
    // Note: Hosting cost is NOT charged to admins - customers select hosting plan at checkout
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
    console.log('[CreateGraphics] canCreate:', canCreate, 'isCreating:', isCreating);
    console.log('[CreateGraphics] state.selectedProduct:', state.selectedProduct?.id);
    console.log('[CreateGraphics] state.selectedColor:', state.selectedColor);
    console.log('[CreateGraphics] state.content:', state.content);
    if (!canCreate || isCreating) {
      console.log('[CreateGraphics] Blocked - canCreate:', canCreate, 'isCreating:', isCreating);
      return;
    }

    setIsCreating(true);
    setError(null);
    setPacketResult(null);

    try {
      console.log('[CreateGraphics] Calculating pricing...');
      const pricing = calculatePricing();
      if (!pricing) throw new Error("Could not calculate pricing");
      console.log('[CreateGraphics] Pricing calculated:', pricing);

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
        // Fulfillment provider
        fulfillmentProvider: state.fulfillmentProvider || 'printify',
      };

      if (isPlayMode && state.content?.playMediaSource === "url" && state.content?.playMediaUrl) {
        packetPayload.playMediaUrl = state.content.playMediaUrl;
      }

      const packetRes = await fetch(`${apiBase}/packets`, {
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

      let uploadedPlayMediaUrl: string | null = null;
      let uploadedPlayMediaType: string | null = null;
      
      if (isPlayMode && state.content?.playMediaSource === "upload" && state.content?.playMediaFile) {
        try {
          const file = state.content.playMediaFile;
          console.log('[CreatePacket] playMediaFile object:', file, 'instanceof File:', file instanceof File, 'instanceof Blob:', file instanceof Blob);
          const fileName = file.name || `media${state.content.playMediaMimeType?.includes("video") ? ".mp4" : ".gif"}`;
          console.log('[CreatePacket] Uploading play media file:', fileName, 'size:', file.size, 'type:', file.type);
          
          if (!file.size || file.size === 0) {
            throw new Error("File is empty (0 bytes). Please select a valid video file.");
          }
          
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              console.log('[CreatePacket] FileReader result length:', result?.length || 0);
              if (!result || result.length < 100) {
                reject(new Error("File could not be read - appears empty or corrupted"));
                return;
              }
              resolve(result);
            };
            reader.onerror = () => reject(new Error("Failed to read file: " + reader.error?.message));
            reader.readAsDataURL(file);
          });
          
          console.log('[CreatePacket] Base64 data length:', base64Data.length);
          
          const uploadRes = await fetch(`${apiBase}/content/upload`, {
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
          
          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            console.error('[CreatePacket] Play media upload failed:', errData);
            throw new Error(errData.error || `Upload failed: ${uploadRes.status}`);
          }
          
          const uploadData = await uploadRes.json();
          console.log('[CreatePacket] Play media uploaded successfully:', uploadData.publicUrl);
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
      const isLandingPageMode = state.qrProductState === "qr_canvas" || state.qrProductState === "qr_play" || state.qrProductState === "qr_dynamics" || state.qrProductState === "qr_plus";
      const finalQrContent = isLandingPageMode
        ? `${baseUrl}/m/${landingPageSlug}`
        : (state.content?.url || state.content?.title || "");
      
      // Generate single QR code - always black on white background for universal readability
      const qrUrl = generateQRCodeUrl(finalQrContent.trim(), 3000);

      const backgroundUrl = state.loadedBackground?.url || null;
      const headerStyle = state.content?.headerStyle as TextStyle | null;
      const footerStyle = state.content?.footerStyle as TextStyle | null;
      const titleStyle = state.content?.titleStyle as TextStyle | null;
      const descriptionStyle = state.content?.descriptionStyle as TextStyle | null;
      const productColorHex = state.selectedColor?.hex || null;
      
      let productGraphicUrl: string;
      try {
        productGraphicUrl = await generateProductGraphic({
          qrUrl,
          productColorHex,
          headerStyle,
          footerStyle,
          useTransparentBackground: true,  // Save with transparent background
        });
      } catch (e) {
        console.warn('Product graphic generation failed:', e);
        productGraphicUrl = "";
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
        const uploadRes = await fetch(`${apiBase}/content/upload`, {
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
          const uploadRes = await fetch(`${apiBase}/content/upload`, {
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

      await fetch(`${apiBase}/packets/${packetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

      await fetch(`${apiBase}/graphics/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const templateSaveRes = await fetch(`${apiBase}/templates/full-save`, {
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
          thumbnailUrl: productGraphicUrl || "",
          qrContent: finalQrContent,
          pricing,
          packetId,
        }),
      });
      
      const templateData = await templateSaveRes.json().catch(() => ({}));
      console.log(`[CreatePacket] Template saved, mockup jobs queued: ${templateData.jobsQueued || 0}`);

      fetch(`${apiBase}/queue/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      }).catch(() => {});

      // Create storeProductLink if store and channel are selected (locks in assignment before Store Builder)
      if (selectedStore?.id && selectedChannel?.name) {
        try {
          const linkRes = await fetch(`${apiBase}/store-product-links`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            console.log(`[CreatePacket] Store product link created: ${linkData.linkId} for ${selectedStore.name}/${selectedChannel.name}`);
          } else {
            console.warn('[CreatePacket] Failed to create store product link:', await linkRes.text());
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

      const selectedPlacement = (state.selectedPlacements || ["front"])[0];
      const selectedSize = state.placementSizes?.[selectedPlacement] || "medium";
      
      const placementToCanonical: Record<string, string> = {
        "front": "FRONT_CHEST",
        "front-center": "FRONT_CHEST",
        "front-chest": "FRONT_CHEST",
        "front-pocket": "FRONT_POCKET",
        "back": "BACK_FULL",
        "back-full": "BACK_FULL",
        "back-upper": "BACK_UPPER",
        "left-sleeve": "LEFT_SLEEVE",
        "left-shoulder": "LEFT_SLEEVE",
        "right-sleeve": "RIGHT_SLEEVE",
        "right-shoulder": "RIGHT_SLEEVE",
        "hood-front": "HOOD_FRONT",
        "hood-back": "HOOD_BACK",
        "hat-front": "HAT_FRONT",
        "hat-back": "HAT_BACK",
      };
      const canonicalPlacement = placementToCanonical[selectedPlacement.toLowerCase()] || "FRONT_CHEST";
      
      console.log('[CreatePacket] Requesting priority mockup:', {
        blueprintId: product?.blueprintId,
        printProviderId: product?.printProviderId,
        colorName: state.selectedColor?.name,
        placement: selectedPlacement,
        canonicalPlacement,
        artworkUrl: productGraphicUrl?.substring(0, 100),
        fulfillmentProvider: state.fulfillmentProvider,
      });
      
      fetch(`${apiBase}/mockup/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintId: product?.blueprintId || 0,
          printProviderId: product?.printProviderId || 99,
          colorName: state.selectedColor?.name || 'Black',
          colorHex: state.selectedColor?.hex || '#000000',
          placement: canonicalPlacement,
          artworkUrl: productGraphicUrl,
          qrSize: selectedSize,
          fulfillmentProvider: state.fulfillmentProvider || 'printify',
        }),
      })
        .then(res => res.json())
        .then(async data => {
          console.log('[CreatePacket] Mockup response:', data);
          if (data.success && data.mockupUrl) {
            await fetch(`${apiBase}/packets/${packetId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ priorityMockupUrl: data.mockupUrl }),
            }).catch(() => {});
            
            setPacketResult(prev => prev ? { ...prev, priorityMockupUrl: data.mockupUrl, priorityMockupLoading: false } : prev);
            toast({ title: "Digital Proof Ready", description: "Your product preview is ready!" });
          } else {
            const errorMsg = data.error || data.message || "Mockup generation failed";
            console.warn('[CreatePacket] Mockup failed:', errorMsg);
            setPacketResult(prev => prev ? { ...prev, priorityMockupLoading: false, priorityMockupError: errorMsg } : prev);
            toast({ 
              title: "Mockup Generation Failed", 
              description: errorMsg,
              variant: "destructive" 
            });
          }
        })
        .catch((err) => {
          const errorMsg = err.message || "Failed to connect to mockup service";
          console.error('[CreatePacket] Mockup fetch error:', err);
          setPacketResult(prev => prev ? { ...prev, priorityMockupLoading: false, priorityMockupError: errorMsg } : prev);
          toast({ 
            title: "Mockup Service Error", 
            description: errorMsg,
            variant: "destructive" 
          });
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

  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDeletePacket = async () => {
    if (!packetResult?.packetId || isDeleting) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`${apiBase}/packets/${packetResult.packetId}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        toast({
          title: "Packet Deleted",
          description: "Starting fresh...",
        });
        setPacketResult(null);
        setError(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Delete failed: ${res.status}`);
      }
    } catch (err: any) {
      console.error("Delete packet failed:", err);
      toast({
        title: "Delete Failed",
        description: err.message || "Could not delete packet",
        variant: "destructive",
      });
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
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
              <Check className="h-6 w-6" />
              <span className="font-bold text-lg">Packet Created Successfully</span>
            </div>

            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-300 dark:border-blue-700">
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Shirt className="h-5 w-5" />
                  Digital Proof - Your Product Preview
                </p>
                <div 
                  className="rounded-lg p-4 flex items-center justify-center min-h-[200px]"
                  style={{ backgroundColor: state.selectedColor?.hex || '#f9fafb' }}
                >
                  {packetResult.priorityMockupLoading ? (
                    <div className="flex flex-col items-center gap-2 text-white/80">
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
                      className="relative rounded-lg overflow-hidden"
                    >
                      {/* Swatch background layer */}
                      <div 
                        className="absolute inset-0"
                        style={{ backgroundColor: state.selectedColor?.hex || '#333333' }}
                      />
                      {/* Transparent graphic on top */}
                      <img
                        src={packetResult.productGraphicUrl}
                        alt="Product Graphic Preview"
                        className="relative z-10 max-w-[200px] h-auto object-contain"
                        data-testid="img-packet-product-graphic-fallback"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <p className="text-base font-semibold mb-3 flex items-center gap-2 text-green-700 dark:text-green-300">
                  <ListChecks className="h-5 w-5" />
                  Completed Steps
                </p>
                <div className="space-y-2 text-base">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span>Packet created with pricing data</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span>QR code generated</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span>Composite graphic saved</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span>Mockup queue started for all colors</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedStore && selectedChannel && (
              <Card className="bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-700">
                <CardContent className="p-4">
                  <p className="text-base font-semibold mb-2 flex items-center gap-2 text-purple-800 dark:text-purple-200">
                    <Store className="h-5 w-5" />
                    Assigned to Store
                  </p>
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      {selectedStore.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Channel: {selectedChannel.name}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

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

            <p className="text-base font-bold mb-3">Generated Thumbnails</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Hide Landing Page thumbnail for Play and Basics modes - they don't have landing pages */}
              {!isPlayMode && !isBasicsOrPlusMode && (
                <Card className="overflow-hidden">
                  <CardContent className="p-3">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Landing Page
                    </p>
                    {packetResult.landingPageSnapshotUrl ? (
                      <button 
                        type="button"
                        className="w-full bg-gray-900 rounded p-1 flex items-center justify-center min-h-[100px] cursor-pointer hover-elevate"
                        onClick={() => setThumbnailLightbox(packetResult.landingPageSnapshotUrl)}
                        data-testid="btn-landing-snapshot"
                      >
                        <img
                          src={packetResult.landingPageSnapshotUrl}
                          alt="Landing Page Snapshot"
                          className="w-full max-w-[80px] h-auto object-contain"
                          data-testid="img-packet-landing-snapshot"
                        />
                      </button>
                    ) : (
                      <div className="bg-gray-900 rounded p-1 flex items-center justify-center min-h-[100px]">
                        <span className="text-xs text-gray-400">N/A</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="overflow-hidden">
                <CardContent className="p-3">
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Product Graphic
                  </p>
                  <button 
                    type="button"
                    className="w-full rounded p-1 flex items-center justify-center min-h-[100px] cursor-pointer relative"
                    style={{ backgroundColor: state.selectedColor?.hex || '#f9fafb' }}
                    onClick={() => setThumbnailLightbox(packetResult.productGraphicUrl)}
                    data-testid="btn-product-graphic"
                  >
                    {/* Transparent graphic on swatch background */}
                    <img
                      src={packetResult.productGraphicUrl}
                      alt="Product Graphic"
                      className="relative z-10 w-full max-w-[80px] h-auto object-contain"
                      data-testid="img-packet-product-graphic"
                    />
                  </button>
                  <p className="text-xs text-muted-foreground mt-1 text-center" data-testid="text-swatch-color">
                    On {state.selectedColor?.name || 'selected color'}
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden col-span-2">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    QR Code
                  </p>
                  <div className="flex justify-center">
                    <button 
                      type="button"
                      className="rounded p-3 flex items-center justify-center cursor-pointer hover-elevate bg-white border"
                      onClick={() => setThumbnailLightbox(packetResult.qrOnlyUrl)}
                      data-testid="btn-qr-code"
                    >
                      <img
                        src={packetResult.qrOnlyUrl}
                        alt="QR Code"
                        className="w-full max-w-[200px] h-auto"
                        data-testid="img-packet-qr"
                      />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    Black on white - readable on any product color
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden col-span-2">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shirt className="h-4 w-4" />
                    Mockup Preview
                  </p>
                  {packetResult.priorityMockupLoading ? (
                    <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 flex items-center justify-center min-h-[120px]">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : packetResult.priorityMockupUrl ? (
                    <button 
                      type="button"
                      className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 flex items-center justify-center min-h-[120px] cursor-pointer hover-elevate"
                      onClick={() => setThumbnailLightbox(packetResult.priorityMockupUrl!)}
                      data-testid="btn-mockup"
                    >
                      <img
                        src={packetResult.priorityMockupUrl}
                        alt="Product Mockup"
                        className="w-full max-w-[200px] h-auto object-contain"
                        data-testid="img-packet-mockup"
                      />
                    </button>
                  ) : packetResult.priorityMockupError ? (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-3 min-h-[120px]">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Mockup Failed</p>
                      <p className="text-xs text-red-600 dark:text-red-400">{packetResult.priorityMockupError}</p>
                    </div>
                  ) : (
                    <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 flex items-center justify-center min-h-[120px]">
                      <span className="text-xs text-gray-400">Generating...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {pricingSettings && (
              <Card className="border-2">
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4" />
                    Itemized Pricing
                  </h4>
                  
                  <div className="flex justify-between text-base font-semibold">
                    <span>Provider Cost</span>
                    <span className="text-lg">${packetResult.pricing.baseProductCost.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Extra Placements</span>
                    <span>
                      {packetResult.pricing.placementCost > 0 ? `+$${packetResult.pricing.placementCost.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Text Lines</span>
                    <span>
                      {packetResult.pricing.textUpcharge > 0 ? `+$${packetResult.pricing.textUpcharge.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span>Subtotal</span>
                    <span className="font-medium">${packetResult.pricing.subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="bg-muted/50 rounded px-2 py-2 -mx-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Your Markup</span>
                      <span className="font-bold text-base">{packetResult.pricing.markupPercent}%</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold">
                      <span>Calculated</span>
                      <span>+${packetResult.pricing.markupAmount.toFixed(2)}</span>
                    </div>
                    {packetResult.pricing.markupFixed > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Fixed markup included</span>
                        <span>+${packetResult.pricing.markupFixed.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Customer Price</span>
                    <span>${packetResult.pricing.customerPrice.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-5 pt-8">
              <button
                type="button"
                onClick={handleNext}
                className="qr-btn qr-btn--primary qr-btn--touch qr-btn--xxl qr-btn--full"
                data-testid="button-next-store-builder"
              >
                <ArrowRight className="h-7 w-7" />
                Continue to Store Builder
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="qr-btn qr-btn--outline qr-btn--touch qr-btn--xl qr-btn--full"
                data-testid="button-create-another"
              >
                Create Another Product
              </button>
              <button
                type="button"
                onClick={handleDeletePacket}
                disabled={isDeleting}
                className={`qr-btn qr-btn--ghost qr-btn--touch qr-btn--xl qr-btn--full ${isDeleting ? 'opacity-50' : ''}`}
                style={{ color: '#ef4444' }}
                data-testid="button-delete-packet"
              >
                {isDeleting ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Trash2 className="h-6 w-6" />
                )}
                Delete This Packet
              </button>
            </div>
          </div>
        )}

        <ImageLightbox
          imageUrl={thumbnailLightbox}
          onClose={() => setThumbnailLightbox(null)}
        />
      </div>
    </CollapsibleModule>
  );
}
