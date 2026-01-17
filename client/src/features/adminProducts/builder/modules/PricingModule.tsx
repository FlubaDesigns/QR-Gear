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
  
  const { data: settings, isLoading, error } = useQuery<PricingSettings>({
    queryKey: ["/api/test/pricing-settings"],
    queryFn: async () => {
      const res = await fetch("/api/test/pricing-settings");
      if (!res.ok) throw new Error(`pricing-settings HTTP ${res.status}`);
      return res.json();
    },
    retry: 2,
    staleTime: 60000,
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
    
    const placementCount = (state.selectedPlacements || []).length || 1;
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
    return (
      <Card className="border-2 border-red-400 bg-red-50/50 dark:bg-red-950/30">
        <CardContent className="py-4 text-sm">
          <div className="font-semibold text-red-700 dark:text-red-400">
            PricingModule is mounted, but sees NO selectedProduct.
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            This means PricingModule is reading a DIFFERENT CONTEXT
            than the selection UI, or selectedProduct is never being
            set in BuilderContext.
          </div>
          <pre className="mt-3 p-2 rounded bg-white/60 dark:bg-black/30 text-[11px] overflow-auto max-h-48">
{JSON.stringify(
  {
    hasSelectedProduct: !!state.selectedProduct,
    selectedProduct: state.selectedProduct,
    placements: state.selectedPlacements?.length || 0,
    contentUrl: state.content?.url || "",
    qrProductState: state.qrProductState,
    sourceType: state.sourceType,
    category: state.category,
  },
  null,
  2
)}
          </pre>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          <span className="ml-2 text-sm">Loading pricing...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-red-200 dark:border-red-800">
        <CardContent className="py-6">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">Failed to load pricing settings</p>
          <p className="text-xs text-muted-foreground mt-1">Please refresh the page</p>
        </CardContent>
      </Card>
    );
  }

  if (!pricing) {
    // Debug: show what's missing
    const missingItems: string[] = [];
    if (!settings) missingItems.push("pricing settings");
    if (!state.selectedProduct) missingItems.push("product selection");
    
    return (
      <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/50 dark:to-amber-950/50 border-yellow-200 dark:border-yellow-800">
        <CardContent className="py-6">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            {missingItems.length > 0 
              ? `Waiting for: ${missingItems.join(", ")}`
              : "Calculating pricing..."}
          </p>
        </CardContent>
      </Card>
    );
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
        <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
          <p className="mb-1">
            <span className="font-medium">How this is calculated:</span> Base price uses the product's highest variant cost
            (maxPrice). Extra placements are charged for each additional print area beyond the first. "Text Lines" charges only
            when Header/Footer text is enabled. Hosting applies only to QR Canvas/Play/Dynamics products. Markup is your %
            markup plus your fixed markup.
          </p>
          <p>
            <span className="font-medium">Customer Price</span> = Subtotal + Markup.
          </p>
        </div>
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

        <div className="space-y-2 text-sm">
          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 flex-shrink-0 text-green-600" />
              <span className="font-medium">Item Base Price</span>
            </div>
            <div className="text-right font-bold text-lg">${pricing.baseProductCost.toFixed(2)}</div>
          </div>

          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 flex-shrink-0 text-blue-600" />
              <span>Extra Placements</span>
            </div>
            <div className="text-right font-medium text-sm">
              {Math.max(0, (state.selectedPlacements || []).length - 1) > 0 
                ? `${Math.max(0, (state.selectedPlacements || []).length - 1)} × $${settings?.additionalPlacementCost.toFixed(2)} = +$${pricing.placementCost.toFixed(2)}`
                : "None (+$0.00)"}
            </div>
          </div>

          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <Type className="h-4 w-4 flex-shrink-0 text-purple-600" />
              <span>Text Lines</span>
            </div>
            <div className="text-right font-medium text-sm">
              {(() => {
                const lineCount = Math.round(pricing.textUpcharge / (settings?.textLineUpcharge || 1));
                return lineCount > 0 
                  ? `${lineCount} × $${settings?.textLineUpcharge.toFixed(2)} = +$${pricing.textUpcharge.toFixed(2)}`
                  : "None (+$0.00)";
              })()}
            </div>
          </div>

          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 flex-shrink-0 text-orange-600" />
              <span>Hosting</span>
            </div>
            <div className="text-right font-medium text-sm">
              {pricing.hostingCost > 0 
                ? `${selectedTier?.name} = +$${pricing.hostingCost.toFixed(2)}`
                : "Not required (+$0.00)"}
            </div>
          </div>
        </div>

        <div className="border-t border-green-200 dark:border-green-800 pt-3 mt-3 space-y-2">
          <div className="p-3 bg-green-100/50 dark:bg-green-900/30 rounded-md">
            <div className="flex items-center justify-between">
              <span className="font-medium">Subtotal</span>
              <span className="font-bold">${pricing.subtotal.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-md">
            <div className="mb-1">Your Markup</div>
            <div className="text-right font-medium text-sm break-words">
              {(() => {
                const percentMarkup = pricing.subtotal * (settings?.markupPercent || 0) / 100;
                const fixedMarkup = settings?.markupFixed || 0;
                if (percentMarkup > 0 && fixedMarkup > 0) {
                  return `$${percentMarkup.toFixed(2)} + $${fixedMarkup.toFixed(2)} = +$${pricing.markupAmount.toFixed(2)}`;
                } else if (percentMarkup > 0) {
                  return `${settings?.markupPercent}% = +$${percentMarkup.toFixed(2)}`;
                } else if (fixedMarkup > 0) {
                  return `+$${fixedMarkup.toFixed(2)}`;
                }
                return "+$0.00";
              })()}
            </div>
          </div>
        </div>

        <div className="border-t-2 border-green-300 dark:border-green-700 pt-3 mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <span className="text-base sm:text-lg font-semibold text-green-700 dark:text-green-300">Customer Price</span>
            <span className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
              ${pricing.customerPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
