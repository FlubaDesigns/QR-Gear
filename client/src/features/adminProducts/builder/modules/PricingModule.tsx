import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { DollarSign, Layers, Type, Clock, Calculator, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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

interface PricingModuleProps {
  onPricingCalculated?: (pricing: PricingBreakdown | null) => void;
}

export function PricingModule({ onPricingCalculated }: PricingModuleProps) {
  const { state, setContent } = useBuilderContext();
  
  const { data: settings, isLoading } = useQuery<PricingSettings>({
    queryKey: ["/api/test/pricing-settings"],
  });

  const requiresHosting = useMemo(() => {
    return state.qrProductState === "qr_canvas" || 
           state.qrProductState === "qr_play" || 
           state.qrProductState === "qr_dynamics";
  }, [state.qrProductState]);

  const selectedTier = useMemo(() => {
    if (!settings?.hostingTiers) return null;
    return settings.hostingTiers.find(t => t.code === state.content.hostingTierCode) || settings.hostingTiers[0];
  }, [settings, state.content.hostingTierCode]);

  const pricing = useMemo((): PricingBreakdown | null => {
    if (!settings || !state.selectedProduct) return null;

    const product = state.selectedProduct as any;
    // Use maxPrice (highest variant cost) as base, fallback to basePrice, then minPrice
    const baseProductCost = parseFloat(product.maxPrice || product.basePrice || product.minPrice || product.customerPrice || "0");
    
    const placementCount = state.selectedPlacements.length || 1;
    const additionalPlacements = Math.max(0, placementCount - 1);
    const placementCost = additionalPlacements * settings.additionalPlacementCost;
    
    let textLineCount = 0;
    if (state.content.headerStyle?.enabled && state.content.headerStyle.text) {
      textLineCount++;
    }
    if (state.content.footerStyle?.enabled && state.content.footerStyle.text) {
      textLineCount++;
    }
    const textUpcharge = textLineCount * settings.textLineUpcharge;
    
    let hostingCost = 0;
    if (requiresHosting && selectedTier) {
      hostingCost = selectedTier.price;
    }
    
    const subtotal = baseProductCost + placementCost + textUpcharge + hostingCost;
    
    const markupAmount = (subtotal * (settings.markupPercent / 100)) + settings.markupFixed;
    
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
  }, [settings, state.selectedProduct, state.selectedPlacements, state.content, requiresHosting, selectedTier]);

  useEffect(() => {
    onPricingCalculated?.(pricing);
  }, [pricing, onPricingCalculated]);

  const handleHostingTierChange = (code: string) => {
    setContent({ hostingTierCode: code });
  };

  if (!state.selectedProduct) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        </CardContent>
      </Card>
    );
  }

  if (!pricing) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <Calculator className="h-5 w-5" />
          Price Breakdown
        </CardTitle>
        <CardDescription>
          Based on current configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {requiresHosting && settings?.hostingTiers && (
          <div className="space-y-2">
            <Label htmlFor="hosting-tier" className="text-sm font-medium">Hosting Duration</Label>
            <Select 
              value={state.content.hostingTierCode || "1_year"} 
              onValueChange={handleHostingTierChange}
            >
              <SelectTrigger 
                id="hosting-tier"
                className="min-h-[48px] text-base"
                data-testid="select-hosting-tier"
              >
                <SelectValue placeholder="Select hosting duration" />
              </SelectTrigger>
              <SelectContent>
                {settings.hostingTiers.map((tier) => (
                  <SelectItem 
                    key={tier.code} 
                    value={tier.code}
                    className="min-h-[48px] text-base"
                    data-testid={`option-tier-${tier.code}`}
                  >
                    {tier.name} - ${tier.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground min-h-[40px]">
            <DollarSign className="h-4 w-4" />
            Item Price (Base)
          </div>
          <div className="text-right font-medium min-h-[40px] flex items-center justify-end">
            ${pricing.baseProductCost.toFixed(2)}
          </div>

          <div className="flex items-center gap-2 text-muted-foreground min-h-[40px]">
            <Layers className="h-4 w-4" />
            <span>
              Placements ({state.selectedPlacements.length} total, {Math.max(0, state.selectedPlacements.length - 1)} extra × ${settings?.additionalPlacementCost.toFixed(2)})
            </span>
          </div>
          <div className="text-right font-medium min-h-[40px] flex items-center justify-end">
            {pricing.placementCost > 0 ? `+$${pricing.placementCost.toFixed(2)}` : "$0.00"}
          </div>

          <div className="flex items-center gap-2 text-muted-foreground min-h-[40px]">
            <Type className="h-4 w-4" />
            <span>
              Text Lines ({Math.round(pricing.textUpcharge / (settings?.textLineUpcharge || 1))} lines × ${settings?.textLineUpcharge.toFixed(2)})
            </span>
          </div>
          <div className="text-right font-medium min-h-[40px] flex items-center justify-end">
            {pricing.textUpcharge > 0 ? `+$${pricing.textUpcharge.toFixed(2)}` : "$0.00"}
          </div>

          <div className="flex items-center gap-2 text-muted-foreground min-h-[40px]">
            <Clock className="h-4 w-4" />
            Hosting ({selectedTier?.name || "None"})
          </div>
          <div className="text-right font-medium min-h-[40px] flex items-center justify-end">
            {pricing.hostingCost > 0 ? `+$${pricing.hostingCost.toFixed(2)}` : "$0.00"}
          </div>
        </div>

        <div className="border-t border-green-200 dark:border-green-800 pt-3 mt-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground min-h-[36px] flex items-center font-medium">Subtotal</div>
            <div className="text-right font-bold min-h-[36px] flex items-center justify-end">${pricing.subtotal.toFixed(2)}</div>
            
            <div className="text-muted-foreground min-h-[36px] flex items-center">
              Markup ({settings?.markupPercent}%)
            </div>
            <div className="text-right min-h-[36px] flex items-center justify-end">
              +${(pricing.subtotal * (settings?.markupPercent || 0) / 100).toFixed(2)}
            </div>
            
            <div className="text-muted-foreground min-h-[36px] flex items-center">
              Fixed Markup
            </div>
            <div className="text-right min-h-[36px] flex items-center justify-end">
              +${(settings?.markupFixed || 0).toFixed(2)}
            </div>
            
            <div className="text-muted-foreground min-h-[36px] flex items-center font-medium">
              Total Markup
            </div>
            <div className="text-right font-bold min-h-[36px] flex items-center justify-end">
              +${pricing.markupAmount.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="border-t-2 border-green-300 dark:border-green-700 pt-3 mt-3">
          <div className="flex items-center justify-between min-h-[48px]">
            <span className="text-lg font-semibold text-green-700 dark:text-green-300">Customer Price</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${pricing.customerPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
