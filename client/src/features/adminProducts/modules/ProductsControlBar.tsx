import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Store, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { useProductsContext } from "../ProductsContext";
import { adminFetch } from "@/lib/adminFetch";

export function ProductsControlBar() {
  const { api, providers, providersLoading, providersError, selectedProviders, setSelectedProviders } = useProductsContext();
  const { toast } = useToast();

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    status: string;
    syncId?: string;
    summary?: any;
    completedAt?: string;
    errorMessage?: string;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSyncRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(false);

  const fulfillmentProviders = useMemo(
    () => providers.filter((p) => p.role === "fulfillment" && ["printify", "printful"].includes(p.id)),
    [providers]
  );

  const currentProvider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";
  const currentProviderObj = fulfillmentProviders.find((p) => p.id === currentProvider);
  const isConfigured = currentProviderObj?.configured ?? false;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // History reads must never rebuild QRG products or announce a new completion.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    setSyncStatus(null);
    adminFetch<any>(`/catalog/sync-status?provider=${currentProvider}`)
      .then(data => { if (!cancelled && !startingRef.current) setSyncStatus(data); })
      .catch((error: Error) => {
        if (!cancelled && !startingRef.current) {
          setSyncStatus({ status: "failed", errorMessage: `Could not load sync status: ${error.message}` });
        }
      });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      activeSyncRef.current = null;
      stopPolling();
    };
  }, [currentProvider, stopPolling]);

  const pollSyncStatus = useCallback(async (syncId: string) => {
    if (activeSyncRef.current !== syncId || !mountedRef.current) return;
    try {
      const data = await adminFetch<any>(`/catalog/sync-status?syncId=${encodeURIComponent(syncId)}`);
      if (activeSyncRef.current !== syncId || !mountedRef.current) return;
      if (data.status === "failed") throw new Error(data.errorMessage || "Supplier sync failed");
      if (data.status !== "completed") {
        setSyncStatus(data);
        // Schedule after the request completes; slow responses cannot overlap.
        pollRef.current = setTimeout(() => { void pollSyncStatus(syncId); }, 3000);
        return;
      }
      setSyncStatus({ ...data, status: "rebuilding" });
      await adminFetch("/sync-master-products", { method: "POST" });
      await api.invalidateProducts();
      if (!mountedRef.current) return;
      setSyncStatus(data);
      const counts = data.summary?.products || data.summary?.blueprints;
      toast({
        title: "Smart Sync Complete",
        description: counts
          ? `${counts.added} new, ${counts.updated} updated, ${counts.skipped} unchanged. QRG catalog refreshed.`
          : "QRG catalog refreshed.",
      });
      activeSyncRef.current = null;
      startingRef.current = false;
      setSyncing(false);
    } catch (error: any) {
      if (!mountedRef.current) return;
      stopPolling();
      activeSyncRef.current = null;
      startingRef.current = false;
      setSyncing(false);
      setSyncStatus({ status: "failed", syncId, errorMessage: error.message });
      toast({ title: "Sync incomplete", description: error.message, variant: "destructive" });
    }
  }, [api, toast, stopPolling]);

  const handleSync = async () => {
    if (startingRef.current || !isConfigured || providersLoading || providersError) return;
    startingRef.current = true;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const endpoint = currentProvider === "printful" ? "/catalog/sync-printful" : "/catalog/sync";
      const data = await adminFetch<any>(endpoint, { method: "POST", json: { provider: currentProvider } });
      if (!data.syncId) throw new Error("Sync did not return a tracking ID. QRG catalog was not rebuilt.");
      if (!mountedRef.current) return;
      activeSyncRef.current = data.syncId;
      setSyncStatus({ status: "running", syncId: data.syncId });
      await pollSyncStatus(data.syncId);
    } catch (error: any) {
      startingRef.current = false;
      if (!mountedRef.current) return;
      setSyncing(false);
      setSyncStatus({ status: "failed", errorMessage: error.message });
      toast({ title: "Sync Error", description: error.message, variant: "destructive" });
    }
  };

  const handleProviderChange = (providerId: string) => {
    if (!startingRef.current) setSelectedProviders([providerId]);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "time unavailable";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex flex-col gap-3 pb-3 border-b" data-testid="products-control-bar">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Store className="h-4 w-4" />
          Fulfillment
        </div>

        <RadioGroup
          disabled={syncing}
          value={currentProvider}
          onValueChange={handleProviderChange}
          className="flex flex-wrap items-center gap-4"
          data-testid="radio-fulfillment"
        >
          {fulfillmentProviders.map((provider) => (
            <div key={provider.id} className="flex items-center gap-2">
              <RadioGroupItem
                id={`provider-${provider.id}`}
                value={provider.id}
                data-testid={`radio-provider-${provider.id}`}
              />
              <Label
                htmlFor={`provider-${provider.id}`}
                className={`text-sm cursor-pointer ${
                  currentProvider === provider.id ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {provider.name}
              </Label>
              {provider.configured ? (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-700 border-green-300"
                >
                  Configured
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 opacity-50">
                  {providersLoading ? "Checking..." : providersError ? "Unknown" : "Not configured"}
                </Badge>
              )}
            </div>
          ))}
        </RadioGroup>

        <div className="ml-auto">
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing || !isConfigured || providersLoading || !!providersError}
            data-testid="button-sync-catalog"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Smart Sync"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {providersError && <span role="alert" className="text-destructive">Could not check providers: {providersError}</span>}
        {!providersLoading && !providersError && !isConfigured && <span>Provider not configured</span>}

        {syncStatus?.status === "completed" && (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span>Last supplier sync: {formatTime(syncStatus.completedAt)}</span>
            {(syncStatus.summary?.products || syncStatus.summary?.blueprints) && (
              <span className="text-muted-foreground/70">
                ({(syncStatus.summary.products || syncStatus.summary.blueprints).total} items,{" "}
                {(syncStatus.summary.products || syncStatus.summary.blueprints).skipped} unchanged)
              </span>
            )}
          </div>
        )}

        {syncStatus?.status === "failed" && !syncing && (
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span role="alert">{syncStatus.errorMessage || "Last sync failed"}</span>
          </div>
        )}

        {syncStatus?.status === "rebuilding" && <span>Updating QRG catalog...</span>}
        {syncStatus?.status === "running" && !syncing && <span>A supplier sync is running.</span>}
        {syncStatus?.status === "running" && syncing && (
          <span>Comparing with Firestore — only writing changes...</span>
        )}
      </div>
    </div>
  );
}

export default ProductsControlBar;
