import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Loader2, DollarSign, Clock, Server, Plus, Trash2, Tag, Percent } from "lucide-react";
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
import type { AdminSettings, HostingTier, Coupon } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

function PricingContent() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery<AdminSettings>({
    queryKey: ["/api/admin/settings"],
  });

  const [formData, setFormData] = useState({
    globalMarkupPercent: "25",
    globalMarkupFixed: "0",
    globalQrProductionCost: "2",
    textAboveUpcharge: "2",
    textBelowUpcharge: "2",
    showPricesBeforeCustomization: false,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        globalMarkupPercent: settings.globalMarkupPercent || "25",
        globalMarkupFixed: settings.globalMarkupFixed || "0",
        globalQrProductionCost: settings.globalQrProductionCost || "2",
        textAboveUpcharge: settings.textAboveUpcharge || "2",
        textBelowUpcharge: settings.textBelowUpcharge || "2",
        showPricesBeforeCustomization: settings.showPricesBeforeCustomization || false,
      });
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/settings", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Success", description: "Pricing settings saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Pricing Settings</CardTitle>
          <CardDescription>
            Set default markup and production costs. Individual products can override these.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="markupPercent">Default Markup (%)</Label>
              <Input
                id="markupPercent"
                type="number"
                value={formData.globalMarkupPercent}
                onChange={(e) => setFormData({ ...formData, globalMarkupPercent: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Applied to base price + QR cost</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="markupFixed">Fixed Markup ($)</Label>
              <Input
                id="markupFixed"
                type="number"
                value={formData.globalMarkupFixed}
                onChange={(e) => setFormData({ ...formData, globalMarkupFixed: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Added after percentage markup</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qrCost">QR Production Cost ($)</Label>
              <Input
                id="qrCost"
                type="number"
                value={formData.globalQrProductionCost}
                onChange={(e) => setFormData({ ...formData, globalQrProductionCost: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Cost for QR code printing/embedding</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Premium Features Upcharges</CardTitle>
          <CardDescription>Additional charges for premium customization options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="textAbove">Text Above QR ($)</Label>
              <Input
                id="textAbove"
                type="number"
                value={formData.textAboveUpcharge}
                onChange={(e) => setFormData({ ...formData, textAboveUpcharge: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Max 20 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="textBelow">Text Below QR ($)</Label>
              <Input
                id="textBelow"
                type="number"
                value={formData.textBelowUpcharge}
                onChange={(e) => setFormData({ ...formData, textBelowUpcharge: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Max 30 characters</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Image hosting fees are managed in the Server Space Hosting Tiers section below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showPrices">Show prices before customization</Label>
              <p className="text-sm text-muted-foreground">
                {formData.showPricesBeforeCustomization 
                  ? "Prices shown on product cards" 
                  : "Customers see price after building their design"}
              </p>
            </div>
            <Switch
              id="showPrices"
              checked={formData.showPricesBeforeCustomization}
              onCheckedChange={(checked) => setFormData({ ...formData, showPricesBeforeCustomization: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <HostingTiersSection />

      <CouponsSection />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Pricing Settings
        </Button>
      </div>
    </div>
  );
}

function HostingTiersSection() {
  const { toast } = useToast();
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<HostingTier | null>(null);
  const [newTier, setNewTier] = useState({
    name: "",
    durationDays: 365,
    priceUpcharge: "0",
  });

  const { data: tiers, isLoading } = useQuery<HostingTier[]>({
    queryKey: ["/api/admin/hosting-tiers"],
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/hosting-tiers/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hosting-tiers"] });
      toast({ title: "Success", description: "Hosting tiers created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create hosting tiers.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<HostingTier> }) =>
      apiRequest("PUT", `/api/admin/hosting-tiers/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hosting-tiers"] });
      setEditingTier(null);
      toast({ title: "Success", description: "Tier updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update tier.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { code: string; name: string; durationDays: number; priceUpcharge: string }) =>
      apiRequest("POST", "/api/admin/hosting-tiers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hosting-tiers"] });
      setShowAddDialog(false);
      setNewTier({ name: "", durationDays: 365, priceUpcharge: "0" });
      toast({ title: "Success", description: "New tier created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create tier.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/hosting-tiers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hosting-tiers"] });
      setDeleteConfirm(null);
      toast({ title: "Success", description: "Tier deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete tier.", variant: "destructive" });
    },
  });

  function startEdit(tier: HostingTier) {
    setEditingTier(tier.id);
    setEditPrice(tier.priceUpcharge || "0");
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, updates: { priceUpcharge: editPrice } });
  }

  function toggleActive(tier: HostingTier) {
    updateMutation.mutate({ id: tier.id, updates: { isActive: !tier.isActive } });
  }

  function handleCreateTier() {
    if (!newTier.name.trim()) {
      toast({ title: "Error", description: "Please enter a tier name.", variant: "destructive" });
      return;
    }
    const code = newTier.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    createMutation.mutate({
      code,
      name: newTier.name.trim(),
      durationDays: newTier.durationDays,
      priceUpcharge: newTier.priceUpcharge,
    });
  }

  function formatDuration(days: number): string {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return `${years} year${years > 1 ? "s" : ""}`;
    }
    return `${days} days`;
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
              <Server className="h-5 w-5 text-primary" />
              <CardTitle>Server Space Hosting Tiers</CardTitle>
            </div>
            {tiers && tiers.length > 0 && (
              <Button onClick={() => setShowAddDialog(true)} className="h-12" data-testid="button-add-tier">
                <Plus className="h-4 w-4 mr-2" />
                Add Tier
              </Button>
            )}
          </div>
          <CardDescription>
            Set pricing for QR content hosting (images, landing pages). Toggle tiers on/off to control which options customers see.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!tiers || tiers.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">No hosting tiers configured yet.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button 
                  onClick={() => seedMutation.mutate()} 
                  disabled={seedMutation.isPending}
                  data-testid="button-seed-tiers"
                >
                  {seedMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Default Tiers
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowAddDialog(true)} 
                  data-testid="button-add-tier-empty"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Tier
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {tiers.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((tier) => (
                <div 
                  key={tier.id} 
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border-2 ${tier.isActive !== false ? "border-border bg-muted/30" : "border-border/50 bg-muted/10 opacity-60"}`}
                  data-testid={`tier-${tier.code}`}
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <Switch
                      checked={tier.isActive !== false}
                      onCheckedChange={() => toggleActive(tier)}
                      data-testid={`toggle-${tier.code}`}
                    />
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <span className="font-semibold text-lg">{tier.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {formatDuration(tier.durationDays || 365)}
                    </Badge>
                    {tier.isIncluded && (
                      <Badge variant="default" className="bg-green-600">Included</Badge>
                    )}
                    {tier.isActive === false && (
                      <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {editingTier === tier.id ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-bold">$</span>
                          <Input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-24 h-12 text-lg font-bold"
                            data-testid={`input-price-${tier.code}`}
                          />
                        </div>
                        <Button 
                          className="h-12"
                          onClick={() => saveEdit(tier.id)}
                          disabled={updateMutation.isPending}
                          data-testid={`button-save-${tier.code}`}
                        >
                          Save
                        </Button>
                        <Button 
                          className="h-12"
                          variant="outline" 
                          onClick={() => setEditingTier(null)}
                          data-testid={`button-cancel-${tier.code}`}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-primary min-w-[60px]">
                          ${tier.priceUpcharge || "0"}
                        </span>
                        <Button 
                          className="h-12"
                          variant="outline"
                          onClick={() => startEdit(tier)}
                          data-testid={`button-edit-${tier.code}`}
                        >
                          Edit
                        </Button>
                        <Button 
                          className="h-12"
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteConfirm(tier)}
                          data-testid={`button-delete-${tier.code}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              
              <p className="text-sm text-muted-foreground mt-4">
                These prices are added to the product total when customers select extended hosting for Custom QR Gifts or QR Dynamics products.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Tier Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Hosting Tier</DialogTitle>
            <DialogDescription>Create a new hosting duration option for customers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tier-name">Tier Name</Label>
              <Input
                id="tier-name"
                placeholder="e.g., Forever, 5 Years"
                value={newTier.name}
                onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                className="h-12"
                data-testid="input-new-tier-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-days">Duration (days)</Label>
              <Input
                id="tier-days"
                type="number"
                placeholder="365"
                value={newTier.durationDays}
                onChange={(e) => setNewTier({ ...newTier, durationDays: parseInt(e.target.value) || 365 })}
                className="h-12"
                data-testid="input-new-tier-days"
              />
              <p className="text-xs text-muted-foreground">Use 36500 for "Forever" (100 years)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-price">Price Upcharge ($)</Label>
              <Input
                id="tier-price"
                type="number"
                placeholder="0"
                value={newTier.priceUpcharge}
                onChange={(e) => setNewTier({ ...newTier, priceUpcharge: e.target.value })}
                className="h-12"
                data-testid="input-new-tier-price"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTier} disabled={createMutation.isPending} data-testid="button-create-tier">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Tier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Tier?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
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
            <Button onClick={() => setShowAddDialog(true)} className="h-12" data-testid="button-add-coupon">
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
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border-2 ${coupon.isActive ? "border-border bg-muted/30" : "border-border/50 bg-muted/10 opacity-60"}`}
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
                      className="h-12"
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

      {/* Add Coupon - Bottom Sheet Drawer for mobile-friendly input */}
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
                className="h-12 font-mono uppercase"
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
                className="h-12"
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
                  <SelectTrigger className="h-12" data-testid="select-discount-type">
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
                  className="h-12"
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
                  className="h-12"
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
                  className="h-12"
                  data-testid="input-valid-until"
                />
              </div>
            </div>
          </div>
          <DrawerFooter className="pt-4 border-t">
            <Button onClick={handleCreateCoupon} disabled={createMutation.isPending} className="h-12 w-full" data-testid="button-create-coupon">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Coupon
            </Button>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="h-12 w-full">Cancel</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Dialog */}
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
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  return (
    <div className="min-h-screen">
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    Pricing
                  </h1>
                  <p className="text-xs text-slate-400">
                    Manage pricing and markup settings
                  </p>
                </div>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">Logged in as</p>
                  <p className="text-sm font-medium">{user.email || user.id}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyUserId}
                  className="font-mono text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
                  data-testid="button-copy-user-id"
                >
                  Copy ID
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        <nav className="mb-4 text-sm" aria-label="Breadcrumb">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground" data-testid="link-breadcrumb-admin">Admin</Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-foreground font-medium" aria-current="page" data-testid="text-breadcrumb-current">Pricing</span>
        </nav>

        <PricingContent />
      </main>
    </div>
  );
}
