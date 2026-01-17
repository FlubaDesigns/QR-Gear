import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, DollarSign, Percent, Layers, Type, Clock, Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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

export default function TestPricingPage() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<PricingSettings>({
    queryKey: ["/api/test/pricing-settings"],
  });

  const [markupPercent, setMarkupPercent] = useState<string>("");
  const [markupFixed, setMarkupFixed] = useState<string>("");
  const [additionalPlacementCost, setAdditionalPlacementCost] = useState<string>("");
  const [textLineUpcharge, setTextLineUpcharge] = useState<string>("");
  const [hostingTiers, setHostingTiers] = useState<HostingTier[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setMarkupPercent(String(settings.markupPercent));
    setMarkupFixed(String(settings.markupFixed));
    setAdditionalPlacementCost(String(settings.additionalPlacementCost));
    setTextLineUpcharge(String(settings.textLineUpcharge));
    setHostingTiers(settings.hostingTiers || []);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: PricingSettings) => {
      const res = await fetch("/api/test/pricing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings Saved", description: "Pricing configuration updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/test/pricing-settings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      markupPercent: parseFloat(markupPercent) || 0,
      markupFixed: parseFloat(markupFixed) || 0,
      additionalPlacementCost: parseFloat(additionalPlacementCost) || 0,
      textLineUpcharge: parseFloat(textLineUpcharge) || 0,
      hostingTiers,
    });
  };

  const updateTierPrice = (code: string, price: string) => {
    setHostingTiers(tiers => 
      tiers.map(t => t.code === code ? { ...t, price: parseFloat(price) || 0 } : t)
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/test-products">
            <Button 
              variant="outline" 
              size="default"
              className="min-h-[48px] min-w-[48px]"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              Pricing Configuration
            </h1>
            <p className="text-muted-foreground mt-1">
              Set markup, placement costs, text upcharges, and hosting fees
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Markup Settings
              </CardTitle>
              <CardDescription>
                Configure how much markup is added to the base production cost
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="markup-percent">Markup Percentage (%)</Label>
                  <Input
                    id="markup-percent"
                    type="number"
                    min="0"
                    max="100"
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(e.target.value)}
                    placeholder="25"
                    className="min-h-[48px] text-lg"
                    inputMode="decimal"
                    data-testid="input-markup-percent"
                  />
                  <p className="text-xs text-muted-foreground">Applied to total cost before fixed markup</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="markup-fixed">Fixed Markup ($)</Label>
                  <Input
                    id="markup-fixed"
                    type="number"
                    min="0"
                    step="0.01"
                    value={markupFixed}
                    onChange={(e) => setMarkupFixed(e.target.value)}
                    placeholder="0.00"
                    className="min-h-[48px] text-lg"
                    inputMode="decimal"
                    data-testid="input-markup-fixed"
                  />
                  <p className="text-xs text-muted-foreground">Added after percentage markup</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Placement Costs
              </CardTitle>
              <CardDescription>
                Cost for additional print placements beyond the first
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="placement-cost">Additional Placement Cost ($)</Label>
                <Input
                  id="placement-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalPlacementCost}
                  onChange={(e) => setAdditionalPlacementCost(e.target.value)}
                  placeholder="4.00"
                  className="min-h-[48px] text-lg max-w-xs"
                  inputMode="decimal"
                  data-testid="input-placement-cost"
                />
                <p className="text-xs text-muted-foreground">
                  First placement is included in base cost. Each additional placement adds this amount.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Text Upcharges
              </CardTitle>
              <CardDescription>
                Additional cost for custom header/footer text
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="text-upcharge">Text Line Upcharge ($)</Label>
                <Input
                  id="text-upcharge"
                  type="number"
                  min="0"
                  step="0.01"
                  value={textLineUpcharge}
                  onChange={(e) => setTextLineUpcharge(e.target.value)}
                  placeholder="2.00"
                  className="min-h-[48px] text-lg max-w-xs"
                  inputMode="decimal"
                  data-testid="input-text-upcharge"
                />
                <p className="text-xs text-muted-foreground">
                  Charged per text line (header or footer) on each "full artwork" placement
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hosting Tiers
              </CardTitle>
              <CardDescription>
                Pricing for QR landing page hosting (applies to Canvas/Play/Dynamics modes)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {hostingTiers.map((tier) => (
                  <div key={tier.code} className="space-y-2">
                    <Label htmlFor={`tier-${tier.code}`}>{tier.name}</Label>
                    <Input
                      id={`tier-${tier.code}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={tier.price}
                      onChange={(e) => updateTierPrice(tier.code, e.target.value)}
                      className="min-h-[48px] text-lg"
                      inputMode="decimal"
                      data-testid={`input-tier-${tier.code}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Hosting fee is added for QR Canvas, QR Play, and QR Dynamics products
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              size="lg"
              className="min-h-[48px] flex-1"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : saveMutation.isSuccess ? (
                <Check className="h-5 w-5 mr-2" />
              ) : (
                <Save className="h-5 w-5 mr-2" />
              )}
              Save Pricing Settings
            </Button>
          </div>

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Pricing Formula</CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-sm space-y-1">
              <p>Base Cost = Production + Placements + Text + Hosting</p>
              <p>Customer Price = Base × (1 + {markupPercent || 0}%) + ${markupFixed || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Example Price Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Here's how pricing works for a $15 base product with 1 extra placement, 1 text line, and 1-year hosting:
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Base Product Cost:</span>
                  <span className="font-bold">$15.00</span>
                </div>
                <div className="flex justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Extra Placement (1 × ${additionalPlacementCost || 4}):</span>
                  <span className="font-medium">+${parseFloat(additionalPlacementCost || "4").toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Text Line (1 × ${textLineUpcharge || 2}):</span>
                  <span className="font-medium">+${parseFloat(textLineUpcharge || "2").toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Hosting ({hostingTiers[0]?.name || "1 Year"}):</span>
                  <span className="font-medium">+${(hostingTiers[0]?.price || 5).toFixed(2)}</span>
                </div>
                
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                    <span className="font-medium">Subtotal:</span>
                    <span className="font-bold">
                      ${(15 + parseFloat(additionalPlacementCost || "4") + parseFloat(textLineUpcharge || "2") + (hostingTiers[0]?.price || 5)).toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Your Markup ({markupPercent || 0}% + ${markupFixed || 0}):</span>
                  <span className="font-medium">
                    +${(((15 + parseFloat(additionalPlacementCost || "4") + parseFloat(textLineUpcharge || "2") + (hostingTiers[0]?.price || 5)) * (parseFloat(markupPercent || "0") / 100)) + parseFloat(markupFixed || "0")).toFixed(2)}
                  </span>
                </div>
                
                <div className="border-t-2 pt-2 mt-2">
                  <div className="flex justify-between p-3 bg-green-100 dark:bg-green-950 rounded border-2 border-green-300 dark:border-green-700">
                    <span className="font-semibold text-green-700 dark:text-green-300">Customer Price:</span>
                    <span className="font-bold text-xl text-green-600 dark:text-green-400">
                      ${(() => {
                        const subtotal = 15 + parseFloat(additionalPlacementCost || "4") + parseFloat(textLineUpcharge || "2") + (hostingTiers[0]?.price || 5);
                        const markup = (subtotal * (parseFloat(markupPercent || "0") / 100)) + parseFloat(markupFixed || "0");
                        return (subtotal + markup).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
