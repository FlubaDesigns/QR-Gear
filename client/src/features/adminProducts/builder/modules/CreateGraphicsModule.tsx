import { useState, useCallback } from "react";
import { Wand2, Loader2, Check, Image, QrCode, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBuilderContext } from "../BuilderContext";
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
}

function generateQRCodeUrl(content: string, size: number = 3000): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}&format=png&qzone=2&ecc=H`;
}

export function CreateGraphicsModule({ onGraphicsCreated }: CreateGraphicsModuleProps) {
  const { state, loadGraphic, setContent } = useBuilderContext();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedGraphics, setGeneratedGraphics] = useState<GeneratedGraphics | null>(null);
  const [calculatedPricing, setCalculatedPricing] = useState<PricingBreakdown | null>(null);
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

  const canCreate = Boolean(
    state.selectedProduct &&
    state.qrProductState &&
    (state.content.url || state.content.title)
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
      const qrContent = state.content.url || state.content.title || "";
      const qrUrl = generateQRCodeUrl(qrContent.trim());
      
      await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error("Failed to generate QR code"));
        img.src = qrUrl;
      });

      const compositeUrl = state.selectedProduct?.imageUrl || "";
      const pricing = calculatePricing();
      
      // Create product packet via API
      const packetPayload = {
        qrOnlyUrl: qrUrl,
        compositeUrl,
        qrContent: qrContent.trim(),
        headerText: state.content.headerStyle?.enabled ? state.content.headerStyle.text : null,
        footerText: state.content.footerStyle?.enabled ? state.content.footerStyle.text : null,
        pricing,
        productId: state.selectedProduct?.id || null,
        productName: state.selectedProduct?.title || null,
        blueprintId: (state.selectedProduct as any)?.blueprintId || null,
        printProviderId: (state.selectedProduct as any)?.printProviderId || null,
        qrProductState: state.qrProductState,
        placements: state.selectedPlacements || [],
        sizes: [],
        colors: [],
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

      const graphics: GeneratedGraphics = {
        qrOnlyUrl: qrUrl,
        compositeUrl,
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

            {calculatedPricing && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing Breakdown
                </h4>
                
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Base Price</span>
                      <span className="font-medium">${calculatedPricing.baseProductCost.toFixed(2)}</span>
                    </div>
                    
                    {calculatedPricing.placementCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Extra Placements</span>
                        <span className="font-medium">+${calculatedPricing.placementCost.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {calculatedPricing.textUpcharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Text Lines</span>
                        <span className="font-medium">+${calculatedPricing.textUpcharge.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {calculatedPricing.hostingCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Hosting</span>
                        <span className="font-medium">+${calculatedPricing.hostingCost.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span>Subtotal</span>
                      <span className="font-medium">${calculatedPricing.subtotal.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>Markup</span>
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

            <div className="p-3 bg-green-50 dark:bg-green-950/50 rounded-md border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                Graphics and pricing ready! You can now save to Graphics, Template, or Store.
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Generated at {generatedGraphics.generatedAt.toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
