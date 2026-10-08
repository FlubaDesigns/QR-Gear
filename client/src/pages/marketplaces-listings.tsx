import { EtsySetupDialog } from "./marketplaces-etsy";
import { AmazonSetupDialog } from "./marketplaces-amazon";
import { EbaySetupDialog } from "./marketplaces-ebay";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Settings, RefreshCw, Loader2, ExternalLink, CheckCircle, AlertCircle, Link2, ListChecks, ScrollText, Play, Clock, XCircle, Info, AlertTriangle, RotateCcw } from "lucide-react";
import { SiEtsy, SiEbay, SiAmazon } from "react-icons/si";
import { GenerateFromProductDialog, MarketplaceItemSetup } from "./marketplaces-accounts";
import type { MarketplaceAccount, SurfaceData, ListingData, MarketplacePlatform } from "./marketplaces-accounts";

const PLATFORM_INFO: Record<MarketplacePlatform, { name: string; icon: typeof SiEtsy; color: string }> = {
  etsy: { name: "Etsy", icon: SiEtsy, color: "text-orange-500" },
  ebay: { name: "eBay", icon: SiEbay, color: "text-blue-500" },
  amazon: { name: "Amazon", icon: SiAmazon, color: "text-yellow-500" },
};

export function ListingsSection({ onOpenAccounts }: { onOpenAccounts?: () => void } = {}) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [setupId, setSetupId] = useState<string | null>(null);
  const [continueToAccount, setContinueToAccount] = useState(false);
  const [amazonListing, setAmazonListing] = useState<ListingData | null>(null);
  const [ebayListing, setEbayListing] = useState<ListingData | null>(null);
  const [etsyListing, setEtsyListing] = useState<ListingData | null>(null);

  const [addForm, setAddForm] = useState({ surfaceId: "", accountId: "" });

  const { data: listings = [], isLoading, error: listingsError, refetch: reloadListings } = useQuery<ListingData[]>({
    queryKey: ["/api/admin/surfaces/listings"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((l: ListingData) => l.status === "syncing")) return 3000;
      return false;
    },
  });

  const { data: surfaces = [], isLoading: surfacesLoading, error: surfacesError, refetch: reloadSurfaces } = useQuery<SurfaceData[]>({
    queryKey: ["/api/admin/surfaces"],
  });

  const { data: accounts = [], error: accountsError, refetch: reloadAccounts } = useQuery<MarketplaceAccount[]>({
    queryKey: ["/api/admin/surfaces/accounts"],
  });

  const { data: setupSurface, isLoading: setupLoading, error: setupError, refetch: reloadSetup } = useQuery<SurfaceData>({
    queryKey: [`/api/admin/surfaces/${setupId}`],
    enabled: !!setupId,
    staleTime: 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/surfaces/${setupId}`);
      return res.json();
    },
  });
  const openSetup = (surfaceId: string) => { setContinueToAccount(false); setSetupId(surfaceId); };
  const chooseAccount = (surfaceId = "") => { setAddForm({ surfaceId, accountId: "" }); setShowAdd(true); };
  const selectedSurface = surfaces.find(surface => surface.id === addForm.surfaceId);
  const availableAccounts = accounts.filter(account => account.isActive && selectedSurface?.enabledPlatforms?.includes(account.platform));
  const unlistedItems = surfaces.filter(surface => !listings.some(listing => listing.surfaceId === surface.id));

  const checkMutation = useMutation({
    mutationFn: async (surfaceId: string) => (await apiRequest("POST", `/api/admin/surfaces/${surfaceId}/check-readiness`, {})).json(),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces"] });
      toast({ title: data.ready ? "Item checks passed" : "Item needs setup", description: data.errors?.length ? data.errors.slice(0, 3).join(" • ") : data.note });
    },
    onError: (err: Error) => toast({ title: "Check failed", description: err.message, variant: "destructive" }),
  });
  const removeItemMutation = useMutation({
    mutationFn: async (surfaceId: string) => (await apiRequest("DELETE", `/api/admin/surfaces/${surfaceId}`, {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces"] }),
    onError: (err: Error) => toast({ title: "Could not remove item", description: err.message, variant: "destructive" }),
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
    mutationFn: async ({ listingId, action }: { listingId: string; action: string }) => {
      const res = await apiRequest("POST", "/api/admin/surfaces/jobs", { listingId, action });
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/jobs"] });
      const label = variables.action === "create" ? "Publish" : variables.action === "update" ? "Sync" : variables.action === "delete" ? "End listing" : variables.action === "check_status" ? "Status check" : variables.action;
      toast({ title: data.success ? `${label}: ${data.listingStatus}` : `${label} failed`, description: data.error, variant: data.success ? "default" : "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/logs"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const publishListing = (listing: ListingData, action: string) => {
    if (listing.platform === "amazon" && !listing.publishOptions?.amazon) { setAmazonListing(listing); return; }
    if (listing.platform === "ebay" && !listing.publishOptions?.ebay) { setEbayListing(listing); return; }
    if (listing.platform === "etsy" && (!listing.publishOptions?.taxonomyId || !listing.publishOptions?.shippingProfileId || !listing.publishOptions?.readinessStateId)) {
      setEtsyListing(listing);
    } else publishMutation.mutate({ listingId: listing.id, action });
  };

  const feeMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const res = await apiRequest("POST", `/api/admin/surfaces/listings/${listingId}/fees`, {});
      return res.json();
    },
    onSuccess: () => toast({ title: "Item fees updated" }),
    onError: (err: Error) => toast({ title: "Fees unavailable", description: err.message, variant: "destructive" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/listings"] }),
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

  const getSurfaceTitle = (id: string) => surfaces.find((s) => s.id === id)?.title || id || "Unknown item";
  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.accountName || id || "Unknown account";

  const formatDate = (iso?: string) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-listings-title">Marketplace Listings</h2>
          <p className="text-sm text-muted-foreground">Your products, marketplace accounts and item fees</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-12" onClick={() => setShowGenerate(true)} data-testid="button-generate-surface"><Plus className="mr-2 h-4 w-4" />Add Product</Button>
          <Button className="min-h-12" variant="outline" onClick={() => chooseAccount()} data-testid="button-add-listing" disabled={surfaces.length === 0 || !!surfacesError}>Add Marketplace</Button>
        </div>
      </div>

      {surfacesError && <div role="alert"><p>Could not load item setup: {surfacesError.message}</p><Button className="min-h-12" onClick={() => reloadSurfaces()}>Retry</Button></div>}
      {accountsError && <div role="alert"><p>Could not load marketplace accounts: {accountsError.message}</p><Button className="min-h-12" onClick={() => reloadAccounts()}>Retry</Button></div>}
      {!isLoading && !listingsError && unlistedItems.length > 0 && <section className="space-y-3" aria-label="Products awaiting marketplace selection">
        <h3 className="font-semibold">Choose a marketplace account</h3>
        {unlistedItems.map(item => <Card key={item.id} data-testid={`card-unlisted-${item.id}`}><CardContent className="py-4 space-y-3">
          <div><p className="font-medium">{item.title || "Untitled item"}</p><p className="text-xs text-muted-foreground break-all">{item.sku}</p></div>
          {item.readinessErrors?.map((error, index) => <p key={index} className="text-sm text-destructive">{error}</p>)}
          <div className="flex flex-wrap gap-2 [&>button]:min-h-12">
            <Button variant="outline" onClick={() => openSetup(item.id)} data-testid={`button-setup-unlisted-${item.id}`}>Item Setup</Button>
            <Button onClick={() => chooseAccount(item.id)} data-testid={`button-place-${item.id}`}>Choose Account</Button>
            <Button variant="outline" onClick={() => checkMutation.mutate(item.id)} disabled={checkMutation.isPending}>Check</Button>
            <Button variant="ghost" aria-label={`Remove ${item.title || "item"}`} disabled={removeItemMutation.isPending} onClick={() => { if (window.confirm("Remove this unlisted item setup? The built product will remain.")) removeItemMutation.mutate(item.id); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>)}
      </section>}

      {isLoading || surfacesLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : listingsError ? (<div role="alert" className="space-y-2"><p>Could not load listings: {listingsError.message}</p><Button onClick={() => reloadListings()}>Retry</Button></div>) : listings.length === 0 ? (unlistedItems.length > 0 ? null : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Link2 className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center">
              <h3 className="text-lg font-semibold" data-testid="text-empty-listings">No Listings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {surfaces.length === 0
                  ? "Add a built product to get started."
                  : accounts.length === 0
                  ? "Add a marketplace account first, then create a listing."
                  : "Choose an item and marketplace account to create a listing."}
              </p>
            </div>
          </CardContent>
        </Card>
      )) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const info = PLATFORM_INFO[listing.platform];
            const PIcon = info?.icon;
            return (
              <Card key={listing.id} data-testid={`card-listing-${listing.id}`}>
                <CardContent className="py-4">
                  <div className="flex flex-col gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {PIcon && <PIcon className={`h-4 w-4 flex-shrink-0 ${info.color}`} />}
                        <p className="font-medium truncate" data-testid={`text-listing-title-${listing.id}`}>
                          {listing.title || getSurfaceTitle(listing.surfaceId)}
                        </p>
                        {listingStatusBadge(listing.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span>Item: {getSurfaceTitle(listing.surfaceId)}</span>
                        <span>Account: {getAccountName(listing.accountId)}</span>
                        {listing.remoteCheckedAt && <span>{PLATFORM_INFO[listing.platform]?.name || listing.platform} checked: {formatDate(listing.remoteCheckedAt)} · {listing.remoteStatus}</span>}
                        {listing.price > 0 && <span>{listing.currency || "USD"} {listing.price.toFixed(2)}</span>}
                        {listing.externalListingId && <span className="font-mono">#{listing.externalListingId}</span>}
                      </div>
                      <div className="mt-3 space-y-1 text-sm" data-testid={`listing-fees-${listing.id}`}>
                        <p>{listing.fees?.amount != null && ["estimated", "partial"].includes(listing.fees.status)
                          ? `${listing.fees.status === "partial" ? "Partial listing fees" : "Estimated fees per item"}: ${listing.fees.currency} ${listing.fees.amount.toFixed(2)}${listing.fees.status === "estimated" ? ` (${(listing.fees.amount / listing.fees.price * 100).toFixed(2)}% of item price)` : ""}`
                          : listing.fees?.status === "stale" ? "Fees need refreshing" : listing.fees?.variants?.length ? "Fees by variation" : "Fees unavailable"}</p>
                        {listing.amazonItems?.map(item => <p key={item.sku} className="text-xs break-all">{item.parent ? 'Parent' : [item.size, item.color].filter(Boolean).join(' / ') || `Variation ${item.variantKey || ''}`}: {item.status || 'Submitted — check status'}{item.asin ? ` · ${item.asin}` : ''}</p>)}
                        {listing.fees?.variants?.map(fee => <p key={fee.sku} className="text-xs break-all">{[listing.amazonItems?.find(item => item.sku === fee.sku)?.size, listing.amazonItems?.find(item => item.sku === fee.sku)?.color].filter(Boolean).join(' / ') || fee.sku.split(':').pop()}: {fee.status === 'estimated' && fee.amount != null ? `${fee.currency} ${fee.amount.toFixed(2)} (${(fee.amount / fee.price * 100).toFixed(2)}%) per sale` : fee.status === 'stale' ? 'Refresh fees' : fee.reason || 'Fees unavailable'}</p>)}
                        {listing.fees?.reason && <p className="text-xs text-muted-foreground">{listing.fees.reason}</p>}
                        {(listing.fees?.components?.length ?? 0) > 0 && <ul className="text-xs text-muted-foreground">{listing.fees!.components.map((fee, index) => <li key={index}>{fee.name}: {listing.fees!.currency} {fee.amount.toFixed(2)}</li>)}</ul>}
                        <p>{listing.estimatedMargin
                          ? `Estimated margin before shipping/tax: ${listing.estimatedMargin.currency} ${listing.estimatedMargin.amount.toFixed(2)} (${listing.estimatedMargin.percent.toFixed(2)}%)`
                          : "Margin unavailable until item cost and sale fees are known."}</p>
                        {listing.fees?.retrievedAt && <p className="text-xs text-muted-foreground">Fee check: {formatDate(listing.fees.retrievedAt)}</p>}
                      </div>
                      {listing.lastSyncAt && (
                        <p className="text-xs text-muted-foreground mt-1" data-testid={`text-listing-sync-${listing.id}`}>
                          Last sync: {formatDate(listing.lastSyncAt)}
                        </p>
                      )}
                      {listing.errorMessage && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />{listing.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 [&>button]:min-h-12">
                      <Button variant="outline" onClick={() => openSetup(listing.surfaceId)} data-testid={`button-setup-${listing.id}`}>Item Setup</Button>
                      <Button variant="outline" onClick={() => chooseAccount(listing.surfaceId)}>Add Marketplace</Button>
                      {listing.platform === "amazon" && <>
                        <Button variant="outline" disabled={listing.status === "syncing"} onClick={() => setAmazonListing(listing)} data-testid={`button-amazon-setup-${listing.id}`}>Amazon Setup</Button>
                        <Button variant="outline" disabled={publishMutation.isPending || listing.status === "syncing"} onClick={() => publishMutation.mutate({ listingId: listing.id, action: "check_status" })} data-testid={`button-amazon-status-${listing.id}`}>Check Amazon status</Button>
                        {(listing.amazonItems?.length || listing.externalListingId) && listing.status !== "delisted" && <Button variant="outline" disabled={publishMutation.isPending || listing.status === "syncing"} onClick={() => { if (window.confirm("Remove this listing and all its variations from Amazon? Your product and listing history will remain.")) publishMutation.mutate({ listingId: listing.id, action: "delete" }); }} data-testid={`button-amazon-remove-${listing.id}`}>Remove from Amazon</Button>}
                      </>}
                      {listing.platform === "ebay" ? <>
                        <Button variant="outline" disabled={listing.status === "syncing"} onClick={() => setEbayListing(listing)} data-testid={`button-ebay-setup-${listing.id}`}>eBay Setup</Button>
                        <Button variant="outline" disabled={publishMutation.isPending || listing.status === "syncing"} onClick={() => publishMutation.mutate({ listingId: listing.id, action: "check_status" })} data-testid={`button-ebay-status-${listing.id}`}>Check eBay status</Button>
                        {(listing.externalListingId || listing.externalOfferId || listing.ebayOffers?.length) && listing.status !== "delisted" && <Button variant="outline" disabled={publishMutation.isPending || listing.status === "syncing"} onClick={() => { if (window.confirm("End this listing on eBay? It will stop being available for sale. Your product and listing history will remain.")) publishMutation.mutate({ listingId: listing.id, action: "delete" }); }} data-testid={`button-ebay-end-${listing.id}`}>End eBay listing</Button>}
                      </> : <Button variant="outline" onClick={() => checkMutation.mutate(listing.surfaceId)} disabled={checkMutation.isPending}>Check</Button>}
                      {listing.platform === "etsy" && <>
                        <Button variant="outline" onClick={() => setEtsyListing(listing)} disabled={listing.status === "syncing"} data-testid={`button-etsy-setup-${listing.id}`}>Etsy Setup</Button>
                        <Button variant="outline" disabled={!listing.externalListingId || publishMutation.isPending || listing.status === "syncing"} onClick={() => publishMutation.mutate({ listingId: listing.id, action: "check_status" })} data-testid={`button-etsy-status-${listing.id}`}>Check Etsy status</Button>
                        {listing.externalListingId && listing.status !== "delisted" && <Button variant="outline" disabled={publishMutation.isPending || listing.status === "syncing"} onClick={() => { if (window.confirm("Stop selling this listing on Etsy? Your product and listing history will remain.")) publishMutation.mutate({ listingId: listing.id, action: "delete" }); }} data-testid={`button-etsy-end-${listing.id}`}>End Etsy listing</Button>}
                      </>}
                      <Button className="min-h-12" variant="outline" disabled={feeMutation.isPending || listing.status === "syncing"} onClick={() => feeMutation.mutate(listing.id)} data-testid={`button-fees-${listing.id}`}>
                        <RefreshCw className="mr-2 h-4 w-4" />{feeMutation.isPending && feeMutation.variables === listing.id ? "Checking fees…" : "Refresh item fees"}
                      </Button>
                      {listing.externalUrl && (
                        <Button variant="ghost" size="icon" asChild data-testid={`button-view-external-${listing.id}`}>
                          <a href={listing.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      )}
                      {["pending", "draft", "delisted"].includes(listing.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => publishListing(listing, "create")}
                          disabled={publishMutation.isPending}
                          data-testid={`button-publish-${listing.id}`}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Publish
                        </Button>
                      )}
                      {listing.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => publishListing(listing, "update")}
                          disabled={publishMutation.isPending}
                          data-testid={`button-sync-${listing.id}`}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Sync
                        </Button>
                      )}
                      {listing.status === "error" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => publishListing(listing, "create")}
                          disabled={publishMutation.isPending}
                          data-testid={`button-retry-listing-${listing.id}`}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove local draft listing"
                        disabled={deleteMutation.isPending || !!listing.externalListingId || !!listing.externalOfferId || !!listing.ebayOffers?.length || !!listing.amazonItems?.length || !!listing.externalCreateAttempted || listing.status === "syncing"}
                        onClick={() => { if (window.confirm("Remove this local draft listing?")) deleteMutation.mutate(listing.id); }}
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

      {showGenerate && <GenerateFromProductDialog open onClose={() => setShowGenerate(false)} onGenerated={surfaceId => { setContinueToAccount(true); setSetupId(surfaceId); }} />}
      {setupId && setupSurface && <MarketplaceItemSetup key={setupId} surface={setupSurface} onClose={() => setSetupId(null)} onSaved={surfaceId => { setSetupId(null); if (continueToAccount) chooseAccount(surfaceId); }} />}
      {setupId && !setupSurface && <Dialog open onOpenChange={open => { if (!open) setSetupId(null); }}><DialogContent className="[&>button]:left-4 [&>button]:right-auto [&>button]:h-12 [&>button]:w-12">
        <DialogHeader><DialogTitle className="pl-12">Item Setup</DialogTitle></DialogHeader>
        {setupLoading ? <p>Loading item setup…</p> : <div role="alert"><p>Could not load item setup: {setupError?.message}</p><Button onClick={() => reloadSetup()}>Retry</Button></div>}
        <Button variant="outline" onClick={() => setSetupId(null)}>Close</Button>
      </DialogContent></Dialog>}
      {amazonListing && <AmazonSetupDialog key={amazonListing.id} listing={amazonListing} onClose={() => setAmazonListing(null)} />}
      {ebayListing && <EbaySetupDialog key={ebayListing.id} listing={ebayListing} onClose={() => setEbayListing(null)} />}
      {etsyListing && <EtsySetupDialog key={etsyListing.id} listing={etsyListing} onClose={() => setEtsyListing(null)} />}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="[&>button]:left-4 [&>button]:right-auto [&>button]:h-12 [&>button]:w-12">
          <DialogHeader><DialogTitle className="pl-12">Add Marketplace</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={addForm.surfaceId} onValueChange={(v) => setAddForm({ surfaceId: v, accountId: "" })}>
                <SelectTrigger data-testid="select-listing-surface"><SelectValue placeholder="Select an item" /></SelectTrigger>
                <SelectContent>
                  {surfaces.map((s) => (
                    <SelectItem key={s.id} value={s.id ?? ""}>{s.title || s.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={addForm.accountId} onValueChange={(v) => setAddForm({ ...addForm, accountId: v })}>
                <SelectTrigger data-testid="select-listing-account"><SelectValue placeholder="Select an account" /></SelectTrigger>
                <SelectContent>
                  {availableAccounts.map((a) => {
                    const info = PLATFORM_INFO[a.platform];
                    return <SelectItem key={a.id} value={a.id ?? ""}>{info?.name} - {a.accountName}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          {addForm.surfaceId && availableAccounts.length === 0 && <p className="text-sm">Enable a marketplace in Item Setup and add an active seller account in Accounts.</p>}
          {onOpenAccounts && <Button variant="outline" className="min-h-12" onClick={onOpenAccounts}>Manage Accounts</Button>}
          <DialogFooter className="gap-2 [&>button]:min-h-12">
            <Button variant="outline" onClick={() => setShowAdd(false)} data-testid="button-cancel-listing">Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(addForm)}
              disabled={createMutation.isPending || !addForm.surfaceId || !availableAccounts.some(a => a.id === addForm.accountId)}
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
  const { toast } = useToast();

  const { data: jobs = [], isLoading, error: jobsError, refetch: reloadJobs } = useQuery<SyncJobData[]>({
    queryKey: ["/api/admin/surfaces/jobs"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((j: SyncJobData) => j.status === "queued" || j.status === "running")) return 3000;
      return false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/admin/surfaces/jobs/${jobId}/retry`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/listings"] });
      toast({ title: data.success ? `Retry: ${data.listingStatus}` : "Retry failed", description: data.error, variant: data.success ? "default" : "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/logs"] });
    },
    onError: (err: Error) => toast({ title: "Retry failed", description: err.message, variant: "destructive" }),
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
        <h2 className="text-lg font-semibold" data-testid="text-jobs-title">Publishing Activity</h2>
        <p className="text-sm text-muted-foreground">Publishing pipeline execution history</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : jobsError ? (<div role="alert"><p>Could not load publishing activity: {jobsError.message}</p><Button className="min-h-12" onClick={() => reloadJobs()}>Retry</Button></div>) : jobs.length === 0 ? (
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
                          <span className="text-sm font-medium capitalize">{job.action === "delete" ? "End listing" : job.action.replace("_", " ")}</span>
                          {jobStatusBadge(job.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>{formatDate(job.createdAt)}</span>
                          <span>Attempts: {job.attempts}/{job.maxAttempts}</span>
                          {job.completedAt && <span>Completed: {formatDate(job.completedAt)}</span>}
                        </div>
                        {job.errorMessage && (
                          <p className="text-xs text-destructive mt-1">{job.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {job.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryMutation.mutate(job.id)}
                          disabled={retryMutation.isPending}
                          className="min-h-12"
                          data-testid={`button-retry-job-${job.id}`}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
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

  const { data: logs = [], isLoading, error, refetch } = useQuery<SyncLogData[]>({
    queryKey: ["/api/admin/surfaces/logs", levelFilter !== "all" ? levelFilter : undefined].filter(Boolean),
    queryFn: async () => {
      const params = levelFilter !== "all" ? `?level=${levelFilter}` : "";
      const res = await apiRequest("GET", `/api/admin/surfaces/logs${params}`);
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
          <h2 className="text-lg font-semibold" data-testid="text-logs-title">Activity Details</h2>
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
      ) : error ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>Could not load logs: {error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
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

export function ActivitySection() {
  const [showDetails, setShowDetails] = useState(false);
  return <div>
    <JobsSection />
    <div className="px-4 pb-4">
      <Button className="min-h-12 w-full justify-start" variant="outline" aria-expanded={showDetails} aria-controls="marketplace-activity-details" onClick={() => setShowDetails(value => !value)} data-testid="button-activity-details">
        <ScrollText className="mr-2 h-4 w-4" />{showDetails ? "Hide detailed logs" : "Show detailed logs"}
      </Button>
      {showDetails && <div id="marketplace-activity-details"><LogsSection /></div>}
    </div>
  </div>;
}
