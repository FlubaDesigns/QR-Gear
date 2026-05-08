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
  const { api, providers, selectedProviders, setSelectedProviders } = useProductsContext();
  const { toast } = useToast();

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    status: string;
    syncId?: string;
    summary?: any;
    completedAt?: string;
    errorMessage?: string;
  } | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fulfillmentProviders = useMemo(
    () => providers.filter((p) => p.role === "fulfillment"),
    [providers]
  );

  const currentProvider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";
  const currentProviderObj = fulfillmentProviders.find((p) => p.id === currentProvider);
  const isConfigured = currentProviderObj?.configured ?? false;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const rebuildMasterProducts = useCallback(async () => {
    try {
      await adminFetch("/sync-master-products", { method: "POST" });
    } catch (e) {
      console.error("[rebuildMasterProducts] Failed:", e);
    }
  }, []);

  const pollSyncStatus = useCallback(
    async (syncId?: string) => {
      try {
        const url = syncId ? `/catalog/sync-status?syncId=${syncId}` : `/catalog/sync-status`;
        const data = await adminFetch<any>(url);
        setSyncStatus(data);

        if (data.status === "completed" || data.status === "failed") {
          stopPolling();
          setSyncing(false);
          if (data.status === "completed") {
            api.invalidateProducts();
            const s = data.summary;
            const desc = s
              ? `Blueprints: ${s.blueprints?.added || 0} new, ${s.blueprints?.updated || 0} updated, ${s.blueprints?.skipped || 0} unchanged`
              : "Sync completed successfully";
            toast({ title: "Smart Sync Complete", description: desc });
            rebuildMasterProducts();
          } else {
            toast({
              title: "Sync Failed",
              description: data.errorMessage || "Unknown error",
              variant: "destructive",
            });
          }
        }
      } catch {}
    },
    [toast, stopPolling, rebuildMasterProducts]
  );

  useEffect(() => {
    pollSyncStatus();
    return stopPolling;
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus(null);

    try {
      const endpoint = currentProvider === "printful" ? `/catalog/sync-printful` : `/catalog/sync`;
      const data = await adminFetch<any>(endpoint, {
        method: "POST",
        json: { provider: currentProvider },
      });
      const syncId = data.syncId;

      if (syncId) {
        pollRef.current = setInterval(() => pollSyncStatus(syncId), 3000);
      } else {
        setSyncing(false);
        toast({
          title: "Sync Started",
          description: data.message || "Sync is running in the background",
        });
        rebuildMasterProducts();
      }
    } catch (e: any) {
      toast({ title: "Sync Error", description: e.message, variant: "destructive" });
      setSyncing(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProviders([providerId]);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
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
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 opacity-50">
                  Not configured
                </Badge>
              )}
            </div>
          ))}
        </RadioGroup>

        <div className="ml-auto">
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing || !isConfigured}
            data-testid="button-sync-catalog"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Smart Sync"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {!isConfigured && (
          <span>Provider not configured</span>
        )}

        {syncStatus?.status === "completed" && (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span>Last sync: {formatTime(syncStatus.completedAt)}</span>
            {syncStatus.summary?.blueprints && (
              <span className="text-muted-foreground/70">
                ({syncStatus.summary.blueprints.total} items,{" "}
                {syncStatus.summary.blueprints.skipped} unchanged)
              </span>
            )}
          </div>
        )}

        {syncStatus?.status === "failed" && !syncing && (
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>Last sync failed</span>
          </div>
        )}

        {syncStatus?.status === "running" && syncing && (
          <span>Comparing with Firestore — only writing changes...</span>
        )}
      </div>
    </div>
  );
}

export default ProductsControlBar;
