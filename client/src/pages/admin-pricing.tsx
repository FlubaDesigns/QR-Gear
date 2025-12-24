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
import { ArrowLeft, Loader2, DollarSign, Clock, Server } from "lucide-react";
import type { AdminSettings, HostingTier } from "@shared/schema";
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
    imageHostingUpcharge: "5",
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
        imageHostingUpcharge: settings.imageHostingUpcharge || "5",
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <div className="space-y-2">
              <Label htmlFor="imageHosting">Image Hosting ($)</Label>
              <Input
                id="imageHosting"
                type="number"
                value={formData.imageHostingUpcharge}
                onChange={(e) => setFormData({ ...formData, imageHostingUpcharge: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">For custom image QR codes</p>
            </div>
          </div>
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Pricing Settings
        </Button>
      </div>

      <HostingTiersSection />
    </div>
  );
}

function HostingTiersSection() {
  const { toast } = useToast();
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const { data: tiers, isLoading, refetch } = useQuery<HostingTier[]>({
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
    mutationFn: ({ id, priceUpcharge }: { id: string; priceUpcharge: string }) =>
      apiRequest("PUT", `/api/admin/hosting-tiers/${id}`, { priceUpcharge }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hosting-tiers"] });
      setEditingTier(null);
      toast({ title: "Success", description: "Price updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update price.", variant: "destructive" });
    },
  });

  function startEdit(tier: HostingTier) {
    setEditingTier(tier.id);
    setEditPrice(tier.priceUpcharge || "0");
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, priceUpcharge: editPrice });
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <CardTitle>Server Space Hosting Tiers</CardTitle>
        </div>
        <CardDescription>
          Set pricing for QR content hosting (images, landing pages). Customers select a tier when ordering products that need hosted content.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!tiers || tiers.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">No hosting tiers configured yet.</p>
            <Button 
              onClick={() => seedMutation.mutate()} 
              disabled={seedMutation.isPending}
              data-testid="button-seed-tiers"
            >
              {seedMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Default Tiers
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {tiers.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((tier) => (
              <div 
                key={tier.id} 
                className="flex items-center justify-between p-4 rounded-lg border-2 border-border bg-muted/30"
                data-testid={`tier-${tier.code}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[100px]">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold text-lg">{tier.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {formatDuration(tier.durationDays || 365)}
                  </Badge>
                  {tier.isIncluded && (
                    <Badge variant="default" className="bg-green-600">Included</Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  {editingTier === tier.id ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold">$</span>
                        <Input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-20 text-lg font-bold"
                          data-testid={`input-price-${tier.code}`}
                        />
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => saveEdit(tier.id)}
                        disabled={updateMutation.isPending}
                        data-testid={`button-save-${tier.code}`}
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setEditingTier(null)}
                        data-testid={`button-cancel-${tier.code}`}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-primary">
                        ${tier.priceUpcharge || "0"}
                      </span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => startEdit(tier)}
                        data-testid={`button-edit-${tier.code}`}
                      >
                        Edit
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
