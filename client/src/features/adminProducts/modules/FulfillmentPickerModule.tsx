import { useState, useEffect, useRef, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Store, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useToast } from "@/hooks/use-toast";
import { useProductsContext } from "../ProductsContext";
import { adminFetch } from "@/lib/adminFetch";
import type { FulfillmentProvider } from "../shared/types";

interface FulfillmentPickerModuleProps {
  providers: FulfillmentProvider[];
  selectedProviders: string[];
  onSelectionChange: (providers: string[]) => void;
  productCount?: { filtered: number; total: number };
}

export function FulfillmentPickerModule({
  providers,
  selectedProviders,
  onSelectionChange,
  productCount,
}: FulfillmentPickerModuleProps) {
  const { toast } = useToast();
  const { api } = useProductsContext();
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    status: string;
    syncId?: string;
    summary?: any;
    completedAt?: string;
  } | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const fulfillmentProviders = providers.filter((p) => p.role === "fulfillment");
  const currentProvider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";
  const currentProviderObj = fulfillmentProviders.find(p => p.id === currentProvider);
  const isConfigured = currentProviderObj?.configured ?? false;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollSyncStatus = useCallback(async (syncId?: string) => {
    try {
      const url = syncId ? `/catalog/sync-status?syncId=${syncId}` : `/catalog/sync-status`;
      const data = await adminFetch<any>(url);
      setSyncStatus(data);

      if (data.status === 'completed' || data.status === 'failed') {
        stopPolling();
        setSyncing(false);
        if (data.status === 'completed') {
          api.invalidateProducts();
          const s = data.summary;
          const desc = s
            ? `Blueprints: ${s.blueprints?.added || 0} new, ${s.blueprints?.updated || 0} updated, ${s.blueprints?.skipped || 0} unchanged`
            : 'Sync completed successfully';
          toast({ title: "Smart Sync Complete", description: desc });
        } else {
          toast({ title: "Sync Failed", description: data.errorMessage || 'Unknown error', variant: "destructive" });
        }
      }
    } catch {
    }
  }, [api, toast, stopPolling]);

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
        toast({ title: "Sync Started", description: data.message || "Sync is running in the background" });
      }
    } catch (e: any) {
      toast({ title: "Sync Error", description: e.message, variant: "destructive" });
      setSyncing(false);
    }
  };

  const handleProviderChange = (providerId: string) => {

    onSelectionChange([providerId]);
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
    <CollapsibleModule
      title="Fulfillment & Sync"
      icon={<Store className="h-4 w-4" />}
      className="bg-muted/30"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <RadioGroup
            value={currentProvider}
            onValueChange={handleProviderChange}
            className="flex flex-wrap items-center gap-4"
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
                    currentProvider === provider.id
                      ? "font-medium"
                      : "text-muted-foreground"
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
          {productCount && (
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {productCount.filtered} of {productCount.total} products
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-2">
          <Button
            onClick={handleSync}
            disabled={syncing || !isConfigured}
            size="sm"
            data-testid="button-sync-catalog"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Smart Sync"}
          </Button>
          {!isConfigured && (
            <span className="text-xs text-muted-foreground">
              Provider not configured
            </span>
          )}

          {syncStatus?.status === 'completed' && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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

          {syncStatus?.status === 'failed' && !syncing && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Last sync failed</span>
            </div>
          )}

          {syncStatus?.status === 'running' && syncing && (
            <span className="text-xs text-muted-foreground">
              Comparing with Firestore — only writing changes...
            </span>
          )}
        </div>
      </div>
    </CollapsibleModule>
  );
}

export default FulfillmentPickerModule;
