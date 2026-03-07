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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Trash2,
  ShoppingBag,
  Settings,
  RefreshCw,
  Loader2,
  ExternalLink,
  Upload,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import { SiEtsy, SiEbay, SiAmazon } from "react-icons/si";

type MarketplacePlatform = "etsy" | "ebay" | "amazon";

interface MarketplaceConfig {
  platform: MarketplacePlatform;
  shopName: string;
  shopId: string;
  feePercent: number;
  syncEnabled: boolean;
  apiKeyConfigured: boolean;
  lastSyncAt: string | null;
}

interface MarketplaceStore {
  id: string;
  name: string;
  roleType: string;
  isActive: boolean;
  channelCount: number;
  marketplaceConfig?: MarketplaceConfig;
}

interface MarketplaceListing {
  id: string;
  storeId: string;
  productId: string;
  title: string;
  marketplaceListingId: string | null;
  status: "pending" | "draft" | "listed" | "syncing" | "error" | "delisted";
  listingUrl: string | null;
  price: number | null;
  sku: string | null;
  platform: string;
  lastSyncAt: string | null;
  errorMessage: string | null;
  mockupUrl: string | null;
}

const PLATFORM_INFO: Record<MarketplacePlatform, { name: string; icon: typeof SiEtsy; color: string }> = {
  etsy: { name: "Etsy", icon: SiEtsy, color: "text-orange-500" },
  ebay: { name: "eBay", icon: SiEbay, color: "text-blue-500" },
  amazon: { name: "Amazon", icon: SiAmazon, color: "text-yellow-500" },
};

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  draft: { label: "Draft", variant: "secondary" },
  listed: { label: "Listed", variant: "default" },
  syncing: { label: "Syncing", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
  delisted: { label: "Delisted", variant: "secondary" },
};

