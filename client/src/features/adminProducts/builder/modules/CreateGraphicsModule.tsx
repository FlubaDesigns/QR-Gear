import { useState, useCallback } from "react";
import { Wand2, Loader2, Check, Image, QrCode, DollarSign, Save, ArrowRight, Library, Store, ArrowLeft } from "lucide-react";
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

interface LocalGraphics {
  qrOnlyUrl: string;
  compositeUrl: string;
  compositeDataUrl: string;
  generatedAt: Date;
}

interface GeneratedGraphics {
  qrOnlyUrl: string;
  compositeUrl: string;
  generatedAt: Date;
  packetId: string;
}

interface CreateGraphicsModuleProps {
  onGraphicsCreated?: (graphics: GeneratedGraphics, pricing: PricingBreakdown, packetId: string) => void;
  onSaveComplete?: () => void;
}

function generateQRCodeUrl(content: string, size: number = 3000, qrColor: "black" | "white" = "black"): string {
  const color = qrColor === "white" ? "ffffff" : "000000";
  const bgColor = qrColor === "white" ? "00000000" : "ffffff"; // transparent bg for white QR
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

interface CompositeOptions {
  qrUrl: string;
  backgroundUrl: string | null;
  productColorHex: string | null;
  headerStyle: TextStyle | null;
  footerStyle: TextStyle | null;
  useTransparentBackground?: boolean;
}

async function generateCompositeGraphic(options: CompositeOptions): Promise<string> {
  const { qrUrl, backgroundUrl, productColorHex, headerStyle, footerStyle, useTransparentBackground } = options;
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1920;
  const QR_SIZE = 400;
  
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Background: transparent, product color, or white
  if (useTransparentBackground) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else if (productColorHex) {
    ctx.fillStyle = productColorHex;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Draw background image if provided (for landing page composite)
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
      console.warn('Failed to load background image:', e);
    }
  }

  // Draw QR code with white border for scanability
  try {
    const qrImg = await loadImage(qrUrl);
    const qrX = (CANVAS_WIDTH - QR_SIZE) / 2;
    const qrY = (CANVAS_HEIGHT - QR_SIZE) / 2;
    
    // White border around QR for scanability on any background
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

type SavePath = "store" | "library" | null;

export function CreateGraphicsModule({ onGraphicsCreated, onSaveComplete }: CreateGraphicsModuleProps) {
  const { state, loadGraphic } = useBuilderContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localGraphics, setLocalGraphics] = useState<LocalGraphics | null>(null);
  const [calculatedPricing, setCalculatedPricing] = useState<PricingBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<SavePath>(null);
  const [saveComplete, setSaveComplete] = useState(false);
  const [savedPacketId, setSavedPacketId] = useState<string | null>(null);

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
  const hasPlayMedia = isPlayMode && (
    (state.content.playMediaSource === "url" && state.content.playMediaUrl) ||
    (state.content.playMediaSource === "upload" && state.content.playMediaFile)
  );
  const playPermissionOk = !isPlayMode || state.content.playPermissionConfirmed;
  const hasRequiredContent = isPlayMode ? hasPlayMedia : (state.content.url || state.content.title);

  const canCreate = Boolean(
    state.selectedProduct &&
    state.qrProductState &&
    hasRequiredContent &&
    playPermissionOk
  );

  const calculatePricing = useCallback((): PricingBreakdown | null => {
    if (!pricingSettings || !state.selectedProduct) return null;

    const product = state.selectedProduct as any;
    const baseProductCost = parseFloat(product.maxPrice || product.basePrice || product.minPrice || product.customerPrice || "0");
    
    const placementCount = (state.selectedPlacements || []).length || 1;
    const additionalPlacements = Math.max(0, placementCount - 1);
    const placementCost = additionalPlacements * pricingSettings.additionalPlacementCost;
    
    let textLineCount = 0;
    if (state.content.headerStyle?.enabled && state.content.headerStyle.text) {
      textLineCount++;
    }
    if (state.content.footerStyle?.enabled && state.content.footerStyle.text) {
      textLineCount++;
    }
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

  const handleCreateGraphics = async () => {
    if (!canCreate) return;

    setIsGenerating(true);
    setError(null);
    setSelectedPath(null);
    setSaveComplete(false);
    setSavedPacketId(null);

    try {
      const pricing = calculatePricing();
      
      const qrContent = isPlayMode 
        ? "PLACEHOLDER_PLAY_URL"
        : (state.content.url || state.content.title || "").trim();
      
      // Auto-contrast QR color based on product color
      const productColorHexTemp = state.selectedColor?.hex || "#ffffff";
      const qrColor = getContrastQRColor(productColorHexTemp);
      const qrUrl = generateQRCodeUrl(qrContent, 3000, qrColor);
      
      await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error("Failed to generate QR code"));
        img.src = qrUrl;
      });

      const backgroundUrl = state.loadedBackground?.url || null;
      const headerStyle = state.content.headerStyle as TextStyle | null;
      const footerStyle = state.content.footerStyle as TextStyle | null;
      const productColorHex = state.selectedColor?.hex || null;
      
      let compositeDataUrl: string;
      try {
        compositeDataUrl = await generateCompositeGraphic({
          qrUrl,
          backgroundUrl,
          productColorHex,
          headerStyle,
          footerStyle,
          useTransparentBackground: false,
        });
      } catch (e) {
        console.warn('Composite generation failed, using product image as fallback:', e);
        compositeDataUrl = state.selectedProduct?.imageUrl || "";
      }

      loadGraphic({ 
        compositeUrl: compositeDataUrl, 
        qrOnlyUrl: qrUrl 
      });
      
      const graphics: LocalGraphics = {
        qrOnlyUrl: qrUrl,
        compositeUrl: compositeDataUrl,
        compositeDataUrl,
        generatedAt: new Date(),
      };

      setLocalGraphics(graphics);
      setCalculatedPricing(pricing);

    } catch (err: any) {
      console.error("Graphics creation failed:", err);
      setError(err.message || "Failed to create graphics");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (path: SavePath) => {
    console.log("[CreateGraphics] handleSave called with path:", path);
    console.log("[CreateGraphics] localGraphics:", !!localGraphics);
    console.log("[CreateGraphics] calculatedPricing:", !!calculatedPricing);
    console.log("[CreateGraphics] isSaving:", isSaving);
    
    if (!localGraphics) {
      console.error("[CreateGraphics] No localGraphics - user must click Create Graphics first");
      toast({ title: "Error", description: "Please create graphics preview first", variant: "destructive" });
      return;
    }
    if (!calculatedPricing) {
      console.error("[CreateGraphics] No calculatedPricing");
      toast({ title: "Error", description: "Pricing not calculated", variant: "destructive" });
      return;
    }
    if (!path) {
      console.error("[CreateGraphics] No path specified");
      return;
    }
    if (isSaving) {
      console.log("[CreateGraphics] Already saving, ignoring");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSelectedPath(path);

    try {
      const product = state.selectedProduct as any;
      const availableColors = product?.availableColors || [];
      const availableSizes = product?.availableSizes || [];
      const availablePlacements = product?.availablePlacements || [];

      // Generate SEO-friendly slug from title
      const generateSlug = (text: string): string => {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
      };
      
      const landingPageSlug = generateSlug(state.content.title || 'product') + '-' + Date.now().toString(36);
      
      const packetPayload: Record<string, any> = {
        qrOnlyUrl: "",
        compositeUrl: "",
        qrContent: isPlayMode ? "" : (state.content.url || state.content.title || "").trim(),
        headerText: state.content.headerStyle?.enabled ? state.content.headerStyle.text : null,
        footerText: state.content.footerStyle?.enabled ? state.content.footerStyle.text : null,
        headerStyle: state.content.headerStyle?.enabled ? state.content.headerStyle : null,
        footerStyle: state.content.footerStyle?.enabled ? state.content.footerStyle : null,
        backgroundUrl: state.loadedBackground?.url || null,
        pricing: calculatedPricing,
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
        availablePlacements,
        sizes: availableSizes,
        colors: availableColors,
        basePrice: product?.basePrice || null,
        customerPrice: product?.customerPrice || null,
        mockupsByColor: product?.mockupsByColor || null,
        // Landing page fields
        landingPageTitle: state.content.title || null,
        landingPageDescription: state.content.description || null,
        landingPageBackgroundUrl: state.loadedBackground?.url || null,
        landingPageSlug,
      };

      if (isPlayMode && state.content.playMediaSource === "url" && state.content.playMediaUrl) {
        packetPayload.playMediaUrl = state.content.playMediaUrl;
      }

      console.log("[CreateGraphics] Creating packet...", packetPayload);
      const packetRes = await fetch("/api/test/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packetPayload),
      });

      if (!packetRes.ok) {
        const errData = await packetRes.json().catch(() => ({}));
        console.error("[CreateGraphics] Packet creation failed:", errData);
        throw new Error(errData.error || `Packet API error ${packetRes.status}`);
      }

      const packetData = await packetRes.json();
      const packetId = packetData.packetId;
      console.log("[CreateGraphics] Packet created:", packetId);

      if (isPlayMode && state.content.playMediaSource === "upload" && state.content.playMediaFile) {
        try {
          const file = state.content.playMediaFile;
          const fileName = file.name || `media${state.content.playMediaMimeType?.includes("video") ? ".mp4" : ".gif"}`;
          
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          });
          
          const uploadRes = await fetch("/api/test/content/upload", {
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
          
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            console.log("[CreateGraphics] Play media uploaded to:", uploadData.publicUrl);
          }
        } catch (uploadErr) {
          console.warn("[CreateGraphics] Play media upload error:", uploadErr);
        }
      }

      // Generate final QR content URL
      // For Canvas/Play/Dynamics: use landing page URL (qrgear.com/m/{slug})
      // For Basics: use the text content directly
      const baseUrl = window.location.origin;
      const isLandingPageMode = state.qrProductState === "qr_canvas" || state.qrProductState === "qr_play" || state.qrProductState === "qr_dynamics";
      const finalQrContent = isLandingPageMode
        ? `${baseUrl}/m/${landingPageSlug}`
        : (state.content.url || state.content.title || "");
      
      // Auto-contrast QR color for final URL
      const productColorForQr = state.selectedColor?.hex || "#ffffff";
      const qrColorForFinal = getContrastQRColor(productColorForQr);
      
      const finalQrUrl = isLandingPageMode 
        ? generateQRCodeUrl(finalQrContent.trim(), 3000, qrColorForFinal)
        : localGraphics.qrOnlyUrl;

      let finalCompositeUrl = localGraphics.compositeDataUrl;
      
      // Regenerate composite with final QR URL for landing page modes
      if (isLandingPageMode) {
        const backgroundUrl = state.loadedBackground?.url || null;
        const headerStyle = state.content.headerStyle as TextStyle | null;
        const footerStyle = state.content.footerStyle as TextStyle | null;
        const productColorHex = state.selectedColor?.hex || null;
        try {
          finalCompositeUrl = await generateCompositeGraphic({
            qrUrl: finalQrUrl,
            backgroundUrl,
            productColorHex,
            headerStyle,
            footerStyle,
            useTransparentBackground: false,
          });
        } catch (e) {
          console.warn('Composite regeneration failed:', e);
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
            base64Data: finalCompositeUrl,
            mimeType: "image/png",
            fileName: `${packetId}-composite.png`,
          }),
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalCompositeUrl = uploadData.publicUrl;
        }
      } catch (uploadErr) {
        console.warn("[CreateGraphics] Upload error, using data URL as fallback:", uploadErr);
      }

      await fetch(`/api/test/packets/${packetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrOnlyUrl: finalQrUrl,
          compositeUrl: finalCompositeUrl,
          qrContent: finalQrContent.trim(),
        }),
      });

      const graphicsPayload = {
        name: state.content.title || `Graphic - ${new Date().toLocaleDateString()}`,
        description: state.content.description || "",
        category: state.qrProductState || "General",
        qrOnlyUrl: finalQrUrl,
        compositeUrl: finalCompositeUrl,
        qrContent: finalQrContent,
        pricing: calculatedPricing,
        packetId,
      };

      await fetch("/api/test/graphics/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graphicsPayload),
      });

      const templatePayload = {
        name: state.content.title || `Template - ${new Date().toLocaleDateString()}`,
        description: state.content.description || "",
        category: state.qrProductState || "General",
        productId: state.selectedProduct?.id || null,
        blueprintId: product?.blueprintId || 0,
        printProviderId: product?.printProviderId || 0,
        colors: [],
        placements: state.selectedPlacements || ["front"],
        qrSizes: ["small", "medium", "large"],
        artworkUrl: finalCompositeUrl,
        artworkVariant: "black",
        thumbnailUrl: state.selectedProduct?.imageUrl || "",
        qrContent: finalQrContent,
        pricing: calculatedPricing,
        packetId,
      };

      await fetch("/api/test/templates/full-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templatePayload),
      });

      fetch("/api/test/queue/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      }).catch(() => {});

      const generatedGraphics: GeneratedGraphics = {
        qrOnlyUrl: finalQrUrl,
        compositeUrl: finalCompositeUrl,
        generatedAt: new Date(),
        packetId,
      };

      console.log("[CreateGraphics] Save complete, packetId:", packetId, "path:", path);
      onGraphicsCreated?.(generatedGraphics, calculatedPricing, packetId);
      setSaveComplete(true);
      setSavedPacketId(packetId);

      if (path === "store") {
        console.log("[CreateGraphics] Navigating to Store Builder...");
        toast({
          title: "Saved Successfully",
          description: "Opening Store Builder with your product...",
        });
        setTimeout(() => {
          console.log("[CreateGraphics] Executing navigation to:", `/test-store-builder?packetId=${packetId}`);
          navigate(`/test-store-builder?packetId=${packetId}`);
          onSaveComplete?.();
        }, 800);
      } else {
        toast({
          title: "Saved to Library",
          description: "Graphics and template saved! You can find them in the library.",
        });
      }

    } catch (err: any) {
      console.error("[CreateGraphics] Save failed:", err);
      setError(err.message || "Failed to save");
      toast({ title: "Save Failed", description: err.message || "Failed to save", variant: "destructive" });
      setSelectedPath(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalGraphics(null);
    setCalculatedPricing(null);
    setSelectedPath(null);
    setSaveComplete(false);
    setSavedPacketId(null);
    setError(null);
  };

  if (!state.selectedProduct || !state.qrProductState) {
    return null;
  }

  return (
    <CollapsibleModule
      title="Create Graphics"
      icon={<Wand2 className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {!localGraphics && (
          <>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Click the button below to preview your QR code graphics and calculate pricing. 
                Nothing is saved until you choose where to send it.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full h-14 text-base"
              disabled={!canCreate || isGenerating}
              onClick={handleCreateGraphics}
              data-testid="button-create-graphics"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating Preview...
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5 mr-2" />
                  Create Graphics Preview
                </>
              )}
            </Button>

            {!canCreate && (
              <div className="text-sm text-muted-foreground text-center">
                {!state.selectedProduct && "Select a product first"}
                {state.selectedProduct && !state.qrProductState && "Select a QR mode first"}
                {state.selectedProduct && state.qrProductState && isPlayMode && !hasPlayMedia && "Upload a video or add a media URL above"}
                {state.selectedProduct && state.qrProductState && isPlayMode && hasPlayMedia && !playPermissionOk && "Check the permission box to confirm you have rights to this content"}
                {state.selectedProduct && state.qrProductState && !isPlayMode && !hasRequiredContent && "Add a URL or content above"}
              </div>
            )}
          </>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-md border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {localGraphics && !saveComplete && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Review Your Graphics
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
                data-testid="button-reset-graphics"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Start Over
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {localGraphics.qrOnlyUrl && (
                <Card className="overflow-hidden">
                  <CardContent className="p-3">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <QrCode className="h-3 w-3" />
                      QR Code
                    </p>
                    <div className="bg-white rounded-md p-2 flex items-center justify-center">
                      <img
                        src={localGraphics.qrOnlyUrl}
                        alt="QR Code"
                        className="w-full max-w-[150px] h-auto"
                        data-testid="img-generated-qr"
                      />
                    </div>
                    {isPlayMode && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/50 rounded border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-300 text-center font-medium">
                          Preview Only - QR will update on save
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {localGraphics.compositeUrl && (
                <Card className="overflow-hidden">
                  <CardContent className="p-3">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <Image className="h-3 w-3" />
                      Composite
                    </p>
                    <div 
                      className="rounded-md p-2 flex items-center justify-center"
                      style={{ backgroundColor: state.selectedColor?.hex || '#f9fafb' }}
                    >
                      <img
                        src={localGraphics.compositeUrl}
                        alt="Composite"
                        className="w-full max-w-[150px] h-auto object-contain"
                        data-testid="img-generated-product"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {calculatedPricing && pricingSettings && (
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4" />
                    Pricing Breakdown
                  </h4>
                  
                  <div className="flex justify-between text-sm">
                    <span>Base Product Cost</span>
                    <span className="font-medium">${calculatedPricing.baseProductCost.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      Extra Placements ({Math.max(0, (state.selectedPlacements?.length || 1) - 1)} x ${pricingSettings.additionalPlacementCost.toFixed(2)})
                    </span>
                    <span className="font-medium">
                      {calculatedPricing.placementCost > 0 ? `+$${calculatedPricing.placementCost.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      Text Lines ({(() => {
                        let count = 0;
                        if (state.content.headerStyle?.enabled && state.content.headerStyle.text) count++;
                        if (state.content.footerStyle?.enabled && state.content.footerStyle.text) count++;
                        return count;
                      })()} x ${pricingSettings.textLineUpcharge.toFixed(2)})
                    </span>
                    <span className="font-medium">
                      {calculatedPricing.textUpcharge > 0 ? `+$${calculatedPricing.textUpcharge.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Hosting ({calculatedPricing.hostingTierCode || 'none'})</span>
                    <span className="font-medium">
                      {calculatedPricing.hostingCost > 0 ? `+$${calculatedPricing.hostingCost.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span>Subtotal</span>
                    <span className="font-medium">${calculatedPricing.subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span>Markup ({pricingSettings.markupPercent}% + ${pricingSettings.markupFixed.toFixed(2)})</span>
                    <span className="font-medium">+${calculatedPricing.markupAmount.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-lg font-bold border-t pt-2 text-green-700 dark:text-green-300">
                    <span>Customer Price</span>
                    <span>${calculatedPricing.customerPrice.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="border-t pt-4">
              <Button
                type="button"
                size="lg"
                className="w-full h-auto py-4 flex flex-col items-center gap-2 bg-blue-600 hover:bg-blue-700"
                disabled={isSaving}
                onClick={() => handleSave("store")}
                data-testid="button-assign-store"
              >
                {isSaving && selectedPath === "store" ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Store className="h-6 w-6" />
                )}
                <span className="font-semibold">Assign to Store</span>
                <span className="text-xs opacity-80">Save and configure for a store channel</span>
              </Button>
            </div>
          </div>
        )}

      </div>
    </CollapsibleModule>
  );
}
