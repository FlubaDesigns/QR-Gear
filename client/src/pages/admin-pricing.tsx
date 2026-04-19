import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DollarSign, Percent, Layers, Type, Clock, Save, Loader2, Check, Tag,
  Truck,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { SELL_SUBNAV } from "@/components/admin/adminNavConfig";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import StickyActionBar from "@/components/admin/StickyActionBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CouponsSection } from "./admin-pricing-coupons";

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
  centerGraphicUpcharge: number;
  memberProfitShare: number;
  builtInShippingCost: number;
  hostingTiers: HostingTier[];
  brandLabelPricing: BrandLabelPricing;
  preferredLabelPosition: 'outside' | 'inside';
}

export default function AdminPricing() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<PricingSettings>({
    queryKey: ["/api/pricing-settings"],
  });

  const [markupPercent, setMarkupPercent] = useState<string>("");
  const [markupFixed, setMarkupFixed] = useState<string>("");
  const [additionalPlacementCost, setAdditionalPlacementCost] = useState<string>("");
  const [textLineUpcharge, setTextLineUpcharge] = useState<string>("");
  const [centerGraphicUpcharge, setCenterGraphicUpcharge] = useState<string>("");
  const [memberProfitShare, setMemberProfitShare] = useState<string>("");
  const [builtInShippingCost, setBuiltInShippingCost] = useState<string>("4.95");
  const [hostingTiers, setHostingTiers] = useState<HostingTier[]>([]);
  const [brandLabelPricing, setBrandLabelPricing] = useState<BrandLabelPricing>({
    printifyInside: 0.55,
    printifyOutside: 0.55,
    printfulInside: 0.99,
    printfulOutside: 2.49,
  });
  const [preferredLabelPosition, setPreferredLabelPosition] = useState<'outside' | 'inside'>('outside');
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setMarkupPercent(String(settings.markupPercent));
    setMarkupFixed(String(settings.markupFixed));
    setAdditionalPlacementCost(String(settings.additionalPlacementCost));
    setTextLineUpcharge(String(settings.textLineUpcharge));
    setCenterGraphicUpcharge(String(settings.centerGraphicUpcharge || 5));
    setMemberProfitShare(String((settings.memberProfitShare || 0.25) * 100));
    setBuiltInShippingCost(String(settings.builtInShippingCost ?? 4.95));
    setHostingTiers(settings.hostingTiers || []);
    if (settings.brandLabelPricing) {
      setBrandLabelPricing(settings.brandLabelPricing);
    }
    if (settings.preferredLabelPosition) {
      setPreferredLabelPosition(settings.preferredLabelPosition);
    }
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: PricingSettings) => {
      const res = await apiRequest("POST", "/api/pricing-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings Saved", description: "Pricing configuration updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-settings"] });
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
      centerGraphicUpcharge: parseFloat(centerGraphicUpcharge) || 0,
      memberProfitShare: (parseFloat(memberProfitShare) || 25) / 100,
      builtInShippingCost: parseFloat(builtInShippingCost) || 4.95,
      hostingTiers,
      brandLabelPricing,
      preferredLabelPosition,
    });
  };

  const syncPricingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pricing-settings/sync");
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
      <AdminShell title="Pricing Configuration" icon={DollarSign} backHref="/admin/products" backLabel="Back to Products">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Pricing Configuration"
      icon={DollarSign}
      backHref="/admin/products"
      backLabel="Back to Products"
      sectionNav={<AdminSectionSubNav items={SELL_SUBNAV} />}
    >
      <div className="grid gap-4">
        <AdminSectionCard
          title="Markup Settings"
          icon={Percent}
          description="Configure how much markup is added to the base production cost"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </AdminSectionCard>

        <AdminSectionCard
          title="Placement Costs"
          icon={Layers}
          description="Cost for additional print placements beyond the first"
        >
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
        </AdminSectionCard>

        <AdminSectionCard
          title="Content Upcharges"
          icon={Type}
          description="Additional cost for custom header/footer content and center graphics"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="text-upcharge">Header / Footer Upcharge ($)</Label>
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
                Charged per zone (header or footer) — applies to both text and uploaded images
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="center-graphic-upcharge">Center Graphic Upcharge ($)</Label>
              <Input
                id="center-graphic-upcharge"
                type="number"
                min="0"
                step="0.01"
                value={centerGraphicUpcharge}
                onChange={(e) => setCenterGraphicUpcharge(e.target.value)}
                placeholder="5.00"
                className="min-h-[48px] text-lg max-w-xs"
                inputMode="decimal"
                data-testid="input-center-graphic-upcharge"
              />
              <p className="text-xs text-muted-foreground">
                Charged when a full graphic image is uploaded to the center area (behind or replacing the QR code)
              </p>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Built-In Shipping Cost"
          icon={Truck}
          description="Shipping cost baked into the product price — customers see 'Free Shipping'"
        >
          <div className="space-y-2">
            <Label htmlFor="built-in-shipping">Shipping Cost ($)</Label>
            <Input
              id="built-in-shipping"
              type="number"
              min="0"
              step="0.01"
              value={builtInShippingCost}
              onChange={(e) => setBuiltInShippingCost(e.target.value)}
              placeholder="4.95"
              className="min-h-[48px] text-lg max-w-xs"
              inputMode="decimal"
              data-testid="input-built-in-shipping"
            />
            <p className="text-xs text-muted-foreground">
              This amount is added to the base cost before markup. Customers will never see this — they see "Free Shipping" at checkout.
            </p>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Brand Label Pricing"
          icon={Tag}
          description="Your brand, front and center — custom labels make every product truly yours"
        >
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3">Printify Labels</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Default Tag Placement</h3>
              <div className="flex items-center gap-3 min-h-[44px]">
                <Switch
                  id="label-position"
                  checked={preferredLabelPosition === 'inside'}
                  onCheckedChange={(checked) => setPreferredLabelPosition(checked ? 'inside' : 'outside')}
                  data-testid="switch-label-position"
                />
                <Label htmlFor="label-position" className="text-sm cursor-pointer">
                  {preferredLabelPosition === 'outside'
                    ? 'Outside Neck — printed on the back of the collar (visible to others)'
                    : 'Inside Neck — replaces the manufacturer tag (hidden inside collar)'}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This sets where the QR Gear branded tag goes on every product that supports labels.
                The tag is automatically added to all mockups and orders.
              </p>
            </div>
            <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
              <p>Inside labels replace the manufacturer tag inside the collar. Outside labels are printed on the back of the collar, visible to others.</p>
              <p>The toggle above sets the default for all products. Cost depends on the fulfillment provider.</p>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Member Profit Share"
          icon={Percent}
          description="Percentage of profit that members earn when their products sell"
        >
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
              className="min-h-[44px]"
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
        </AdminSectionCard>

        <AdminSectionCard
          title="Hosting Tiers"
          icon={Clock}
          description="Pricing for QR landing page hosting (applies to Canvas/Play/Dynamics modes)"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </AdminSectionCard>

        <CouponsSection />

        <AdminSectionCard title="Pricing Formula">
          <div className="font-mono text-sm space-y-1">
            <p>Base Cost = Production + Placements + Text + Hosting + Brand Label + Shipping</p>
            <p>Customer Price = Base x (1 + {markupPercent || 0}%) + ${markupFixed || 0}</p>
            <p className="text-muted-foreground">Shipping is baked into the price — customers see "Free Shipping"</p>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Example Price Breakdown"
          icon={DollarSign}
        >
          <p className="text-sm text-muted-foreground mb-4">
            Example: $15 base product, 1 extra placement, 1 header/footer zone, 1 center graphic, 1-year hosting, inside brand label, built-in shipping
          </p>

          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Example using:</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-medium">
              Printify inside: ${brandLabelPricing.printifyInside.toFixed(2)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-medium">
              Printful inside: ${brandLabelPricing.printfulInside.toFixed(2)}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2 p-2 bg-muted rounded-md border">
              <span className="text-foreground">Base Product Cost:</span>
              <span className="font-bold text-foreground">$15.00</span>
            </div>
            <div className="flex justify-between gap-2 p-2 bg-muted rounded-md border">
              <span className="text-foreground">Extra Placement (1 x ${additionalPlacementCost || 4}):</span>
              <span className="font-medium text-foreground">+${parseFloat(additionalPlacementCost || "4").toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2 p-2 bg-muted rounded-md border">
              <span className="text-foreground">Header/Footer Zone (1 x ${textLineUpcharge || 2}):</span>
              <span className="font-medium text-foreground">+${parseFloat(textLineUpcharge || "2").toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2 p-2 bg-muted rounded-md border">
              <span className="text-foreground">Center Graphic (1 x ${centerGraphicUpcharge || 5}):</span>
              <span className="font-medium text-foreground">+${parseFloat(centerGraphicUpcharge || "5").toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2 p-2 bg-muted rounded-md border">
              <span className="text-foreground">Hosting ({hostingTiers[0]?.name || "1 Year"}):</span>
              <span className="font-medium text-foreground">+${(hostingTiers[0]?.price || 5).toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2 p-2 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
              <span className="text-amber-900 dark:text-amber-200">Brand Label (inside):</span>
              <span className="font-medium text-amber-900 dark:text-amber-200">+${brandLabelPricing.printifyInside.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-2 p-2 bg-emerald-50 dark:bg-emerald-950 rounded-md border border-emerald-200 dark:border-emerald-800">
              <span className="text-emerald-900 dark:text-emerald-200">Built-In Shipping:</span>
              <span className="font-medium text-emerald-900 dark:text-emerald-200">+${parseFloat(builtInShippingCost || "4.95").toFixed(2)}</span>
            </div>

            <div className="border-t pt-2 mt-2">
              {(() => {
                const labelCost = brandLabelPricing.printifyInside;
                const shippingCost = parseFloat(builtInShippingCost || "4.95");
                const subtotal = 15 + parseFloat(additionalPlacementCost || "4") + parseFloat(textLineUpcharge || "2") + parseFloat(centerGraphicUpcharge || "5") + (hostingTiers[0]?.price || 5) + labelCost + shippingCost;
                const markupAmount = (subtotal * (parseFloat(markupPercent || "0") / 100)) + parseFloat(markupFixed || "0");
                const customerPrice = subtotal + markupAmount;
                return (
                  <>
                    <div className="flex justify-between gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                      <span className="font-medium text-blue-900 dark:text-blue-200">Subtotal:</span>
                      <span className="font-bold text-blue-900 dark:text-blue-200">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2 p-2 bg-muted rounded-md border mt-2">
                      <span className="text-foreground">Your Markup ({markupPercent || 0}% + ${markupFixed || 0}):</span>
                      <span className="font-medium text-foreground">+${markupAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t-2 pt-2 mt-2">
                      <div className="flex justify-between gap-2 p-3 bg-green-100 dark:bg-green-950 rounded-md border-2 border-green-300 dark:border-green-700">
                        <span className="font-bold text-lg text-green-900 dark:text-green-300">Customer Price:</span>
                        <span className="font-bold text-lg text-green-700 dark:text-green-400">
                          ${customerPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </AdminSectionCard>
      </div>

      <StickyActionBar>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="qr-btn qr-btn--primary qr-btn--touch disabled:opacity-50"
          data-testid="button-save"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : saveMutation.isSuccess ? (
            <Check className="h-5 w-5" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          Save Pricing
        </button>
      </StickyActionBar>
    </AdminShell>
  );
}
