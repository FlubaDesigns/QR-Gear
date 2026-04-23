import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus, Trash2, ShoppingBag, Settings, RefreshCw, Loader2, ExternalLink,
  CheckCircle, AlertCircle, Package, Layers, Link2, ListChecks, ScrollText,
  Pencil, Play, Clock, XCircle, Info, AlertTriangle, Zap,
} from "lucide-react";
import { SiEtsy, SiEbay, SiAmazon } from "react-icons/si";

export type MarketplacePlatform = "etsy" | "ebay" | "amazon";

const PLATFORM_INFO: Record<MarketplacePlatform, { name: string; icon: typeof SiEtsy; color: string }> = {
  etsy: { name: "Etsy", icon: SiEtsy, color: "text-orange-500" },
  ebay: { name: "eBay", icon: SiEbay, color: "text-blue-500" },
  amazon: { name: "Amazon", icon: SiAmazon, color: "text-yellow-500" },
};

export interface MarketplaceAccount {
  id: string;
  platform: MarketplacePlatform;
  accountName: string;
  shopId: string;
  shopName: string;
  feePercent: number;
  isActive: boolean;
  healthStatus?: string;
  // Amazon SP-API OAuth fields
  amazonConnected?: boolean;
  amazonSellerId?: string;
  amazonMarketplaceId?: string;
  amazonMarketplaceIds?: string[];
  amazonConnectedAt?: string;
  // eBay OAuth fields
  ebayConnected?: boolean;
  ebayUserId?: string;
  ebayUsername?: string;
  ebayConnectedAt?: string;
}

