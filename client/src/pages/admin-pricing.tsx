import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, DollarSign, Percent, Layers, Type, Clock, Save, Loader2, Check, Tag,
  Plus, Trash2,
} from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import type { Coupon } from "@shared/schema";

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

function CouponsSection() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Coupon | null>(null);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    name: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    maxRedemptions: "",
    validUntil: "",
  });

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      code: string;
      name: string;
      discountType: string;
      discountValue: string;
      currency: string;
      isActive: boolean;
      maxRedemptions?: number | null;
      validUntil?: string | null;
    }) => apiRequest("POST", "/api/admin/coupons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setShowAddDialog(false);
      setNewCoupon({ code: "", name: "", discountType: "percent", discountValue: "", maxRedemptions: "", validUntil: "" });
      toast({ title: "Success", description: "Coupon created and synced with Stripe." });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to create coupon.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Coupon> }) =>
      apiRequest("PUT", `/api/admin/coupons/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Success", description: "Coupon updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update coupon.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setDeleteConfirm(null);
      toast({ title: "Success", description: "Coupon deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete coupon.", variant: "destructive" });
    },
  });

  function toggleActive(coupon: Coupon) {
    updateMutation.mutate({ id: coupon.id, updates: { isActive: !coupon.isActive } });
  }

  function handleCreateCoupon() {
    const missingFields: string[] = [];
    if (!newCoupon.code.trim()) missingFields.push("Coupon Code");
    if (!newCoupon.name.trim()) missingFields.push("Internal Name");
    if (!newCoupon.discountValue) missingFields.push(newCoupon.discountType === "percent" ? "Percentage" : "Amount");
    
    if (missingFields.length > 0) {
      toast({ 
        title: "Missing Information", 
        description: `Please fill in: ${missingFields.join(", ")}`, 
        variant: "destructive" 
      });
      return;
    }
    createMutation.mutate({
      code: newCoupon.code.trim().toUpperCase(),
      name: newCoupon.name.trim(),
      discountType: newCoupon.discountType,
      discountValue: newCoupon.discountValue,
      currency: "usd",
      isActive: true,
      maxRedemptions: newCoupon.maxRedemptions ? parseInt(newCoupon.maxRedemptions) : null,
      validUntil: newCoupon.validUntil || null,
    });
  }

  function formatDiscount(coupon: Coupon): string {
    if (coupon.discountType === "percent") {
      return `${coupon.discountValue}% off`;
    }
    return `$${coupon.discountValue} off`;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle>Coupons & Discounts</CardTitle>
            </div>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-coupon">
              <Plus className="h-4 w-4 mr-2" />
              Add Coupon
            </Button>
          </div>
          <CardDescription>
            Create discount codes that sync with Stripe. Customers can apply these at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!coupons || coupons.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">No coupons created yet.</p>
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-coupon-empty">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Coupon
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {coupons.map((coupon) => (
                <div 
                  key={coupon.id} 
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-md border-2 ${coupon.isActive ? "border-border bg-muted/30" : "border-border/50 bg-muted/10 opacity-60"}`}
                  data-testid={`coupon-${coupon.code}`}
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <Switch
                      checked={coupon.isActive ?? true}
                      onCheckedChange={() => toggleActive(coupon)}
                      data-testid={`toggle-coupon-${coupon.code}`}
                    />
                    <div className="flex items-center gap-2">
                      {coupon.discountType === "percent" ? (
                        <Percent className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <DollarSign className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-mono font-bold text-lg">{coupon.code}</span>
                        <p className="text-sm text-muted-foreground">{coupon.name}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {formatDiscount(coupon)}
                    </Badge>
                    {coupon.redemptionCount && coupon.redemptionCount > 0 && (
                      <Badge variant="outline" className="text-sm">
                        {coupon.redemptionCount} used
                      </Badge>
                    )}
                    {coupon.maxRedemptions && (
                      <Badge variant="outline" className="text-sm">
                        Limit: {coupon.maxRedemptions}
                      </Badge>
                    )}
                    {!coupon.isActive && (
                      <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                    )}
                    {coupon.stripePromotionCodeId && (
                      <Badge variant="default" className="bg-[#635BFF] text-white text-xs">Stripe</Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Button 
                      variant="outline"
                      size="icon"
                      onClick={() => setDeleteConfirm(coupon)}
                      data-testid={`button-delete-coupon-${coupon.code}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <p className="text-sm text-muted-foreground mt-4">
                Coupons are synced with Stripe. Customers enter the code at checkout for automatic discounts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Drawer open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Create Coupon</DrawerTitle>
            <DrawerDescription>Create a discount code that syncs with Stripe.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Coupon Code *</Label>
              <Input
                id="coupon-code"
                placeholder="e.g., SUMMER20"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                className="font-mono uppercase"
                maxLength={50}
                data-testid="input-coupon-code"
              />
              <p className="text-xs text-muted-foreground">Customers will enter this code at checkout</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-name">Internal Name *</Label>
              <Input
                id="coupon-name"
                placeholder="e.g., Summer Sale 2025"
                value={newCoupon.name}
                onChange={(e) => setNewCoupon({ ...newCoupon, name: e.target.value })}
                data-testid="input-coupon-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount-type">Discount Type</Label>
                <Select
                  value={newCoupon.discountType}
                  onValueChange={(value: "percent" | "fixed") => setNewCoupon({ ...newCoupon, discountType: value })}
                >
                  <SelectTrigger data-testid="select-discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Dollar Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-value">
                  {newCoupon.discountType === "percent" ? "Percentage *" : "Amount ($) *"}
                </Label>
                <Input
                  id="discount-value"
                  type="number"
                  placeholder={newCoupon.discountType === "percent" ? "20" : "5.00"}
                  value={newCoupon.discountValue}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })}
                  min="0"
                  step={newCoupon.discountType === "percent" ? "1" : "0.01"}
                  data-testid="input-discount-value"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-redemptions">Usage Limit</Label>
                <Input
                  id="max-redemptions"
                  type="number"
                  placeholder="Unlimited"
                  value={newCoupon.maxRedemptions}
                  onChange={(e) => setNewCoupon({ ...newCoupon, maxRedemptions: e.target.value })}
                  min="1"
                  data-testid="input-max-redemptions"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid-until">Expires</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={newCoupon.validUntil}
                  onChange={(e) => setNewCoupon({ ...newCoupon, validUntil: e.target.value })}
                  data-testid="input-valid-until"
                />
              </div>
            </div>
          </div>
          <DrawerFooter className="pt-4 border-t">
            <Button onClick={handleCreateCoupon} disabled={createMutation.isPending} className="w-full" data-testid="button-create-coupon">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Coupon
            </Button>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="w-full">Cancel</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Coupon?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.code}"? This will deactivate it in Stripe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-coupon"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
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
      const res = await fetch("/api/pricing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save settings");
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
      memberProfitShare: (parseFloat(memberProfitShare) || 25) / 100,
      hostingTiers,
      brandLabelPricing,
    });
  };
  
  const syncPricingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pricing-settings/sync", {
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
      <AdminAuthProvider apiBase="/api">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminAuthProvider>
    );
  }

  return (
    <AdminAuthProvider apiBase="/api">
    <div className="page-wrap">
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <div className="flex flex-col gap-4">
            <Link href="/admin/products" className="block">
              <button 
                className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Products
              </button>
            </Link>
            <h1 className="glass-title text-lg flex items-center gap-2" data-testid="text-page-title">
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
            </CardContent>
          </Card>

          <CouponsSection />

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
              <p>Customer Price = Base x (1 + {markupPercent || 0}%) + ${markupFixed || 0}</p>
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
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-medium">
                  Printify inside: ${brandLabelPricing.printifyInside.toFixed(2)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-medium">
                  Printful inside: ${brandLabelPricing.printfulInside.toFixed(2)}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded-md border">
                  <span>Base Product Cost:</span>
                  <span className="font-bold">$15.00</span>
                </div>
                <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded-md border">
                  <span>Extra Placement (1 x ${additionalPlacementCost || 4}):</span>
                  <span className="font-medium">+${parseFloat(additionalPlacementCost || "4").toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded-md border">
                  <span>Text Line (1 x ${textLineUpcharge || 2}):</span>
                  <span className="font-medium">+${parseFloat(textLineUpcharge || "2").toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded-md border">
                  <span>Hosting ({hostingTiers[0]?.name || "1 Year"}):</span>
                  <span className="font-medium">+${(hostingTiers[0]?.price || 5).toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-2 p-2 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
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
                        <div className="flex justify-between gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                          <span className="font-medium">Subtotal:</span>
                          <span className="font-bold">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded-md border mt-2">
                          <span>Your Markup ({markupPercent || 0}% + ${markupFixed || 0}):</span>
                          <span className="font-medium">+${markupAmount.toFixed(2)}</span>
                        </div>
                        <div className="border-t-2 pt-2 mt-2">
                          <div className="flex justify-between gap-2 p-3 bg-green-100 dark:bg-green-950 rounded-md border-2 border-green-300 dark:border-green-700">
                            <span className="font-bold text-lg">Customer Price:</span>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </AdminAuthProvider>
  );
}
