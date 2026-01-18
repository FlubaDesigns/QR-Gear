import { useState, useCallback } from "react";
import { Wand2, Loader2, Check, Image, QrCode, DollarSign, Save, ArrowRight } from "lucide-react";
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

function generateQRCodeUrl(content: string, size: number = 3000): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}&format=png&qzone=2&ecc=H`;
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

async function generateCompositeGraphic(
  qrUrl: string,
  backgroundUrl: string | null,
  headerStyle: TextStyle | null,
  footerStyle: TextStyle | null
): Promise<string> {
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1920;
  const QR_SIZE = 400;
  
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Fill with white background by default
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw background image if available
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

  // Draw QR code in center
  try {
    const qrImg = await loadImage(qrUrl);
    const qrX = (CANVAS_WIDTH - QR_SIZE) / 2;
    const qrY = (CANVAS_HEIGHT - QR_SIZE) / 2;
    
    // White background for QR code
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 20, qrY - 20, QR_SIZE + 40, QR_SIZE + 40);
    ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);
  } catch (e) {
    console.warn('Failed to load QR image:', e);
  }

  // Draw header text if enabled
  if (headerStyle?.enabled && headerStyle.text) {
    const fontSize = parseInt(headerStyle.fontSize) || 144;
    const scaledFontSize = Math.round(fontSize * (CANVAS_WIDTH / 1200));
    
    ctx.font = `bold ${scaledFontSize}px ${headerStyle.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate vertical position (distance from QR center)
    const qrCenterY = CANVAS_HEIGHT / 2;
    const qrTopEdge = qrCenterY - (QR_SIZE / 2) - 20; // 20px padding
    const verticalOffset = headerStyle.verticalOffset ?? 20;
    const textY = qrTopEdge - (verticalOffset * 4); // Scale offset
    
    // Horizontal offset
    const horizontalOffset = headerStyle.horizontalOffset ?? 0;
    const textX = (CANVAS_WIDTH / 2) + (horizontalOffset * 5);
    
    // Draw stroke if configured
    if (headerStyle.strokeColor && headerStyle.strokeWidth > 0) {
      ctx.strokeStyle = headerStyle.strokeColor;
      ctx.lineWidth = headerStyle.strokeWidth * 2;
      ctx.strokeText(headerStyle.text, textX, textY);
    }
    
    // Draw fill
    ctx.fillStyle = headerStyle.color;
    ctx.fillText(headerStyle.text, textX, textY);
  }

  // Draw footer text if enabled
  if (footerStyle?.enabled && footerStyle.text) {
    const fontSize = parseInt(footerStyle.fontSize) || 144;
    const scaledFontSize = Math.round(fontSize * (CANVAS_WIDTH / 1200));
    
    ctx.font = `bold ${scaledFontSize}px ${footerStyle.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate vertical position (distance from QR center)
    const qrCenterY = CANVAS_HEIGHT / 2;
    const qrBottomEdge = qrCenterY + (QR_SIZE / 2) + 20; // 20px padding
    const verticalOffset = footerStyle.verticalOffset ?? 20;
    const textY = qrBottomEdge + (verticalOffset * 4); // Scale offset
    
    // Horizontal offset
    const horizontalOffset = footerStyle.horizontalOffset ?? 0;
    const textX = (CANVAS_WIDTH / 2) + (horizontalOffset * 5);
    
    // Draw stroke if configured
    if (footerStyle.strokeColor && footerStyle.strokeWidth > 0) {
      ctx.strokeStyle = footerStyle.strokeColor;
      ctx.lineWidth = footerStyle.strokeWidth * 2;
      ctx.strokeText(footerStyle.text, textX, textY);
    }
    
    // Draw fill
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

export function CreateGraphicsModule({ onGraphicsCreated, onSaveComplete }: CreateGraphicsModuleProps) {
  const { state, loadGraphic, setContent } = useBuilderContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedGraphics, setGeneratedGraphics] = useState<GeneratedGraphics | null>(null);
  const [calculatedPricing, setCalculatedPricing] = useState<PricingBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveResults, setSaveResults] = useState<{ graphics?: boolean; template?: boolean; errors: string[] } | null>(null);

  const { data: pricingSettings } = useQuery<PricingSettings>({
    queryKey: ["/api/test/pricing-settings"],
    queryFn: async () => {
      const res = await fetch("/api/test/pricing-settings");
      if (!res.ok) throw new Error(`pricing-settings HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60000,
  });

  // Play mode requires media and permission confirmation
  const isPlayMode = state.qrProductState === "qr_play";
  const hasPlayMedia = isPlayMode && (
    (state.content.playMediaSource === "url" && state.content.playMediaUrl) ||
    (state.content.playMediaSource === "upload" && state.content.playMediaPreview)
  );
  const playPermissionOk = !isPlayMode || state.content.playPermissionConfirmed;

  const canCreate = Boolean(
    state.selectedProduct &&
    state.qrProductState &&
    (state.content.url || state.content.title || hasPlayMedia) &&
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

    try {
      // For Play mode, we'll set the QR content after creating the packet (needs packetId for landing page URL)
      // For other modes, use the destination URL or title
      const qrContent = state.content.url || state.content.title || "";
      const qrUrl = generateQRCodeUrl(qrContent.trim());
      
      await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error("Failed to generate QR code"));
        img.src = qrUrl;
      });

      // Generate actual composite graphic with header, QR, and footer
      const backgroundUrl = state.loadedBackground?.url || null;
      const headerStyle = state.content.headerStyle as TextStyle | null;
      const footerStyle = state.content.footerStyle as TextStyle | null;
      
      let compositeUrl: string;
      try {
        compositeUrl = await generateCompositeGraphic(qrUrl, backgroundUrl, headerStyle, footerStyle);
      } catch (e) {
        console.warn('Composite generation failed, using product image as fallback:', e);
        compositeUrl = state.selectedProduct?.imageUrl || "";
      }
      const pricing = calculatePricing();
      
      // Get product data for the packet
      const product = state.selectedProduct as any;
      const availableColors = product?.availableColors || [];
      const availableSizes = product?.availableSizes || [];
      const availablePlacements = product?.availablePlacements || [];
      
      // Create product packet via API with full product data
      const packetPayload = {
        qrOnlyUrl: qrUrl,
        compositeUrl,
        qrContent: qrContent.trim(),
        headerText: state.content.headerStyle?.enabled ? state.content.headerStyle.text : null,
        footerText: state.content.footerStyle?.enabled ? state.content.footerStyle.text : null,
        headerStyle: state.content.headerStyle?.enabled ? state.content.headerStyle : null,
        footerStyle: state.content.footerStyle?.enabled ? state.content.footerStyle : null,
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
        defaultColor: product?.defaultColor || null,
        defaultPlacement: product?.defaultPlacement || null,
        qrProductState: state.qrProductState,
        placements: state.selectedPlacements || [],
        availablePlacements,
        sizes: availableSizes,
        colors: availableColors,
        basePrice: product?.basePrice || null,
        customerPrice: product?.customerPrice || null,
        mockupsByColor: product?.mockupsByColor || null,
      };

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

      // Upload composite to Firebase Storage for permanent storage
      const mode = state.qrProductState === "qr_canvas" ? "canvas" : 
                   state.qrProductState === "qr_play" ? "play" :
                   state.qrProductState === "qr_dynamics" ? "dynamics" : "basics";
      
      let finalCompositeUrl = compositeUrl;
      try {
        const uploadRes = await fetch("/api/test/content/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            userId: "admin", // TODO: Replace with actual user ID when auth is ready
            packetId,
            base64Data: compositeUrl,
            mimeType: "image/png",
            fileName: `${packetId}-composite.png`,
          }),
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalCompositeUrl = uploadData.publicUrl;
          console.log("[CreateGraphics] Composite uploaded to:", finalCompositeUrl);
        } else {
          console.warn("[CreateGraphics] Upload failed, using data URL as fallback");
        }
      } catch (uploadErr) {
        console.warn("[CreateGraphics] Upload error, using data URL as fallback:", uploadErr);
      }

      // For Play mode: Also upload the media file (video/image)
      let playMediaStorageUrl: string | null = null;
      if (state.qrProductState === "qr_play" && state.content.playMediaSource === "upload" && state.content.playMediaPreview) {
        try {
          const fileName = state.content.playMediaFile?.name || `media${state.content.playMediaMimeType?.includes("video") ? ".mp4" : ".gif"}`;
          const uploadRes = await fetch("/api/test/content/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "play",
              userId: "admin",
              packetId,
              base64Data: state.content.playMediaPreview,
              mimeType: state.content.playMediaMimeType || "video/mp4",
              fileName,
            }),
          });
          
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            playMediaStorageUrl = uploadData.publicUrl;
            console.log("[CreateGraphics] Play media uploaded to:", playMediaStorageUrl);
          } else {
            console.warn("[CreateGraphics] Play media upload failed");
          }
        } catch (uploadErr) {
          console.warn("[CreateGraphics] Play media upload error:", uploadErr);
        }
      } else if (state.qrProductState === "qr_play" && state.content.playMediaSource === "url" && state.content.playMediaUrl) {
        // External URL - store directly
        playMediaStorageUrl = state.content.playMediaUrl;
        console.log("[CreateGraphics] Using external play media URL:", playMediaStorageUrl);
      }

      const graphics: GeneratedGraphics = {
        qrOnlyUrl: qrUrl,
        compositeUrl: finalCompositeUrl,
        generatedAt: new Date(),
        packetId,
      };

      loadGraphic({ 
        compositeUrl: graphics.compositeUrl, 
        qrOnlyUrl: graphics.qrOnlyUrl 
      });
      
      setGeneratedGraphics(graphics);
      setCalculatedPricing(pricing);

      if (pricing) {
        onGraphicsCreated?.(graphics, pricing, packetId);
      }

    } catch (err: any) {
      console.error("Graphics creation failed:", err);
      setError(err.message || "Failed to create graphics");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!generatedGraphics || !calculatedPricing) return;

    setIsSaving(true);
    setError(null);
    const results: { graphics?: boolean; template?: boolean; errors: string[] } = { errors: [] };

    try {
      const graphicsPayload = {
        name: state.content.title || `Graphic - ${new Date().toLocaleDateString()}`,
        description: state.content.description || "",
        category: state.qrProductState || "General",
        qrOnlyUrl: generatedGraphics.qrOnlyUrl,
        compositeUrl: generatedGraphics.compositeUrl,
        qrContent: state.content.url || state.content.title || "",
        pricing: calculatedPricing,
        packetId: generatedGraphics.packetId,
      };

      const graphicsRes = await fetch("/api/test/graphics/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graphicsPayload),
      });

      if (graphicsRes.ok) {
        results.graphics = true;
      } else {
        const err = await graphicsRes.json().catch(() => ({}));
        results.errors.push(`Graphics: ${err.error || "Failed"}`);
      }
    } catch (e: any) {
      results.errors.push(`Graphics: ${e.message}`);
    }

    try {
      const templatePayload = {
        name: state.content.title || `Template - ${new Date().toLocaleDateString()}`,
        description: state.content.description || "",
        category: state.qrProductState || "General",
        productId: state.selectedProduct?.id || null,
        blueprintId: (state.selectedProduct as any)?.blueprintId || 0,
        printProviderId: (state.selectedProduct as any)?.printProviderId || 0,
        colors: [],
        placements: state.selectedPlacements || ["front"],
        qrSizes: ["small", "medium", "large"],
        artworkUrl: generatedGraphics.compositeUrl || state.selectedProduct?.imageUrl || "",
        artworkVariant: "black",
        thumbnailUrl: state.selectedProduct?.imageUrl || "",
        qrContent: state.content.url || state.content.title || "",
        pricing: calculatedPricing,
        packetId: generatedGraphics.packetId,
      };

      const templateRes = await fetch("/api/test/templates/full-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templatePayload),
      });

      if (templateRes.ok) {
        results.template = true;
        
        // Trigger mockup queue processing in background (fire and forget)
        // Process only 3 at a time with 2-second delays to avoid API rate limits
        fetch("/api/test/queue/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 3 }),
        }).then(res => res.json())
          .then(data => console.log("[Queue] Started processing:", data.message))
          .catch(err => console.warn("[Queue] Background processing failed:", err.message));
      } else {
        const err = await templateRes.json().catch(() => ({}));
        results.errors.push(`Template: ${err.error || "Failed"}`);
      }
    } catch (e: any) {
      results.errors.push(`Template: ${e.message}`);
    }

    setSaveResults(results);
    setIsSaving(false);

    if (results.graphics && results.template) {
      toast({
        title: "Saved Successfully",
        description: "Graphics and Template saved! Generating mockups in background...",
      });

      setTimeout(() => {
        navigate(`/test-store-builder?packetId=${generatedGraphics.packetId}`);
        onSaveComplete?.();
      }, 800);
    } else {
      const errorDetails = results.errors.length > 0 
        ? results.errors.join("; ")
        : "Unknown error - please try again";
      toast({
        title: "Save Failed",
        description: errorDetails,
        variant: "destructive",
      });
      setError(errorDetails);
    }
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
        <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-md border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Click the button below to generate your QR code graphics and calculate pricing. 
            This prepares everything for saving.
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
              Creating Graphics...
            </>
          ) : generatedGraphics ? (
            <>
              <Check className="h-5 w-5 mr-2" />
              Graphics Ready - Tap to Regenerate
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5 mr-2" />
              Create Graphics
            </>
          )}
        </Button>

        {!canCreate && (
          <div className="text-sm text-muted-foreground text-center">
            {!state.selectedProduct && "Select a product first"}
            {state.selectedProduct && !state.qrProductState && "Select a QR mode first"}
            {state.selectedProduct && state.qrProductState && !(state.content.url || state.content.title) && "Enter content first"}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-md border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {generatedGraphics && (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Image className="h-4 w-4" />
                Generated Graphics
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                {generatedGraphics.qrOnlyUrl && (
                  <Card className="overflow-hidden">
                    <CardContent className="p-3">
                      <p className="text-xs font-medium mb-2 flex items-center gap-1">
                        <QrCode className="h-3 w-3" />
                        QR Code
                      </p>
                      <div className="bg-white rounded-md p-2 flex items-center justify-center">
                        <img
                          src={generatedGraphics.qrOnlyUrl}
                          alt="QR Code"
                          className="w-full max-w-[150px] h-auto"
                          data-testid="img-generated-qr"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        3000×3000px
                      </p>
                    </CardContent>
                  </Card>
                )}

                {generatedGraphics.compositeUrl && (
                  <Card className="overflow-hidden">
                    <CardContent className="p-3">
                      <p className="text-xs font-medium mb-2 flex items-center gap-1">
                        <Image className="h-3 w-3" />
                        Product
                      </p>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-2 flex items-center justify-center">
                        <img
                          src={generatedGraphics.compositeUrl}
                          alt="Product"
                          className="w-full max-w-[150px] h-auto object-contain"
                          data-testid="img-generated-product"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {calculatedPricing && pricingSettings && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing Breakdown
                </h4>
                
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
                  <CardContent className="p-4 space-y-2">
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
                      <span>
                        Hosting ({calculatedPricing.hostingTierCode || 'none'})
                      </span>
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
              </div>
            )}

            <div className="space-y-3">
              <Button
                type="button"
                size="lg"
                className="w-full h-14 text-base bg-green-600 hover:bg-green-700"
                disabled={isSaving || !calculatedPricing}
                onClick={handleSaveAndContinue}
                data-testid="button-save-continue"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : saveResults?.graphics || saveResults?.template ? (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Saved! Going to Store...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Save & Continue to Store
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>

              <div className="p-3 bg-green-50 dark:bg-green-950/50 rounded-md border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Graphics and pricing ready!
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Generated at {generatedGraphics.generatedAt.toLocaleTimeString()}
                </p>
              </div>

              {saveResults && saveResults.errors.length > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/50 rounded-md border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {saveResults.errors.join("; ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