export function AccountsSection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    platform: "etsy" as MarketplacePlatform,
    accountName: "",
    shopId: "",
    shopName: "",
    feePercent: "0",
  });

  // Detect redirect back from Amazon or eBay OAuth and show result toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const amazonResult = params.get("amazon_connect");
    if (amazonResult) {
      if (amazonResult === "success") {
        toast({ title: "Amazon account connected", description: "Your seller account is now linked and ready to push listings." });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/accounts"] });
      } else if (amazonResult === "error") {
        const reason = params.get("reason") || "unknown error";
        toast({ title: "Amazon connection failed", description: reason, variant: "destructive" });
      }
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    const ebayResult = params.get("ebay_connect");
    if (ebayResult) {
      if (ebayResult === "success") {
        toast({ title: "eBay account connected", description: "Your eBay seller account is now linked and ready to push listings." });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/accounts"] });
      } else if (ebayResult === "error") {
        const reason = params.get("reason") || "unknown error";
        toast({ title: "eBay connection failed", description: reason, variant: "destructive" });
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: accounts = [], isLoading } = useQuery<MarketplaceAccount[]>({
    queryKey: ["/api/admin/surfaces/accounts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/admin/surfaces/accounts", {
        ...data,
        feePercent: parseFloat(data.feePercent) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/accounts"] });
      setShowAdd(false);
      resetForm();
      toast({ title: "Account created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/surfaces/accounts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/accounts"] });
      setEditingId(null);
      resetForm();
      toast({ title: "Account updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/surfaces/accounts/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/accounts"] });
      toast({ title: "Account deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/surfaces/accounts/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/accounts"] }),
  });

  const connectAmazonMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest("GET", `/api/marketplace/amazon/oauth/start?accountId=${accountId}`, undefined);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data as { oauthUrl: string; accountId: string; setupRequired?: boolean };
    },
    onSuccess: (data) => {
      setConnectingId(null);
      if (data.oauthUrl) {
        window.open(data.oauthUrl, "_blank", "noopener,noreferrer");
        toast({ title: "Amazon authorization opened", description: "Authorize QR Gear in the new tab, then return here." });
      }
    },
    onError: (err: Error) => {
      setConnectingId(null);
      const isSetup = err.message.includes("not configured");
      toast({
        title: isSetup ? "Amazon app credentials not set up yet" : "Could not start Amazon connection",
        description: isSetup
          ? "Set AMAZON_SP_APP_ID, AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET, and AMAZON_SP_REDIRECT_URI in the server environment, then try again."
          : err.message,
        variant: "destructive",
      });
    },
  });

  const disconnectAmazonMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/surfaces/accounts/${accountId}/amazon-disconnect`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/accounts"] });
      toast({ title: "Amazon account disconnected" });
    },
    onError: (err: Error) => toast({ title: "Disconnect failed", description: err.message, variant: "destructive" }),
  });

  const connectEbayMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest("GET", `/api/marketplace/ebay/oauth/start?accountId=${accountId}`, undefined);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data as { oauthUrl: string; accountId: string; setupRequired?: boolean };
    },
    onSuccess: (data) => {
      setConnectingId(null);
      if (data.oauthUrl) {
        window.open(data.oauthUrl, "_blank", "noopener,noreferrer");
        toast({ title: "eBay authorization opened", description: "Authorize QR Gear in the new tab, then return here." });
      }
    },
    onError: (err: Error) => {
      setConnectingId(null);
      const isSetup = err.message.includes("not configured");
      toast({
        title: isSetup ? "eBay app credentials not set up yet" : "Could not start eBay connection",
        description: isSetup
          ? "Set EBAY_APP_ID, EBAY_CERT_ID, and EBAY_RUNAME in the server environment, then try again."
          : err.message,
        variant: "destructive",
      });
    },
  });

  const disconnectEbayMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/surfaces/accounts/${accountId}/ebay-disconnect`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/accounts"] });
      toast({ title: "eBay account disconnected" });
    },
    onError: (err: Error) => toast({ title: "Disconnect failed", description: err.message, variant: "destructive" }),
  });

  const handleConnectAmazon = (accountId: string) => {
    setConnectingId(accountId);
    connectAmazonMutation.mutate(accountId);
  };

  const handleConnectEbay = (accountId: string) => {
    setConnectingId(accountId);
    connectEbayMutation.mutate(accountId);
  };

  const resetForm = () => setForm({ platform: "etsy", accountName: "", shopId: "", shopName: "", feePercent: "0" });

  const openEdit = (acct: MarketplaceAccount) => {
    setEditingId(acct.id);
    setForm({
      platform: acct.platform,
      accountName: acct.accountName,
      shopId: acct.shopId,
      shopName: acct.shopName,
      feePercent: String(acct.feePercent || 0),
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { ...form, feePercent: parseFloat(form.feePercent) || 0 } });
    } else {
      if (!form.accountName.trim()) { toast({ title: "Account name required", variant: "destructive" }); return; }
      createMutation.mutate(form);
    }
  };

  const isDialogOpen = showAdd || editingId !== null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-accounts-title">Marketplace Accounts</h2>
          <p className="text-sm text-muted-foreground">Connected marketplace seller accounts</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-add-account">
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Settings className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center">
              <h3 className="text-lg font-semibold" data-testid="text-empty-accounts">No Accounts</h3>
              <p className="text-sm text-muted-foreground mt-1">Connect your first marketplace seller account to start publishing.</p>
            </div>
            <Button onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-add-first-account">
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((acct) => {
            const info = PLATFORM_INFO[acct.platform];
            const PIcon = info?.icon;
            return (
              <Card key={acct.id} data-testid={`card-account-${acct.id}`}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {PIcon && <PIcon className={`h-6 w-6 flex-shrink-0 ${info.color}`} />}
                    <div className="min-w-0">
                      <p className="font-medium truncate" data-testid={`text-account-name-${acct.id}`}>{acct.accountName}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{info?.name || acct.platform}</Badge>
                        {acct.shopName && <span className="text-xs text-muted-foreground">{acct.shopName}</span>}
                        {acct.healthStatus === "healthy" && (
                          <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>
                        )}
                        {acct.healthStatus === "unhealthy" && (
                          <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 mr-1" />Unhealthy</Badge>
                        )}
                        {acct.platform === "amazon" && (
                          acct.amazonConnected
                            ? <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />SP-API Connected</Badge>
                            : <Badge variant="outline" className="text-xs text-muted-foreground">Not Connected</Badge>
                        )}
                        {acct.platform === "ebay" && (
                          acct.ebayConnected
                            ? <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />OAuth Connected</Badge>
                            : <Badge variant="outline" className="text-xs text-muted-foreground">Not Connected</Badge>
                        )}
                        {acct.platform === "ebay" && acct.ebayUsername && (
                          <span className="text-xs text-muted-foreground">{acct.ebayUsername}</span>
                        )}
                        {acct.feePercent > 0 && (
                          <span className="text-xs text-muted-foreground">{acct.feePercent}% fee</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {acct.platform === "amazon" && (
                      acct.amazonConnected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { if (confirm("Disconnect this Amazon account?")) disconnectAmazonMutation.mutate(acct.id); }}
                          disabled={disconnectAmazonMutation.isPending}
                          data-testid={`button-amazon-disconnect-${acct.id}`}
                        >
                          {disconnectAmazonMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnectAmazon(acct.id)}
                          disabled={connectingId === acct.id && connectAmazonMutation.isPending}
                          data-testid={`button-amazon-connect-${acct.id}`}
                        >
                          {connectingId === acct.id && connectAmazonMutation.isPending
                            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Connecting…</>
                            : <><SiAmazon className="h-3 w-3 mr-1" />Connect</>}
                        </Button>
                      )
                    )}
                    {acct.platform === "ebay" && (
                      acct.ebayConnected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { if (confirm("Disconnect this eBay account?")) disconnectEbayMutation.mutate(acct.id); }}
                          disabled={disconnectEbayMutation.isPending}
                          data-testid={`button-ebay-disconnect-${acct.id}`}
                        >
                          {disconnectEbayMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnectEbay(acct.id)}
                          disabled={connectingId === acct.id && connectEbayMutation.isPending}
                          data-testid={`button-ebay-connect-${acct.id}`}
                        >
                          {connectingId === acct.id && connectEbayMutation.isPending
                            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Connecting…</>
                            : <><SiEbay className="h-3 w-3 mr-1" />Connect</>}
                        </Button>
                      )
                    )}
                    <Switch
                      checked={acct.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: acct.id, isActive: checked })}
                      data-testid={`switch-account-active-${acct.id}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(acct)} data-testid={`button-edit-account-${acct.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { if (confirm(`Delete account "${acct.accountName}"?`)) deleteMutation.mutate(acct.id); }}
                      data-testid={`button-delete-account-${acct.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditingId(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Account" : "Add Marketplace Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(PLATFORM_INFO) as [MarketplacePlatform, typeof PLATFORM_INFO["etsy"]][]).map(([key, info]) => {
                  const Icon = info.icon;
                  return (
                    <Button
                      key={key}
                      variant={form.platform === key ? "default" : "outline"}
                      className="flex flex-col items-center gap-2 h-auto py-4"
                      onClick={() => setForm({ ...form, platform: key })}
                      data-testid={`button-platform-${key}`}
                    >
                      <Icon className={`h-6 w-6 ${form.platform !== key ? info.color : ""}`} />
                      <span className="text-sm">{info.name}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-name">Account Name</Label>
              <Input id="acct-name" placeholder="e.g. My Etsy Shop" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} data-testid="input-account-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-id">Shop / Seller ID</Label>
              <Input id="shop-id" placeholder="Platform-assigned ID" value={form.shopId} onChange={(e) => setForm({ ...form, shopId: e.target.value })} data-testid="input-shop-id" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop Name</Label>
              <Input id="shop-name" placeholder="Your shop name on the marketplace" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} data-testid="input-shop-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee-pct">Marketplace Fee %</Label>
              <Input id="fee-pct" type="number" min="0" max="100" step="0.1" value={form.feePercent} onChange={(e) => setForm({ ...form, feePercent: e.target.value })} data-testid="input-fee-percent" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditingId(null); resetForm(); }} data-testid="button-cancel-account">Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-account">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Save Changes" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ SURFACES SECTION ============

export interface EbayBlockData {
  categoryId?: string;
  conditionId?: string;
  listingFormat?: "FIXED_PRICE" | "AUCTION";
  subtitle?: string;
  itemSpecifics?: Record<string, string>;
  bestOfferEnabled?: boolean;
  shippingPolicyId?: string;
  returnsPolicyId?: string;
  paymentPolicyId?: string;
  handlingTime?: number;
  packageWeightLbs?: number;
  packageDimensionsInches?: { length: number; width: number; height: number };
  upc?: string;
  ean?: string;
  mpn?: string;
  brand?: string;
  priceOverride?: number;
  quantity?: number;
}

export interface SurfaceData {
  id: string;
  masterProductId: string;
  title: string;
  subtitle?: string;
  description: string;
  bulletPoints?: string[];
  tags: string[];
  keywords?: string[];
  images: string[];
  mockupImages?: string[];
  retailPrice: number;
  compareAtPrice?: number;
  currency?: string;
  sku: string;
  defaultSkuPrefix?: string;
  enabledPlatforms: MarketplacePlatform[];
  storeId?: string;
  channelId?: string;
  collectionId?: string;
  productId?: string;
  artifactId?: string;
  mosaicId?: string;
  supportsEmbedStore?: boolean;
  supportsEmbedProduct?: boolean;
  supportsEmbedBuilder?: boolean;
  supportsEtsy?: boolean;
  supportsEbay?: boolean;
  supportsAmazon?: boolean;
  // Marketplace-common
  condition?: string;
  brand?: string;
  material?: string;
  department?: string;
  shippingProfileRef?: string;
  returnsProfileRef?: string;
  // eBay-specific block
  ebay?: EbayBlockData;
  status: string;
  readinessErrors: string[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Parses "Key: Value" lines into a Record<string, string>
function parseItemSpecifics(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const k = line.slice(0, colonIdx).trim();
    const v = line.slice(colonIdx + 1).trim();
    if (k && v) result[k] = v;
  }
  return result;
}

// Converts a Record<string, string> to "Key: Value" lines
function serializeItemSpecifics(rec?: Record<string, string>): string {
  if (!rec) return "";
  return Object.entries(rec).map(([k, v]) => `${k}: ${v}`).join("\n");
}

type SurfaceForm = {
  masterProductId: string;
  title: string;
  subtitle: string;
  description: string;
  bulletPoints: string;
  tags: string;
  keywords: string;
  retailPrice: string;
  compareAtPrice: string;
  sku: string;
  storeId: string;
  channelId: string;
  collectionId: string;
  supportsEmbedStore: boolean;
  supportsEmbedProduct: boolean;
  supportsEmbedBuilder: boolean;
  enabledPlatforms: MarketplacePlatform[];
  // Common fields
  brand: string;
  condition: string;
  material: string;
  department: string;
  shippingProfileRef: string;
  returnsProfileRef: string;
  // eBay block (flattened for form editing)
  ebay_categoryId: string;
  ebay_conditionId: string;
  ebay_listingFormat: "FIXED_PRICE" | "AUCTION";
  ebay_subtitle: string;
  ebay_bestOfferEnabled: boolean;
  ebay_itemSpecifics: string;
  ebay_shippingPolicyId: string;
  ebay_returnsPolicyId: string;
  ebay_paymentPolicyId: string;
  ebay_handlingTime: string;
  ebay_packageWeightLbs: string;
  ebay_dimLength: string;
  ebay_dimWidth: string;
  ebay_dimHeight: string;
  ebay_upc: string;
  ebay_ean: string;
  ebay_mpn: string;
  ebay_brand: string;
  ebay_priceOverride: string;
  ebay_quantity: string;
};

const DEFAULT_FORM: SurfaceForm = {
  masterProductId: "", title: "", subtitle: "", description: "",
  bulletPoints: "", tags: "", keywords: "",
  retailPrice: "", compareAtPrice: "", sku: "",
  storeId: "", channelId: "", collectionId: "",
  supportsEmbedStore: false, supportsEmbedProduct: false, supportsEmbedBuilder: false,
  enabledPlatforms: [],
  brand: "", condition: "", material: "", department: "",
  shippingProfileRef: "", returnsProfileRef: "",
  ebay_categoryId: "", ebay_conditionId: "", ebay_listingFormat: "FIXED_PRICE",
  ebay_subtitle: "", ebay_bestOfferEnabled: false, ebay_itemSpecifics: "",
  ebay_shippingPolicyId: "", ebay_returnsPolicyId: "", ebay_paymentPolicyId: "",
  ebay_handlingTime: "", ebay_packageWeightLbs: "",
  ebay_dimLength: "", ebay_dimWidth: "", ebay_dimHeight: "",
  ebay_upc: "", ebay_ean: "", ebay_mpn: "",
  ebay_brand: "", ebay_priceOverride: "", ebay_quantity: "",
};

// Hydrate form from an existing SurfaceData for editing
function surfaceToForm(s: SurfaceData): SurfaceForm {
  const eb = s.ebay || {};
  const dims = eb.packageDimensionsInches;
  return {
    masterProductId: s.masterProductId || "",
    title: s.title || "",
    subtitle: s.subtitle || "",
    description: s.description || "",
    bulletPoints: (s.bulletPoints || []).join("\n"),
    tags: (s.tags || []).join(", "),
    keywords: (s.keywords || []).join(", "),
    retailPrice: s.retailPrice != null ? String(s.retailPrice) : "",
    compareAtPrice: s.compareAtPrice != null ? String(s.compareAtPrice) : "",
    sku: s.sku || "",
    storeId: s.storeId || "",
    channelId: s.channelId || "",
    collectionId: s.collectionId || "",
    supportsEmbedStore: !!s.supportsEmbedStore,
    supportsEmbedProduct: !!s.supportsEmbedProduct,
    supportsEmbedBuilder: !!s.supportsEmbedBuilder,
    enabledPlatforms: s.enabledPlatforms || [],
    brand: s.brand || "",
    condition: s.condition || "",
    material: s.material || "",
    department: s.department || "",
    shippingProfileRef: s.shippingProfileRef || "",
    returnsProfileRef: s.returnsProfileRef || "",
    ebay_categoryId: eb.categoryId || "",
    ebay_conditionId: eb.conditionId || "",
    ebay_listingFormat: (eb.listingFormat as "FIXED_PRICE" | "AUCTION") || "FIXED_PRICE",
    ebay_subtitle: eb.subtitle || "",
    ebay_bestOfferEnabled: !!eb.bestOfferEnabled,
    ebay_itemSpecifics: serializeItemSpecifics(eb.itemSpecifics),
    ebay_shippingPolicyId: eb.shippingPolicyId || "",
    ebay_returnsPolicyId: eb.returnsPolicyId || "",
    ebay_paymentPolicyId: eb.paymentPolicyId || "",
    ebay_handlingTime: eb.handlingTime != null ? String(eb.handlingTime) : "",
    ebay_packageWeightLbs: eb.packageWeightLbs != null ? String(eb.packageWeightLbs) : "",
    ebay_dimLength: dims?.length != null ? String(dims.length) : "",
    ebay_dimWidth: dims?.width != null ? String(dims.width) : "",
    ebay_dimHeight: dims?.height != null ? String(dims.height) : "",
    ebay_upc: eb.upc || "",
    ebay_ean: eb.ean || "",
    ebay_mpn: eb.mpn || "",
    ebay_brand: eb.brand || "",
    ebay_priceOverride: eb.priceOverride != null ? String(eb.priceOverride) : "",
    ebay_quantity: eb.quantity != null ? String(eb.quantity) : "",
  };
}

// Build the API payload from the form state
function buildSurfacePayload(data: SurfaceForm) {
  const wantsEbay = data.enabledPlatforms.includes("ebay");
  const ebayBlock: EbayBlockData | undefined = wantsEbay ? {
    categoryId: data.ebay_categoryId || undefined,
    conditionId: data.ebay_conditionId || undefined,
    listingFormat: data.ebay_listingFormat || undefined,
    subtitle: data.ebay_subtitle || undefined,
    itemSpecifics: parseItemSpecifics(data.ebay_itemSpecifics),
    bestOfferEnabled: data.ebay_bestOfferEnabled,
    shippingPolicyId: data.ebay_shippingPolicyId || undefined,
    returnsPolicyId: data.ebay_returnsPolicyId || undefined,
    paymentPolicyId: data.ebay_paymentPolicyId || undefined,
    handlingTime: data.ebay_handlingTime ? parseInt(data.ebay_handlingTime) : undefined,
    packageWeightLbs: data.ebay_packageWeightLbs ? parseFloat(data.ebay_packageWeightLbs) : undefined,
    packageDimensionsInches: (data.ebay_dimLength && data.ebay_dimWidth && data.ebay_dimHeight) ? {
      length: parseFloat(data.ebay_dimLength),
      width: parseFloat(data.ebay_dimWidth),
      height: parseFloat(data.ebay_dimHeight),
    } : undefined,
    upc: data.ebay_upc || undefined,
    ean: data.ebay_ean || undefined,
    mpn: data.ebay_mpn || undefined,
    brand: data.ebay_brand || undefined,
    priceOverride: data.ebay_priceOverride ? parseFloat(data.ebay_priceOverride) : undefined,
    quantity: data.ebay_quantity ? parseInt(data.ebay_quantity) : undefined,
  } : undefined;

  return {
    masterProductId: data.masterProductId,
    title: data.title,
    subtitle: data.subtitle,
    description: data.description,
    bulletPoints: data.bulletPoints.split("\n").map((t) => t.trim()).filter(Boolean),
    tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean),
    keywords: data.keywords.split(",").map((t) => t.trim()).filter(Boolean),
    retailPrice: parseFloat(data.retailPrice) || 0,
    compareAtPrice: data.compareAtPrice ? parseFloat(data.compareAtPrice) : undefined,
    sku: data.sku,
    storeId: data.storeId || undefined,
    channelId: data.channelId || undefined,
    collectionId: data.collectionId || undefined,
    supportsEmbedStore: data.supportsEmbedStore,
    supportsEmbedProduct: data.supportsEmbedProduct,
    supportsEmbedBuilder: data.supportsEmbedBuilder,
    enabledPlatforms: data.enabledPlatforms,
    brand: data.brand || undefined,
    condition: data.condition || undefined,
    material: data.material || undefined,
    department: data.department || undefined,
    shippingProfileRef: data.shippingProfileRef || undefined,
    returnsProfileRef: data.returnsProfileRef || undefined,
    ebay: ebayBlock,
  };
}

// ─── Push to Amazon dialog ────────────────────────────────────────────────────

function PushToAmazonDialog({
  open,
  onClose,
  surfaceId,
  surfaceTitle,
  surfaceSku,
}: {
  open: boolean;
  onClose: () => void;
  surfaceId: string;
  surfaceTitle: string;
  surfaceSku?: string;
}) {
  const { toast } = useToast();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [skuOverride, setSkuOverride] = useState(surfaceSku || "");

  const { data: allAccounts = [] } = useQuery<MarketplaceAccount[]>({
    queryKey: ["/api/admin/surfaces/accounts"],
    enabled: open,
  });

  const amazonAccounts = allAccounts.filter(
    (a) => a.platform === "amazon" && a.amazonConnected && a.isActive
  );

  useEffect(() => {
    if (amazonAccounts.length === 1 && !selectedAccountId) {
      setSelectedAccountId(amazonAccounts[0].id);
    }
  }, [amazonAccounts.length]);

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/surfaces/${surfaceId}/push-to-amazon`, {
        accountId: selectedAccountId,
        ...(skuOverride ? { sku: skuOverride } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push failed");
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Pushed to Amazon", description: `Listing submitted (SKU: ${data.sku}). Check Seller Central for status.` });
      } else {
        toast({
          title: "Amazon returned issues",
          description: data.issues?.map((i: any) => i.message).join("; ") || data.error || "Unknown issue",
          variant: "destructive",
        });
      }
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Push failed", description: err.message, variant: "destructive" }),
  });

  const handleClose = () => {
    if (pushMutation.isPending) return;
    setSelectedAccountId("");
    setSkuOverride(surfaceSku || "");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Push to Amazon</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Submit <span className="font-medium">{surfaceTitle || "this surface"}</span> as a listing to Amazon via SP-API.
          </p>

          {amazonAccounts.length === 0 ? (
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm font-medium text-destructive">No connected Amazon accounts</p>
              <p className="text-xs text-muted-foreground">Go to the Accounts tab, add an Amazon account, and complete the SP-API OAuth flow first.</p>
            </div>
          ) : (
            <>
              {amazonAccounts.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs">Amazon Seller Account</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger data-testid="select-push-account">
                      <SelectValue placeholder="Select account…" />
                    </SelectTrigger>
                    <SelectContent>
                      {amazonAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} data-testid={`option-push-account-${a.id}`}>
                          {a.accountName}
                          {a.amazonSellerId && <span className="text-muted-foreground ml-2 text-xs">{a.amazonSellerId}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {amazonAccounts.length === 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <SiAmazon className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">{amazonAccounts[0].accountName}</span>
                  {amazonAccounts[0].amazonSellerId && (
                    <span className="text-muted-foreground text-xs">({amazonAccounts[0].amazonSellerId})</span>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">SKU</Label>
                <Input
                  value={skuOverride}
                  onChange={(e) => setSkuOverride(e.target.value)}
                  placeholder={`Auto: QRG-${surfaceId.slice(0, 8).toUpperCase()}`}
                  data-testid="input-push-sku"
                />
                <p className="text-xs text-muted-foreground">Leave blank to use the surface SKU or an auto-generated one.</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={pushMutation.isPending} data-testid="button-push-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => pushMutation.mutate()}
            disabled={!selectedAccountId || pushMutation.isPending || amazonAccounts.length === 0}
            data-testid="button-push-confirm"
          >
            {pushMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Pushing…</>
            ) : (
              <><SiAmazon className="h-4 w-4 mr-2" />Push to Amazon</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Push to eBay dialog ──────────────────────────────────────────────────────

function PushToEbayDialog({
  open,
  onClose,
  surfaceId,
  surfaceTitle,
  surfaceSku,
}: {
  open: boolean;
  onClose: () => void;
  surfaceId: string;
  surfaceTitle: string;
  surfaceSku?: string;
}) {
  const { toast } = useToast();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [skuOverride, setSkuOverride] = useState(surfaceSku || "");

  const { data: allAccounts = [] } = useQuery<MarketplaceAccount[]>({
    queryKey: ["/api/admin/surfaces/accounts"],
    enabled: open,
  });

  const ebayAccounts = allAccounts.filter(
    (a) => a.platform === "ebay" && a.ebayConnected && a.isActive
  );

  useEffect(() => {
    if (ebayAccounts.length === 1 && !selectedAccountId) {
      setSelectedAccountId(ebayAccounts[0].id);
    }
  }, [ebayAccounts.length]);

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/surfaces/${surfaceId}/push-to-ebay`, {
        accountId: selectedAccountId,
        ...(skuOverride ? { sku: skuOverride } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push failed");
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Pushed to eBay",
          description: `Listing published (SKU: ${data.sku}${data.listingId ? `, Listing ID: ${data.listingId}` : ""}).`,
        });
      } else {
        toast({
          title: "eBay push failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Push failed", description: err.message, variant: "destructive" }),
  });

  const handleClose = () => {
    if (pushMutation.isPending) return;
    setSelectedAccountId("");
    setSkuOverride(surfaceSku || "");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Push to eBay</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Publish <span className="font-medium">{surfaceTitle || "this surface"}</span> as an active eBay listing via the Inventory API.
          </p>

          {ebayAccounts.length === 0 ? (
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm font-medium text-destructive">No connected eBay accounts</p>
              <p className="text-xs text-muted-foreground">Go to the Accounts tab, add an eBay account, and complete the OAuth flow first.</p>
            </div>
          ) : (
            <>
              {ebayAccounts.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs">eBay Seller Account</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger data-testid="select-ebay-push-account">
                      <SelectValue placeholder="Select account…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ebayAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} data-testid={`option-ebay-push-account-${a.id}`}>
                          {a.accountName}
                          {a.ebayUsername && <span className="text-muted-foreground ml-2 text-xs">{a.ebayUsername}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {ebayAccounts.length === 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <SiEbay className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">{ebayAccounts[0].accountName}</span>
                  {ebayAccounts[0].ebayUsername && (
                    <span className="text-muted-foreground text-xs">({ebayAccounts[0].ebayUsername})</span>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">SKU</Label>
                <Input
                  value={skuOverride}
                  onChange={(e) => setSkuOverride(e.target.value)}
                  placeholder={`Auto: QRG-${surfaceId.slice(0, 8).toUpperCase()}`}
                  data-testid="input-ebay-push-sku"
                />
                <p className="text-xs text-muted-foreground">Leave blank to use the surface SKU or an auto-generated one.</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={pushMutation.isPending} data-testid="button-ebay-push-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => pushMutation.mutate()}
            disabled={!selectedAccountId || pushMutation.isPending || ebayAccounts.length === 0}
            data-testid="button-ebay-push-confirm"
          >
            {pushMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Pushing…</>
            ) : (
              <><SiEbay className="h-4 w-4 mr-2" />Push to eBay</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin instance shape used by the generate dialog ────────────────────────

interface AdminInstancePreview {
  id: string;
  resolved?: { title?: string };
  folderPath?: string | null;
  status?: string;
}

// ─── Generate Surface from Built Product dialog ───────────────────────────────

function GenerateFromProductDialog({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: (surfaceId: string) => void;
}) {
  const { toast } = useToast();
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [marketplace, setMarketplace] = useState<MarketplacePlatform>("ebay");

  const {
    data: instances = [],
    isLoading: instancesLoading,
    error: instancesError,
  } = useQuery<AdminInstancePreview[]>({
    queryKey: ["/api/admin/catalog-instances"],
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: async (vars: { instanceId: string; marketplace: string }) => {
      const res = await apiRequest("POST", "/api/admin/surfaces/generate-from-instance", vars);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces"] });
      toast({ title: "Surface generated", description: "Draft surface created — open it to review and fill in any remaining fields." });
      onGenerated(data.surfaceId);
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const handleClose = () => {
    if (generateMutation.isPending) return;
    setSelectedInstanceId("");
    setMarketplace("ebay");
    onClose();
  };

  const handleGenerate = () => {
    if (!selectedInstanceId) {
      toast({ title: "Select a product first", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ instanceId: selectedInstanceId, marketplace });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Surface from Built Product</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Pick a committed built product and a target marketplace. A draft Surface will be created with title, description, images, pricing, colors, and sizes pre-filled from the product pipeline.
          </p>

          {instancesError ? (
            <p className="text-sm text-destructive" data-testid="text-generate-error">
              Failed to load products: {(instancesError as Error).message}
            </p>
          ) : instancesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading built products…
            </div>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-generate-empty">
              No committed products found. Build and commit a product first.
            </p>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Built Product</Label>
              <Select
                value={selectedInstanceId}
                onValueChange={setSelectedInstanceId}
              >
                <SelectTrigger data-testid="select-generate-instance">
                  <SelectValue placeholder="Choose a product…" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem
                      key={inst.id}
                      value={inst.id}
                      data-testid={`option-instance-${inst.id}`}
                    >
                      <span className="font-medium">
                        {inst.resolved?.title || "Untitled Product"}
                      </span>
                      {inst.folderPath && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          — {inst.folderPath}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Target Marketplace</Label>
            <Select
              value={marketplace}
              onValueChange={(v) => setMarketplace(v as MarketplacePlatform)}
            >
              <SelectTrigger data-testid="select-generate-marketplace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ebay" data-testid="option-marketplace-ebay">eBay</SelectItem>
                <SelectItem value="etsy" data-testid="option-marketplace-etsy">Etsy</SelectItem>
                <SelectItem value="amazon" data-testid="option-marketplace-amazon">Amazon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Fields requiring external lookup (eBay category ID, policy IDs) will be left blank for you to fill in the Surface editor before publishing.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={generateMutation.isPending}
            data-testid="button-generate-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedInstanceId || generateMutation.isPending || instancesLoading}
            data-testid="button-generate-confirm"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Generate Surface
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function SurfacesSection() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [pushTarget, setPushTarget] = useState<{ id: string; title: string; sku?: string } | null>(null);
  const [ebayPushTarget, setEbayPushTarget] = useState<{ id: string; title: string; sku?: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SurfaceForm>(DEFAULT_FORM);

  const setF = (patch: Partial<SurfaceForm>) => setForm((f) => ({ ...f, ...patch }));

  const { data: surfaces = [], isLoading } = useQuery<SurfaceData[]>({
    queryKey: ["/api/admin/surfaces"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: SurfaceForm) => {
      const res = await apiRequest("POST", "/api/admin/surfaces", buildSurfacePayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces"] });
      setShowAdd(false);
      setForm(DEFAULT_FORM);
      toast({ title: "Surface created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SurfaceForm }) => {
      const res = await apiRequest("PATCH", `/api/admin/surfaces/${id}`, buildSurfacePayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces"] });
      setEditingId(null);
      setForm(DEFAULT_FORM);
      toast({ title: "Surface updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const checkReadinessMutation = useMutation({
    mutationFn: async (surfaceId: string) => {
      const res = await apiRequest("POST", `/api/admin/surfaces/${surfaceId}/check-readiness`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces"] });
      if (data.ready) {
        toast({ title: "Surface is ready for publishing" });
      } else {
        toast({ title: "Surface not ready", description: data.errors.slice(0, 3).join(" • "), variant: "destructive" });
      }
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/surfaces/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces"] });
      toast({ title: "Surface deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (s: SurfaceData) => {
    setForm(surfaceToForm(s));
    setEditingId(s.id);
  };

  const handleGenerated = (surfaceId: string) => {
    const generated = surfaces.find((s) => s.id === surfaceId);
    if (generated) {
      openEdit(generated);
    }
  };

  const closeDialog = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDialogOpen = showAdd || editingId !== null;

  const togglePlatform = (p: MarketplacePlatform) => {
    setF({
      enabledPlatforms: form.enabledPlatforms.includes(p)
        ? form.enabledPlatforms.filter((x) => x !== p)
        : [...form.enabledPlatforms, p],
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ready": return <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>;
      case "published": return <Badge variant="default" className="text-xs"><ExternalLink className="h-3 w-3 mr-1" />Published</Badge>;
      case "archived": return <Badge variant="secondary" className="text-xs">Archived</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Draft</Badge>;
    }
  };

  const ebayEnabled = form.enabledPlatforms.includes("ebay");

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-surfaces-title">Surfaces</h2>
          <p className="text-sm text-muted-foreground">Marketplace-ready product configurations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowGenerate(true)} data-testid="button-generate-surface">
            <Zap className="h-4 w-4 mr-2" />
            Generate from Product
          </Button>
          <Button onClick={() => setShowAdd(true)} data-testid="button-add-surface">
            <Plus className="h-4 w-4 mr-2" />
            Create Surface
          </Button>
        </div>
      </div>

      <GenerateFromProductDialog
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onGenerated={handleGenerated}
      />

      {pushTarget && (
        <PushToAmazonDialog
          open={!!pushTarget}
          onClose={() => setPushTarget(null)}
          surfaceId={pushTarget.id}
          surfaceTitle={pushTarget.title}
          surfaceSku={pushTarget.sku}
        />
      )}

      {ebayPushTarget && (
        <PushToEbayDialog
          open={!!ebayPushTarget}
          onClose={() => setEbayPushTarget(null)}
          surfaceId={ebayPushTarget.id}
          surfaceTitle={ebayPushTarget.title}
          surfaceSku={ebayPushTarget.sku}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : surfaces.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Layers className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center">
              <h3 className="text-lg font-semibold" data-testid="text-empty-surfaces">No Surfaces</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a surface to prepare a product for marketplace publishing.</p>
            </div>
            <Button onClick={() => setShowAdd(true)} data-testid="button-add-first-surface">
              <Plus className="h-4 w-4 mr-2" />
              Create Surface
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {surfaces.map((surface) => (
            <Card key={surface.id} data-testid={`card-surface-${surface.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate" data-testid={`text-surface-title-${surface.id}`}>
                        {surface.title || "Untitled Surface"}
                      </p>
                      {statusBadge(surface.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {surface.sku && <span className="text-xs text-muted-foreground font-mono">SKU: {surface.sku}</span>}
                      {surface.retailPrice > 0 && <span className="text-xs text-muted-foreground">${surface.retailPrice.toFixed(2)}</span>}
                      {surface.brand && <span className="text-xs text-muted-foreground">{surface.brand}</span>}
                      {surface.enabledPlatforms?.map((p) => {
                        const info = PLATFORM_INFO[p];
                        const PIcon = info?.icon;
                        return PIcon ? <PIcon key={p} className={`h-4 w-4 ${info.color}`} /> : null;
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {surface.supportsEmbedStore && <Badge variant="secondary" className="text-xs">Embed Store</Badge>}
                      {surface.supportsEmbedProduct && <Badge variant="secondary" className="text-xs">Embed Product</Badge>}
                      {surface.supportsEmbedBuilder && <Badge variant="secondary" className="text-xs">Embed Builder</Badge>}
                      {surface.ebay?.categoryId && <Badge variant="secondary" className="text-xs"><SiEbay className="h-3 w-3 mr-1" />Cat {surface.ebay.categoryId}</Badge>}
                      {surface.storeId && <span className="text-xs text-muted-foreground">Store: {surface.storeId.slice(0, 8)}</span>}
                    </div>
                    {surface.readinessErrors?.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {surface.readinessErrors.slice(0, 4).map((e, i) => (
                          <p key={i} className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />{e}
                          </p>
                        ))}
                        {surface.readinessErrors.length > 4 && (
                          <p className="text-xs text-muted-foreground">{surface.readinessErrors.length - 4} more error(s)…</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {surface.enabledPlatforms?.includes("amazon") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPushTarget({ id: surface.id, title: surface.title || "Untitled", sku: surface.sku })}
                        data-testid={`button-push-amazon-${surface.id}`}
                      >
                        <SiAmazon className="h-3 w-3 mr-1 text-yellow-500" />
                        Push
                      </Button>
                    )}
                    {(surface.enabledPlatforms?.includes("ebay") || surface.supportsEbay) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEbayPushTarget({ id: surface.id, title: surface.title || "Untitled", sku: surface.sku })}
                        data-testid={`button-push-ebay-${surface.id}`}
                      >
                        <SiEbay className="h-3 w-3 mr-1 text-blue-500" />
                        Push
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => checkReadinessMutation.mutate(surface.id)} disabled={checkReadinessMutation.isPending} data-testid={`button-check-readiness-${surface.id}`}>
                      {checkReadinessMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Check
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(surface)} data-testid={`button-edit-surface-${surface.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete surface "${surface.title || surface.id}"?`)) deleteMutation.mutate(surface.id); }} data-testid={`button-delete-surface-${surface.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Surface" : "Create Surface"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">

            {/* ─── Core fields ─── */}
            <div className="space-y-2">
              <Label htmlFor="s-mpid">Master Product ID</Label>
              <Input id="s-mpid" placeholder="Firestore product ID" value={form.masterProductId} onChange={(e) => setF({ masterProductId: e.target.value })} data-testid="input-surface-product-id" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-title">Listing Title</Label>
              <Input id="s-title" placeholder="Marketplace listing title (≤80 chars for eBay)" value={form.title} onChange={(e) => setF({ title: e.target.value })} data-testid="input-surface-title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-subtitle">Subtitle</Label>
              <Input id="s-subtitle" placeholder="Optional subtitle" value={form.subtitle} onChange={(e) => setF({ subtitle: e.target.value })} data-testid="input-surface-subtitle" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-desc">Description</Label>
              <Textarea id="s-desc" placeholder="Product description" value={form.description} onChange={(e) => setF({ description: e.target.value })} data-testid="input-surface-description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-bullets">Bullet Points (one per line)</Label>
              <Textarea id="s-bullets" placeholder="Key feature 1&#10;Key feature 2" value={form.bulletPoints} onChange={(e) => setF({ bulletPoints: e.target.value })} data-testid="input-surface-bullets" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="s-price">Retail Price</Label>
                <Input id="s-price" type="number" min="0" step="0.01" value={form.retailPrice} onChange={(e) => setF({ retailPrice: e.target.value })} data-testid="input-surface-price" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-compare">Compare At Price</Label>
                <Input id="s-compare" type="number" min="0" step="0.01" placeholder="Optional" value={form.compareAtPrice} onChange={(e) => setF({ compareAtPrice: e.target.value })} data-testid="input-surface-compare-price" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-sku">SKU</Label>
              <Input id="s-sku" placeholder="e.g. QG-TSHIRT-001" value={form.sku} onChange={(e) => setF({ sku: e.target.value })} data-testid="input-surface-sku" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-tags">Tags (comma-separated)</Label>
              <Input id="s-tags" placeholder="qr code, custom, apparel" value={form.tags} onChange={(e) => setF({ tags: e.target.value })} data-testid="input-surface-tags" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-keywords">Keywords (comma-separated)</Label>
              <Input id="s-keywords" placeholder="qr, custom, personalized" value={form.keywords} onChange={(e) => setF({ keywords: e.target.value })} data-testid="input-surface-keywords" />
            </div>

            {/* ─── Marketplace-common fields ─── */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">Common Product Details</p>
              <p className="text-xs text-muted-foreground mb-3">Used across all enabled marketplaces and fed into eBay aspects.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="s-brand" className="text-xs">Brand</Label>
                  <Input id="s-brand" placeholder="e.g. QR Gear" value={form.brand} onChange={(e) => setF({ brand: e.target.value })} data-testid="input-surface-brand" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-condition" className="text-xs">Condition</Label>
                  <Select value={form.condition || "_none"} onValueChange={(v) => setF({ condition: v === "_none" ? "" : v })}>
                    <SelectTrigger id="s-condition" data-testid="select-surface-condition"><SelectValue placeholder="Select condition" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="new_with_tags">New with tags</SelectItem>
                      <SelectItem value="new_without_tags">New without tags</SelectItem>
                      <SelectItem value="used_excellent">Used — Excellent</SelectItem>
                      <SelectItem value="used_good">Used — Good</SelectItem>
                      <SelectItem value="refurbished">Refurbished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-material" className="text-xs">Material</Label>
                  <Input id="s-material" placeholder="e.g. Cotton, Polyester" value={form.material} onChange={(e) => setF({ material: e.target.value })} data-testid="input-surface-material" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-dept" className="text-xs">Department</Label>
                  <Select value={form.department || "_none"} onValueChange={(v) => setF({ department: v === "_none" ? "" : v })}>
                    <SelectTrigger id="s-dept" data-testid="select-surface-department"><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
                      <SelectItem value="Men">Men</SelectItem>
                      <SelectItem value="Women">Women</SelectItem>
                      <SelectItem value="Unisex">Unisex</SelectItem>
                      <SelectItem value="Kids">Kids</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-ship-ref" className="text-xs">Shipping Profile Ref</Label>
                  <Input id="s-ship-ref" placeholder="Generic shipping profile ID" value={form.shippingProfileRef} onChange={(e) => setF({ shippingProfileRef: e.target.value })} data-testid="input-surface-shipping-ref" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-ret-ref" className="text-xs">Returns Profile Ref</Label>
                  <Input id="s-ret-ref" placeholder="Generic returns profile ID" value={form.returnsProfileRef} onChange={(e) => setF({ returnsProfileRef: e.target.value })} data-testid="input-surface-returns-ref" />
                </div>
              </div>
            </div>

            {/* ─── Linked Resources ─── */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Linked Resources</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="s-store" className="text-xs">Store ID</Label>
                  <Input id="s-store" placeholder="Optional" value={form.storeId} onChange={(e) => setF({ storeId: e.target.value })} data-testid="input-surface-store-id" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-channel" className="text-xs">Channel ID</Label>
                  <Input id="s-channel" placeholder="Optional" value={form.channelId} onChange={(e) => setF({ channelId: e.target.value })} data-testid="input-surface-channel-id" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-collection" className="text-xs">Collection ID</Label>
                  <Input id="s-collection" placeholder="Optional" value={form.collectionId} onChange={(e) => setF({ collectionId: e.target.value })} data-testid="input-surface-collection-id" />
                </div>
              </div>
            </div>

            {/* ─── Embed Support ─── */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Embed Support</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="toggle-embed-store">
                  <input type="checkbox" className="rounded" checked={form.supportsEmbedStore} onChange={(e) => setF({ supportsEmbedStore: e.target.checked })} />
                  Mini Store
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="toggle-embed-product">
                  <input type="checkbox" className="rounded" checked={form.supportsEmbedProduct} onChange={(e) => setF({ supportsEmbedProduct: e.target.checked })} />
                  Mini Product
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="toggle-embed-builder">
                  <input type="checkbox" className="rounded" checked={form.supportsEmbedBuilder} onChange={(e) => setF({ supportsEmbedBuilder: e.target.checked })} />
                  Mini Builder
                </label>
              </div>
            </div>

            {/* ─── Target Platforms ─── */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Target Platforms</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(PLATFORM_INFO) as [MarketplacePlatform, typeof PLATFORM_INFO["etsy"]][]).map(([key, info]) => {
                  const Icon = info.icon;
                  const selected = form.enabledPlatforms.includes(key);
                  return (
                    <Button key={key} variant={selected ? "default" : "outline"} size="sm" onClick={() => togglePlatform(key)} className="gap-1.5" data-testid={`button-toggle-platform-${key}`}>
                      <Icon className={`h-4 w-4 ${!selected ? info.color : ""}`} />
                      {info.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* ─── eBay-specific block — visible only when eBay is selected ─── */}
            {ebayEnabled && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <SiEbay className="h-5 w-5 text-blue-500" />
                  <p className="text-sm font-semibold">eBay Listing Details</p>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">These fields produce the eBay-specific listing payload. Fields marked with * are required for readiness.</p>

                {/* Category / Condition / Format */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="eb-cat" className="text-xs">Category ID *</Label>
                    <Input id="eb-cat" placeholder="e.g. 15687" value={form.ebay_categoryId} onChange={(e) => setF({ ebay_categoryId: e.target.value })} data-testid="input-ebay-category-id" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eb-cond" className="text-xs">Condition ID *</Label>
                    <Select value={form.ebay_conditionId || "_none"} onValueChange={(v) => setF({ ebay_conditionId: v === "_none" ? "" : v })}>
                      <SelectTrigger id="eb-cond" data-testid="select-ebay-condition-id"><SelectValue placeholder="Select condition" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— None —</SelectItem>
                        <SelectItem value="1000">1000 — New</SelectItem>
                        <SelectItem value="1500">1500 — New Other</SelectItem>
                        <SelectItem value="2000">2000 — Certified Refurbished</SelectItem>
                        <SelectItem value="2500">2500 — Excellent Refurbished</SelectItem>
                        <SelectItem value="3000">3000 — Very Good Refurbished</SelectItem>
                        <SelectItem value="4000">4000 — Good Refurbished</SelectItem>
                        <SelectItem value="7000">7000 — Used</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="eb-format" className="text-xs">Listing Format *</Label>
                    <Select value={form.ebay_listingFormat} onValueChange={(v) => setF({ ebay_listingFormat: v as "FIXED_PRICE" | "AUCTION" })}>
                      <SelectTrigger id="eb-format" data-testid="select-ebay-listing-format"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED_PRICE">Fixed Price</SelectItem>
                        <SelectItem value="AUCTION">Auction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eb-subtitle" className="text-xs">eBay Subtitle (≤55 chars)</Label>
                    <Input id="eb-subtitle" placeholder="Optional secondary line" maxLength={55} value={form.ebay_subtitle} onChange={(e) => setF({ ebay_subtitle: e.target.value })} data-testid="input-ebay-subtitle" />
                  </div>
                </div>

                {/* Item Specifics */}
                <div className="space-y-1">
                  <Label htmlFor="eb-specifics" className="text-xs">Item Specifics * (Key: Value, one per line)</Label>
                  <p className="text-xs text-muted-foreground">
                    Brand, Material, and Department from Common fields are merged in automatically. Add extra specifics here, e.g. <em>Color: Black</em>
                  </p>
                  <Textarea
                    id="eb-specifics"
                    placeholder={"Color: Black\nSize Type: Regular\nStyle: Casual"}
                    value={form.ebay_itemSpecifics}
                    onChange={(e) => setF({ ebay_itemSpecifics: e.target.value })}
                    data-testid="input-ebay-item-specifics"
                    rows={4}
                  />
                </div>

                {/* Best Offer */}
                <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="toggle-ebay-best-offer">
                  <input type="checkbox" className="rounded" checked={form.ebay_bestOfferEnabled} onChange={(e) => setF({ ebay_bestOfferEnabled: e.target.checked })} />
                  Enable Best Offer
                </label>

                {/* Business Policies */}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Policy IDs</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="eb-ship" className="text-xs">Shipping Policy ID</Label>
                    <Input id="eb-ship" placeholder="Policy ID" value={form.ebay_shippingPolicyId} onChange={(e) => setF({ ebay_shippingPolicyId: e.target.value })} data-testid="input-ebay-shipping-policy" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eb-ret" className="text-xs">Returns Policy ID</Label>
                    <Input id="eb-ret" placeholder="Policy ID" value={form.ebay_returnsPolicyId} onChange={(e) => setF({ ebay_returnsPolicyId: e.target.value })} data-testid="input-ebay-returns-policy" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eb-pay" className="text-xs">Payment Policy ID</Label>
                    <Input id="eb-pay" placeholder="Policy ID" value={form.ebay_paymentPolicyId} onChange={(e) => setF({ ebay_paymentPolicyId: e.target.value })} data-testid="input-ebay-payment-policy" />
                  </div>
                </div>

                {/* Handling + Package */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="eb-handling" className="text-xs">Handling Time (days)</Label>
                    <Input id="eb-handling" type="number" min="0" max="30" placeholder="e.g. 3" value={form.ebay_handlingTime} onChange={(e) => setF({ ebay_handlingTime: e.target.value })} data-testid="input-ebay-handling-time" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eb-weight" className="text-xs">Package Weight (lbs)</Label>
                    <Input id="eb-weight" type="number" min="0" step="0.1" placeholder="e.g. 0.5" value={form.ebay_packageWeightLbs} onChange={(e) => setF({ ebay_packageWeightLbs: e.target.value })} data-testid="input-ebay-package-weight" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Package Dimensions (inches: L × W × H)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="number" min="0" step="0.1" placeholder="Length" value={form.ebay_dimLength} onChange={(e) => setF({ ebay_dimLength: e.target.value })} data-testid="input-ebay-dim-length" />
                    <Input type="number" min="0" step="0.1" placeholder="Width" value={form.ebay_dimWidth} onChange={(e) => setF({ ebay_dimWidth: e.target.value })} data-testid="input-ebay-dim-width" />
                    <Input type="number" min="0" step="0.1" placeholder="Height" value={form.ebay_dimHeight} onChange={(e) => setF({ ebay_dimHeight: e.target.value })} data-testid="input-ebay-dim-height" />
                  </div>
                </div>

                {/* Identifiers */}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Product Identifiers</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="eb-upc" className="text-xs">UPC</Label>
                    <Input id="eb-upc" placeholder="Optional" value={form.ebay_upc} onChange={(e) => setF({ ebay_upc: e.target.value })} data-testid="input-ebay-upc" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eb-ean" className="text-xs">EAN</Label>
                    <Input id="eb-ean" placeholder="Optional" value={form.ebay_ean} onChange={(e) => setF({ ebay_ean: e.target.value })} data-testid="input-ebay-ean" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eb-mpn" className="text-xs">MPN</Label>
                    <Input id="eb-mpn" placeholder="Optional" value={form.ebay_mpn} onChange={(e) => setF({ ebay_mpn: e.target.value })} data-testid="input-ebay-mpn" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="eb-brand-ovr" className="text-xs">Brand Override (eBay only, overrides Common brand)</Label>
                  <Input id="eb-brand-ovr" placeholder="Leave blank to use Common brand" value={form.ebay_brand} onChange={(e) => setF({ ebay_brand: e.target.value })} data-testid="input-ebay-brand-override" />
                </div>

                {/* eBay overrides */}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">eBay Overrides</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="eb-price-ovr" className="text-xs">Price Override (USD)</Label>
                    <Input id="eb-price-ovr" type="number" min="0" step="0.01" placeholder="Leave blank to use Retail Price" value={form.ebay_priceOverride} onChange={(e) => setF({ ebay_priceOverride: e.target.value })} data-testid="input-ebay-price-override" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eb-qty" className="text-xs">Quantity Override</Label>
                    <Input id="eb-qty" type="number" min="0" step="1" placeholder="Leave blank to use 999" value={form.ebay_quantity} onChange={(e) => setF({ ebay_quantity: e.target.value })} data-testid="input-ebay-quantity-override" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-surface">Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-surface">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Save Changes" : "Create Surface"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ LISTINGS SECTION ============

export interface ListingData {
  id: string;
  surfaceId: string;
  accountId: string;
  platform: MarketplacePlatform;
  externalListingId?: string;
  externalUrl?: string;
  status: string;
  title: string;
  price: number;
  lastSyncAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

