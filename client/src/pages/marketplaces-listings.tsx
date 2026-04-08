import { useState } from "react";
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
  Pencil, Play, Clock, XCircle, Info, AlertTriangle, RotateCcw,
} from "lucide-react";
import { SiEtsy, SiEbay, SiAmazon } from "react-icons/si";
import type { MarketplaceAccount, SurfaceData, ListingData, MarketplacePlatform } from "./marketplaces-accounts";

const PLATFORM_INFO: Record<MarketplacePlatform, { name: string; icon: typeof SiEtsy; color: string }> = {
  etsy: { name: "Etsy", icon: SiEtsy, color: "text-orange-500" },
  ebay: { name: "eBay", icon: SiEbay, color: "text-blue-500" },
  amazon: { name: "Amazon", icon: SiAmazon, color: "text-yellow-500" },
};

export function ListingsSection() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ surfaceId: "", accountId: "" });

  const { data: listings = [], isLoading } = useQuery<ListingData[]>({
    queryKey: ["/api/admin/surfaces/listings"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((l: ListingData) => l.status === "syncing")) return 3000;
      return false;
    },
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
    mutationFn: async ({ listingId, action }: { listingId: string; action: string }) => {
      const res = await apiRequest("POST", "/api/admin/surfaces/jobs", { listingId, action });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/jobs"] });
      const label = variables.action === "create" ? "Publish" : variables.action === "update" ? "Sync" : variables.action;
      toast({ title: `${label} job queued` });
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

  const getSurfaceTitle = (id: string) => surfaces.find((s) => s.id === id)?.title || id || "Unknown surface";
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
                          onClick={() => publishMutation.mutate({ listingId: listing.id, action: "create" })}
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
                          onClick={() => publishMutation.mutate({ listingId: listing.id, action: "update" })}
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
                          onClick={() => publishMutation.mutate({ listingId: listing.id, action: "create" })}
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
                  {accounts.map((a) => {
                    const info = PLATFORM_INFO[a.platform];
                    return <SelectItem key={a.id} value={a.id ?? ""}>{info?.name} - {a.accountName}</SelectItem>;
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

export function JobsSection() {
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<SyncJobData[]>({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/surfaces/listings"] });
      toast({ title: "Job re-queued for retry" });
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

export function LogsSection() {
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