export default function AdminMarketplaces() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingStore, setEditingStore] = useState<MarketplaceStore | null>(null);

  const [newStoreName, setNewStoreName] = useState("");
  const [newPlatform, setNewPlatform] = useState<MarketplacePlatform>("etsy");

  const [configForm, setConfigForm] = useState({
    shopName: "",
    shopId: "",
    feePercent: "0",
    syncEnabled: false,
  });

  const { data: stores = [], isLoading } = useQuery<MarketplaceStore[]>({
    queryKey: ["/api/admin/marketplace/stores"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; platform: MarketplacePlatform }) => {
      const res = await apiRequest("POST", "/api/admin/stores", {
        name: data.name,
        roleType: "marketplace",
        platform: data.platform,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/stores"] });
      setShowAddDialog(false);
      setNewStoreName("");
      setNewPlatform("etsy");
      toast({ title: "Marketplace store created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ storeId, config }: { storeId: string; config: Partial<MarketplaceConfig> }) => {
      const res = await apiRequest("PUT", `/api/admin/marketplace/stores/${storeId}/config`, config);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/stores"] });
      setShowConfigDialog(false);
      setEditingStore(null);
      toast({ title: "Marketplace config updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/stores/${storeId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/stores"] });
      toast({ title: "Marketplace store deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ storeId, isActive }: { storeId: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/stores/${storeId}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/stores"] });
    },
  });

  const openConfigDialog = (store: MarketplaceStore) => {
    setEditingStore(store);
    setConfigForm({
      shopName: store.marketplaceConfig?.shopName || "",
      shopId: store.marketplaceConfig?.shopId || "",
      feePercent: String(store.marketplaceConfig?.feePercent || 0),
      syncEnabled: store.marketplaceConfig?.syncEnabled || false,
    });
    setShowConfigDialog(true);
  };

  const handleSaveConfig = () => {
    if (!editingStore) return;
    updateConfigMutation.mutate({
      storeId: editingStore.id,
      config: {
        shopName: configForm.shopName,
        shopId: configForm.shopId,
        feePercent: parseFloat(configForm.feePercent) || 0,
        syncEnabled: configForm.syncEnabled,
      },
    });
  };

  const handleCreateStore = () => {
    if (!newStoreName.trim()) {
      toast({ title: "Store name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({ name: newStoreName.trim(), platform: newPlatform });
  };

  const addButton = (
    <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-marketplace">
      <Plus className="h-4 w-4 mr-2" />
      Add Marketplace
    </Button>
  );

  return (
    <AdminShell
      title="Marketplaces"
      subtitle="Sell on Etsy, eBay, Amazon and more"
      icon={ShoppingBag}
      actions={addButton}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center">
              <h3 className="text-lg font-semibold" data-testid="text-empty-title">No Marketplaces Connected</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your Etsy, eBay, or Amazon shop to start listing products.
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first-marketplace">
              <Plus className="h-4 w-4 mr-2" />
              Connect Your First Marketplace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {stores.map((store) => {
            const config = store.marketplaceConfig;
            const platform = config?.platform || "etsy";
            const platformInfo = PLATFORM_INFO[platform];
            const PlatformIcon = platformInfo?.icon;
            const isExpanded = expandedStore === store.id;

            return (
              <Card key={store.id} data-testid={`card-marketplace-${store.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {PlatformIcon && (
                      <div className={`flex-shrink-0 ${platformInfo.color}`}>
                        <PlatformIcon className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate" data-testid={`text-store-name-${store.id}`}>
                        {store.name}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {platformInfo?.name || platform}
                        </Badge>
                        {config?.apiKeyConfigured ? (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            API Connected
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            API Not Configured
                          </Badge>
                        )}
                        {config?.shopName && (
                          <span className="text-xs text-muted-foreground">
                            Shop: {config.shopName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={store.isActive}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ storeId: store.id, isActive: checked })
                      }
                      data-testid={`switch-active-${store.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openConfigDialog(store)}
                      data-testid={`button-config-${store.id}`}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete marketplace "${store.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(store.id);
                        }
                      }}
                      data-testid={`button-delete-${store.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedStore(isExpanded ? null : store.id)}
                      data-testid={`button-expand-${store.id}`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <MarketplaceListings storeId={store.id} platform={platform} />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Marketplace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name</Label>
              <Input
                id="store-name"
                placeholder="e.g. My Etsy Shop"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                data-testid="input-store-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(PLATFORM_INFO) as [MarketplacePlatform, typeof PLATFORM_INFO["etsy"]][]).map(
                  ([key, info]) => {
                    const Icon = info.icon;
                    return (
                      <Button
                        key={key}
                        variant={newPlatform === key ? "default" : "outline"}
                        className="flex flex-col items-center gap-2 h-auto py-4"
                        onClick={() => setNewPlatform(key)}
                        data-testid={`button-platform-${key}`}
                      >
                        <Icon className={`h-6 w-6 ${newPlatform !== key ? info.color : ""}`} />
                        <span className="text-sm">{info.name}</span>
                      </Button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button
              onClick={handleCreateStore}
              disabled={createMutation.isPending}
              data-testid="button-confirm-add"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Marketplace Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Configure {editingStore?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop Name / ID</Label>
              <Input
                id="shop-name"
                placeholder="Your shop name on the marketplace"
                value={configForm.shopName}
                onChange={(e) => setConfigForm({ ...configForm, shopName: e.target.value })}
                data-testid="input-shop-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-id">Shop / Seller ID</Label>
              <Input
                id="shop-id"
                placeholder="Marketplace-assigned shop or seller ID"
                value={configForm.shopId}
                onChange={(e) => setConfigForm({ ...configForm, shopId: e.target.value })}
                data-testid="input-shop-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee-percent">Marketplace Fee %</Label>
              <Input
                id="fee-percent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 6.5 for Etsy"
                value={configForm.feePercent}
                onChange={(e) => setConfigForm({ ...configForm, feePercent: e.target.value })}
                data-testid="input-fee-percent"
              />
              <p className="text-xs text-muted-foreground">
                Used to calculate listing price to maintain your target margin
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Auto-Sync Inventory</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically sync product availability with marketplace
                </p>
              </div>
              <Switch
                checked={configForm.syncEnabled}
                onCheckedChange={(checked) => setConfigForm({ ...configForm, syncEnabled: checked })}
                data-testid="switch-sync-enabled"
              />
            </div>
            <Card className="bg-muted/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">
                    API keys are managed in Settings. Once configured, the API status will update automatically.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)} data-testid="button-cancel-config">
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={updateConfigMutation.isPending}
              data-testid="button-save-config"
            >
              {updateConfigMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function MarketplaceListings({ storeId, platform }: { storeId: string; platform: MarketplacePlatform }) {
  const { toast } = useToast();

  const { data: listings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: [`/api/admin/marketplace/stores/${storeId}/listings`],
  });

  const pushMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const res = await apiRequest("POST", `/api/admin/marketplace/stores/${storeId}/listings/${listingId}/push`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/marketplace/stores/${storeId}/listings`] });
      toast({ title: data.message || "Listing pushed" });
    },
    onError: (error: Error) => {
      toast({ title: "Push failed", description: error.message, variant: "destructive" });
    },
  });

  const platformInfo = PLATFORM_INFO[platform];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center border-t">
        <Package className="h-10 w-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium">No products assigned</p>
          <p className="text-xs text-muted-foreground mt-1">
            Assign products to this marketplace from the Store Builder, then push them as listings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h4 className="text-sm font-medium">
          Product Listings ({listings.length})
        </h4>
        <Button variant="outline" size="sm" data-testid="button-refresh-listings">
          <RefreshCw className="h-3 w-3 mr-1" />
          Sync All
        </Button>
      </div>
      <div className="space-y-2">
        {listings.map((listing) => {
          const statusInfo = STATUS_BADGES[listing.status] || STATUS_BADGES.draft;
          return (
            <div
              key={listing.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card"
              data-testid={`listing-${listing.id}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {listing.mockupUrl ? (
                  <img
                    src={listing.mockupUrl}
                    alt={listing.title || listing.productId}
                    className="h-10 w-10 rounded object-cover flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" data-testid={`text-listing-name-${listing.id}`}>
                    {listing.title || listing.productId}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <Badge variant={statusInfo.variant} className="text-xs">
                      {statusInfo.label}
                    </Badge>
                    {listing.price != null && listing.price > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ${listing.price.toFixed(2)}
                      </span>
                    )}
                    {listing.marketplaceListingId && (
                      <span className="text-xs text-muted-foreground font-mono">
                        #{listing.marketplaceListingId}
                      </span>
                    )}
                  </div>
                  {listing.errorMessage && (
                    <p className="text-xs text-destructive mt-1">{listing.errorMessage}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {listing.listingUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    data-testid={`button-view-listing-${listing.id}`}
                  >
                    <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pushMutation.mutate(listing.id)}
                  disabled={pushMutation.isPending}
                  data-testid={`button-push-${listing.id}`}
                >
                  {pushMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3 mr-1" />
                  )}
                  Push to {platformInfo?.name || "Marketplace"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
