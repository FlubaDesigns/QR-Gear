import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, DollarSign, Percent, Layers, Type, Clock, Save, Loader2, Check, Tag } from "lucide-react";
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

interface BrandLabelPricing {
  printifyInside: number;
  printifyOutside: number;
  printfulInside: number;
  printfulOutside: number;
}

interface PricingSettings {
  markupPercent: number;
  markupFixed: number;
  additionalPlacementCost: number;
  textLineUpcharge: number;
  memberProfitShare: number;
  hostingTiers: HostingTier[];
  brandLabelPricing: BrandLabelPricing;
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
  const [memberProfitShare, setMemberProfitShare] = useState<string>("");
  const [hostingTiers, setHostingTiers] = useState<HostingTier[]>([]);
  const [brandLabelPricing, setBrandLabelPricing] = useState<BrandLabelPricing>({
    printifyInside: 0.55,
    printifyOutside: 0.55,
    printfulInside: 0.99,
    printfulOutside: 2.49,
  });
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setMarkupPercent(String(settings.markupPercent));
    setMarkupFixed(String(settings.markupFixed));
    setAdditionalPlacementCost(String(settings.additionalPlacementCost));
    setTextLineUpcharge(String(settings.textLineUpcharge));
    setMemberProfitShare(String((settings.memberProfitShare || 0.25) * 100));
    setHostingTiers(settings.hostingTiers || []);
    if (settings.brandLabelPricing) {
      setBrandLabelPricing(settings.brandLabelPricing);
    }
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
      memberProfitShare: (parseFloat(memberProfitShare) || 25) / 100,
      hostingTiers,
      brandLabelPricing,
    });
  };
  
  const syncPricingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/test/pricing-settings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to sync pricing");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Pricing Synced", 
        description: `Updated ${data.productsUpdated} products across ${data.storesUpdated} stores.` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

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
    <div className="page-wrap">
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <div className="flex flex-col gap-4">
            <Link href="/admin/test-products" className="block">
              <button 
                className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Products
              </button>
            </Link>
            <h1 className="glass-title text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Pricing Configuration
            </h1>
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
                <Tag className="h-5 w-5" />
                Brand Label Pricing
              </CardTitle>
              <CardDescription>
                Your brand, front and center — custom labels make every product truly yours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Printify Labels</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="printify-inside">Inside Label ($)</Label>
                    <Input
                      id="printify-inside"
                      type="number"
                      min="0"
                      step="0.01"
                      value={brandLabelPricing.printifyInside}
                      onChange={(e) => setBrandLabelPricing(prev => ({ ...prev, printifyInside: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.55"
                      className="min-h-[48px] text-lg"
                      inputMode="decimal"
                      data-testid="input-printify-inside-label"
                    />
                    <p className="text-xs text-muted-foreground">Replaces manufacturer tag inside neck</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="printify-outside">Outside Label ($)</Label>
                    <Input
                      id="printify-outside"
                      type="number"
                      min="0"
                      step="0.01"
                      value={brandLabelPricing.printifyOutside}
                      onChange={(e) => setBrandLabelPricing(prev => ({ ...prev, printifyOutside: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.55"
                      className="min-h-[48px] text-lg"
                      inputMode="decimal"
                      data-testid="input-printify-outside-label"
                    />
                    <p className="text-xs text-muted-foreground">Printed on outside back of neck</p>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Printful Labels</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="printful-inside">Inside Label ($)</Label>
                    <Input
                      id="printful-inside"
                      type="number"
                      min="0"
                      step="0.01"
                      value={brandLabelPricing.printfulInside}
                      onChange={(e) => setBrandLabelPricing(prev => ({ ...prev, printfulInside: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.99"
                      className="min-h-[48px] text-lg"
                      inputMode="decimal"
                      data-testid="input-printful-inside-label"
                    />
                    <p className="text-xs text-muted-foreground">Replaces manufacturer tag inside neck</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="printful-outside">Outside Label ($)</Label>
                    <Input
                      id="printful-outside"
                      type="number"
                      min="0"
                      step="0.01"
                      value={brandLabelPricing.printfulOutside}
                      onChange={(e) => setBrandLabelPricing(prev => ({ ...prev, printfulOutside: parseFloat(e.target.value) || 0 }))}
                      placeholder="2.49"
                      className="min-h-[48px] text-lg"
                      inputMode="decimal"
                      data-testid="input-printful-outside-label"
                    />
                    <p className="text-xs text-muted-foreground">Printed on outside back of neck</p>
                  </div>
                </div>
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
                <p>Only one label type (inside OR outside) can be added per product.</p>
                <p>Inside labels replace the manufacturer tag. Outside labels are printed on the back neck area.</p>
                <p>Label choice is set per product in the product builder based on which fulfillment center you pick.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Member Profit Share
              </CardTitle>
              <CardDescription>
                Percentage of profit that members earn when their products sell
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="member-profit-share">Member Share (%)</Label>
                <Input
                  id="member-profit-share"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={memberProfitShare}
                  onChange={(e) => setMemberProfitShare(e.target.value)}
                  placeholder="25"
                  className="min-h-[48px] text-lg max-w-xs"
                  inputMode="decimal"
                  data-testid="input-member-profit-share"
                />
                <p className="text-xs text-muted-foreground">
                  Members earn this % of profit (price - cost) on each sale. Default: 25%
                </p>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => syncPricingMutation.mutate()}
                  disabled={syncPricingMutation.isPending}
                  data-testid="button-sync-pricing"
                >
                  {syncPricingMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Sync Pricing to All Products
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Updates all existing product packets with current pricing settings
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

          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="qr-btn qr-btn--primary qr-btn--xxl qr-btn--full disabled:opacity-50"
            data-testid="button-save"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : saveMutation.isSuccess ? (
              <Check className="h-6 w-6" />
            ) : (
              <Save className="h-6 w-6" />
            )}
            Save Pricing Settings
          </button>

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Pricing Formula</CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-sm space-y-1">
              <p>Base Cost = Production + Placements + Text + Hosting + Brand Label</p>
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
                Example: $15 base product, 1 extra placement, 1 text line, 1-year hosting, inside brand label
              </p>

              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">Example using:</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-medium">
                  Printify inside: ${brandLabelPricing.printifyInside.toFixed(2)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-medium">
                  Printful inside: ${brandLabelPricing.printfulInside.toFixed(2)}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Base Product Cost:</span>
                  <span className="font-bold">$15.00</span>
                </div>
                <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Extra Placement (1 × ${additionalPlacementCost || 4}):</span>
                  <span className="font-medium">+${parseFloat(additionalPlacementCost || "4").toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Text Line (1 × ${textLineUpcharge || 2}):</span>
                  <span className="font-medium">+${parseFloat(textLineUpcharge || "2").toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded border">
                  <span>Hosting ({hostingTiers[0]?.name || "1 Year"}):</span>
                  <span className="font-medium">+${(hostingTiers[0]?.price || 5).toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2 p-2 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800">
                  <span>Brand Label (inside):</span>
                  <span className="font-medium">+${brandLabelPricing.printifyInside.toFixed(2)}</span>
                </div>
                
                <div className="border-t pt-2 mt-2">
                  {(() => {
                    const labelCost = brandLabelPricing.printifyInside;
                    const subtotal = 15 + parseFloat(additionalPlacementCost || "4") + parseFloat(textLineUpcharge || "2") + (hostingTiers[0]?.price || 5) + labelCost;
                    const markupAmount = (subtotal * (parseFloat(markupPercent || "0") / 100)) + parseFloat(markupFixed || "0");
                    const customerPrice = subtotal + markupAmount;
                    return (
                      <>
                        <div className="flex justify-between gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                          <span className="font-medium">Subtotal:</span>
                          <span className="font-bold">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded border mt-2">
                          <span>Your Markup ({markupPercent || 0}% + ${markupFixed || 0}):</span>
                          <span className="font-medium">+${markupAmount.toFixed(2)}</span>
                        </div>
                        <div className="border-t-2 pt-2 mt-2">
                          <div className="flex justify-between gap-2 p-3 bg-green-100 dark:bg-green-950 rounded border-2 border-green-300 dark:border-green-700">
                            <span className="font-semibold text-green-700 dark:text-green-300">Customer Price:</span>
                            <span className="font-bold text-xl text-green-600 dark:text-green-400">
                              ${customerPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
