import { useState } from "react";
import AdminShell from "@/components/AdminShell";
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
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import {
  Plus,
  Trash2,
  ShoppingBag,
  Settings,
  RefreshCw,
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Package,
  Layers,
  Link2,
  ListChecks,
  ScrollText,
  Pencil,
  Play,
  Clock,
  XCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { SiEtsy, SiEbay, SiAmazon } from "react-icons/si";

type MarketplacePlatform = "etsy" | "ebay" | "amazon";

const PLATFORM_INFO: Record<MarketplacePlatform, { name: string; icon: typeof SiEtsy; color: string }> = {
  etsy: { name: "Etsy", icon: SiEtsy, color: "text-orange-500" },
  ebay: { name: "eBay", icon: SiEbay, color: "text-blue-500" },
  amazon: { name: "Amazon", icon: SiAmazon, color: "text-yellow-500" },
};

const SECTION_TABS: AdminTab[] = [
  { id: "accounts", label: "Accounts", icon: Settings },
  { id: "surfaces", label: "Surfaces", icon: Layers },
  { id: "listings", label: "Listings", icon: Link2 },
  { id: "jobs", label: "Jobs", icon: ListChecks },
  { id: "logs", label: "Logs", icon: ScrollText },
];

export default function AdminMarketplaces() {
  const [activeTab, setActiveTab] = useState("accounts");

  return (
    <AdminShell
      title="Publishing"
      subtitle="Multi-channel marketplace management"
      icon={ShoppingBag}
      tabs={SECTION_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "accounts" && <AccountsSection />}
      {activeTab === "surfaces" && <SurfacesSection />}
      {activeTab === "listings" && <ListingsSection />}
      {activeTab === "jobs" && <JobsSection />}
      {activeTab === "logs" && <LogsSection />}
    </AdminShell>
  );
}

// ============ ACCOUNTS SECTION ============

interface MarketplaceAccount {
  id: string;
  platform: MarketplacePlatform;
  accountName: string;
  shopId: string;
  shopName: string;
  isActive: boolean;
  feePercent: number;
  apiKeyConfigured: boolean;
  healthStatus?: "healthy" | "unhealthy" | "unknown";
  healthError?: string;
  createdAt: string;
  updatedAt: string;
}

function AccountsSection() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    platform: "etsy" as MarketplacePlatform,
    accountName: "",
    shopId: "",
    shopName: "",
    feePercent: "0",
  });

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
                        {acct.feePercent > 0 && (
                          <span className="text-xs text-muted-foreground">{acct.feePercent}% fee</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
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

interface SurfaceData {
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
  status: string;
  readinessErrors: string[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

function SurfacesSection() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    masterProductId: "",
    title: "",
    subtitle: "",
    description: "",
    bulletPoints: "",
    tags: "",
    keywords: "",
    retailPrice: "",
    compareAtPrice: "",
    sku: "",
    storeId: "",
    channelId: "",
    collectionId: "",
    supportsEmbedStore: false,
    supportsEmbedProduct: false,
    supportsEmbedBuilder: false,
    enabledPlatforms: [] as MarketplacePlatform[],
  });
  const defaultForm = {
    masterProductId: "", title: "", subtitle: "", description: "", bulletPoints: "", tags: "", keywords: "",
    retailPrice: "", compareAtPrice: "", sku: "", storeId: "", channelId: "", collectionId: "",
    supportsEmbedStore: false, supportsEmbedProduct: false, supportsEmbedBuilder: false,
    enabledPlatforms: [] as MarketplacePlatform[],
  };

  const { data: surfaces = [], isLoading } = useQuery<SurfaceData[]>({
    queryKey: ["/api/admin/surfaces"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/admin/surfaces", {
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
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces"] });
      setShowAdd(false);
      setForm(defaultForm);
      toast({ title: "Surface created" });
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
        toast({ title: "Surface not ready", description: data.errors.join(", "), variant: "destructive" });
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

  const togglePlatform = (p: MarketplacePlatform) => {
    setForm((f) => ({
      ...f,
      enabledPlatforms: f.enabledPlatforms.includes(p)
        ? f.enabledPlatforms.filter((x) => x !== p)
        : [...f.enabledPlatforms, p],
    }));
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ready": return <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>;
      case "published": return <Badge variant="default" className="text-xs"><ExternalLink className="h-3 w-3 mr-1" />Published</Badge>;
      case "archived": return <Badge variant="secondary" className="text-xs">Archived</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Draft</Badge>;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-surfaces-title">Surfaces</h2>
          <p className="text-sm text-muted-foreground">Marketplace-ready product configurations</p>
        </div>
        <Button onClick={() => setShowAdd(true)} data-testid="button-add-surface">
          <Plus className="h-4 w-4 mr-2" />
          Create Surface
        </Button>
      </div>

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
                      {surface.storeId && <span className="text-xs text-muted-foreground">Store: {surface.storeId.slice(0, 8)}</span>}
                      {surface.channelId && <span className="text-xs text-muted-foreground">Ch: {surface.channelId.slice(0, 8)}</span>}
                    </div>
                    {surface.readinessErrors?.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {surface.readinessErrors.map((e, i) => (
                          <p key={i} className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />{e}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkReadinessMutation.mutate(surface.id)}
                      disabled={checkReadinessMutation.isPending}
                      data-testid={`button-check-readiness-${surface.id}`}
                    >
                      {checkReadinessMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Check
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { if (confirm(`Delete surface "${surface.title || surface.id}"?`)) deleteMutation.mutate(surface.id); }}
                      data-testid={`button-delete-surface-${surface.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Surface</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="s-mpid">Master Product ID</Label>
              <Input id="s-mpid" placeholder="Firestore product ID" value={form.masterProductId} onChange={(e) => setForm({ ...form, masterProductId: e.target.value })} data-testid="input-surface-product-id" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-title">Listing Title</Label>
              <Input id="s-title" placeholder="Marketplace listing title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-surface-title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-subtitle">Subtitle</Label>
              <Input id="s-subtitle" placeholder="Optional subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} data-testid="input-surface-subtitle" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-desc">Description</Label>
              <Textarea id="s-desc" placeholder="Product description for the marketplace" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-surface-description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-bullets">Bullet Points (one per line)</Label>
              <Textarea id="s-bullets" placeholder="Key feature 1&#10;Key feature 2" value={form.bulletPoints} onChange={(e) => setForm({ ...form, bulletPoints: e.target.value })} data-testid="input-surface-bullets" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="s-price">Retail Price</Label>
                <Input id="s-price" type="number" min="0" step="0.01" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} data-testid="input-surface-price" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-compare">Compare At Price</Label>
                <Input id="s-compare" type="number" min="0" step="0.01" placeholder="Optional" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} data-testid="input-surface-compare-price" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-sku">SKU</Label>
              <Input id="s-sku" placeholder="e.g. QG-TSHIRT-001" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} data-testid="input-surface-sku" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-tags">Tags (comma-separated)</Label>
              <Input id="s-tags" placeholder="qr code, custom, apparel" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} data-testid="input-surface-tags" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-keywords">Keywords (comma-separated)</Label>
              <Input id="s-keywords" placeholder="qr, custom, personalized" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} data-testid="input-surface-keywords" />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Linked Resources</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="s-store" className="text-xs">Store ID</Label>
                  <Input id="s-store" placeholder="Optional" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} data-testid="input-surface-store-id" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-channel" className="text-xs">Channel ID</Label>
                  <Input id="s-channel" placeholder="Optional" value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} data-testid="input-surface-channel-id" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-collection" className="text-xs">Collection ID</Label>
                  <Input id="s-collection" placeholder="Optional" value={form.collectionId} onChange={(e) => setForm({ ...form, collectionId: e.target.value })} data-testid="input-surface-collection-id" />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Embed Support</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="toggle-embed-store">
                  <input type="checkbox" className="rounded" checked={form.supportsEmbedStore} onChange={(e) => setForm({ ...form, supportsEmbedStore: e.target.checked })} />
                  Mini Store
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="toggle-embed-product">
                  <input type="checkbox" className="rounded" checked={form.supportsEmbedProduct} onChange={(e) => setForm({ ...form, supportsEmbedProduct: e.target.checked })} />
                  Mini Product
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="toggle-embed-builder">
                  <input type="checkbox" className="rounded" checked={form.supportsEmbedBuilder} onChange={(e) => setForm({ ...form, supportsEmbedBuilder: e.target.checked })} />
                  Mini Builder
                </label>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Target Platforms</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(PLATFORM_INFO) as [MarketplacePlatform, typeof PLATFORM_INFO["etsy"]][]).map(([key, info]) => {
                  const Icon = info.icon;
                  const selected = form.enabledPlatforms.includes(key);
                  return (
                    <Button
                      key={key}
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePlatform(key)}
                      className="gap-1.5"
                      data-testid={`button-toggle-platform-${key}`}
                    >
                      <Icon className={`h-4 w-4 ${!selected ? info.color : ""}`} />
                      {info.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} data-testid="button-cancel-surface">Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-save-surface">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Surface
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ LISTINGS SECTION ============

interface ListingData {
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

function ListingsSection() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ surfaceId: "", accountId: "" });

  const { data: listings = [], isLoading } = useQuery<ListingData[]>({
    queryKey: ["/api/admin/surfaces/listings"],
  });

  const { data: surfaces = [] } = useQuery<SurfaceData[]>({
    queryKey: ["/api/admin/surfaces"],
  });

  const { data: accounts = [] } = useQuery<MarketplaceAccount[]>({
    queryKey: ["/api/admin/surfaces/accounts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { surfaceId: string; accountId: string }) => {
      const res = await apiRequest("POST", "/api/admin/surfaces/listings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/listings"] });
      setShowAdd(false);
      setAddForm({ surfaceId: "", accountId: "" });
      toast({ title: "Listing created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const res = await apiRequest("POST", "/api/admin/surfaces/jobs", { listingId, action: "create" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/jobs"] });
      toast({ title: "Publish job queued" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/surfaces/listings/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/listings"] });
      toast({ title: "Listing removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const listingStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "syncing": return <Badge variant="outline" className="text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Syncing</Badge>;
      case "error": return <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case "paused": return <Badge variant="secondary" className="text-xs">Paused</Badge>;
      case "delisted": return <Badge variant="secondary" className="text-xs">Delisted</Badge>;
      case "draft": return <Badge variant="secondary" className="text-xs">Draft</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Pending</Badge>;
    }
  };

  const getSurfaceTitle = (id: string) => surfaces.find((s) => s.id === id)?.title || id;
  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.accountName || id;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-listings-title">Marketplace Listings</h2>
          <p className="text-sm text-muted-foreground">Surface-to-account connections</p>
        </div>
        <Button onClick={() => setShowAdd(true)} data-testid="button-add-listing" disabled={surfaces.length === 0 || accounts.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Create Listing
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Link2 className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center">
              <h3 className="text-lg font-semibold" data-testid="text-empty-listings">No Listings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {surfaces.length === 0
                  ? "Create a surface first, then connect it to an account."
                  : accounts.length === 0
                  ? "Add a marketplace account first, then create a listing."
                  : "Link a surface to a marketplace account to create a listing."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const info = PLATFORM_INFO[listing.platform];
            const PIcon = info?.icon;
            return (
              <Card key={listing.id} data-testid={`card-listing-${listing.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {PIcon && <PIcon className={`h-4 w-4 flex-shrink-0 ${info.color}`} />}
                        <p className="font-medium truncate" data-testid={`text-listing-title-${listing.id}`}>
                          {listing.title || getSurfaceTitle(listing.surfaceId)}
                        </p>
                        {listingStatusBadge(listing.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span>Surface: {getSurfaceTitle(listing.surfaceId)}</span>
                        <span>Account: {getAccountName(listing.accountId)}</span>
                        {listing.price > 0 && <span>${listing.price.toFixed(2)}</span>}
                        {listing.externalListingId && <span className="font-mono">#{listing.externalListingId}</span>}
                      </div>
                      {listing.errorMessage && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />{listing.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {listing.externalUrl && (
                        <Button variant="ghost" size="icon" asChild data-testid={`button-view-external-${listing.id}`}>
                          <a href={listing.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      )}
                      {listing.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => publishMutation.mutate(listing.id)}
                          disabled={publishMutation.isPending}
                          data-testid={`button-publish-${listing.id}`}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Publish
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { if (confirm("Remove this listing?")) deleteMutation.mutate(listing.id); }}
                        data-testid={`button-delete-listing-${listing.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Listing</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Surface</Label>
              <Select value={addForm.surfaceId} onValueChange={(v) => setAddForm({ ...addForm, surfaceId: v })}>
                <SelectTrigger data-testid="select-listing-surface"><SelectValue placeholder="Select a surface" /></SelectTrigger>
                <SelectContent>
                  {surfaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title || s.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={addForm.accountId} onValueChange={(v) => setAddForm({ ...addForm, accountId: v })}>
                <SelectTrigger data-testid="select-listing-account"><SelectValue placeholder="Select an account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => {
                    const info = PLATFORM_INFO[a.platform];
                    return <SelectItem key={a.id} value={a.id}>{info?.name} - {a.accountName}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} data-testid="button-cancel-listing">Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(addForm)}
              disabled={createMutation.isPending || !addForm.surfaceId || !addForm.accountId}
              data-testid="button-save-listing"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ JOBS SECTION ============

interface SyncJobData {
  id: string;
  listingId: string;
  surfaceId: string;
  accountId: string;
  platform: MarketplacePlatform;
  action: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

function JobsSection() {
  const { data: jobs = [], isLoading } = useQuery<SyncJobData[]>({
    queryKey: ["/api/admin/surfaces/jobs"],
  });

  const jobStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "running": return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "cancelled": return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const jobStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="default" className="text-xs">Completed</Badge>;
      case "failed": return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case "running": return <Badge variant="outline" className="text-xs">Running</Badge>;
      case "cancelled": return <Badge variant="secondary" className="text-xs">Cancelled</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Queued</Badge>;
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-jobs-title">Sync Jobs</h2>
        <p className="text-sm text-muted-foreground">Publishing pipeline execution history</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <ListChecks className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center">
              <h3 className="text-lg font-semibold" data-testid="text-empty-jobs">No Jobs</h3>
              <p className="text-sm text-muted-foreground mt-1">Jobs appear here when listings are published or synced.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const info = PLATFORM_INFO[job.platform];
            const PIcon = info?.icon;
            return (
              <Card key={job.id} data-testid={`card-job-${job.id}`}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {jobStatusIcon(job.status)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {PIcon && <PIcon className={`h-3.5 w-3.5 ${info.color}`} />}
                          <span className="text-sm font-medium capitalize">{job.action.replace("_", " ")}</span>
                          {jobStatusBadge(job.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>{formatDate(job.createdAt)}</span>
                          <span>Attempts: {job.attempts}/{job.maxAttempts}</span>
                        </div>
                        {job.errorMessage && (
                          <p className="text-xs text-destructive mt-1">{job.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ LOGS SECTION ============

interface SyncLogData {
  id: string;
  jobId: string;
  listingId: string;
  accountId: string;
  platform: MarketplacePlatform;
  level: string;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

function LogsSection() {
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery<SyncLogData[]>({
    queryKey: ["/api/admin/surfaces/logs", levelFilter !== "all" ? levelFilter : undefined].filter(Boolean),
    queryFn: async () => {
      const params = levelFilter !== "all" ? `?level=${levelFilter}` : "";
      const res = await fetch(`/api/admin/surfaces/logs${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const levelIcon = (level: string) => {
    switch (level) {
      case "error": return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />;
      case "warn": return <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
      default: return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-logs-title">Sync Logs</h2>
          <p className="text-sm text-muted-foreground">Detailed log entries from sync operations</p>
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-32" data-testid="select-log-level"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <ScrollText className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center">
              <h3 className="text-lg font-semibold" data-testid="text-empty-logs">No Logs</h3>
              <p className="text-sm text-muted-foreground mt-1">Log entries appear when sync jobs execute.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 rounded-md border bg-card text-sm"
              data-testid={`log-entry-${log.id}`}
            >
              {levelIcon(log.level)}
              <div className="min-w-0 flex-1">
                <p className="break-words">{log.message}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{formatDate(log.createdAt)}</span>
                  {log.platform && (
                    <Badge variant="outline" className="text-xs">{PLATFORM_INFO[log.platform]?.name || log.platform}</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
