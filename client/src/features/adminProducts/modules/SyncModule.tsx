import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useProductsContext } from "../ProductsContext";
import { apiRequest } from "@/lib/queryClient";

interface SyncModuleProps {
  selectedProviders: string[];
}

type PhaseStatus = "idle" | "pending" | "done" | "error";

interface SyncPhase {
  label: string;
  status: PhaseStatus;
  detail?: string;
}

export function SyncModule({ selectedProviders }: SyncModuleProps) {
  const { api } = useProductsContext();
  const { toast } = useToast();
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [phases, setPhases] = useState<SyncPhase[]>([]);

  const setPhase = (index: number, update: Partial<SyncPhase>) => {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, ...update } : p));
  };

  const syncMutation = useMutation({
    mutationFn: async (provider?: string) => {
      const providerLabel = provider === "printful" ? "Printful" : "Printify";

      setPhases([
        { label: `${providerLabel} catalog`, status: "pending" },
        { label: "Master catalog", status: "idle" },
      ]);

      // Phase 1: provider sync (fire-and-forget endpoint — responds immediately)
      try {
        await api.syncCatalog(provider);
        setPhase(0, { status: "done", detail: "started in background" });
      } catch (err: any) {
        setPhase(0, { status: "error", detail: err.message });
        throw err;
      }

      // Phase 2: master catalog sync
      setPhase(1, { status: "pending" });
      try {
        const res = await apiRequest("POST", "/api/admin/master-catalog/sync", {});
        const data = await res.json().catch(() => ({}));
        setPhase(1, { status: "done", detail: data.message || "started in background" });
      } catch (err: any) {
        setPhase(1, { status: "error", detail: err.message });
        throw err;
      }
    },
    onSuccess: () => {
      setLastSynced(new Date());
      toast({ title: "Sync started", description: "Provider and master catalog syncs are running in the background." });
      api.invalidateProducts();
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const formatLastSynced = () => {
    if (!lastSynced) return "Never";
    const now = new Date();
    const diffMs = now.getTime() - lastSynced.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return lastSynced.toLocaleDateString();
  };

  const PhaseIcon = ({ status }: { status: PhaseStatus }) => {
    if (status === "pending") return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    return <span className="h-3.5 w-3.5 inline-block rounded-full border border-muted-foreground/30" />;
  };

  return (
    <CollapsibleModule
      title="Sync"
      icon={<RefreshCw className="h-4 w-4" />}
      className="bg-muted/30"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            onClick={() => syncMutation.mutate(selectedProviders[0])}
            disabled={syncMutation.isPending}
            size="sm"
            data-testid="button-sync-catalog"
          >
            {syncMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sync Now
          </Button>

          <span className="text-sm text-muted-foreground">
            Last synced: {formatLastSynced()}
          </span>
        </div>

        {phases.length > 0 && (
          <div className="flex flex-col gap-1.5 pl-1">
            {phases.map((phase, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <PhaseIcon status={phase.status} />
                <span className={phase.status === "idle" ? "text-muted-foreground" : ""}>
                  {phase.label}
                </span>
                {phase.detail && (
                  <span className="text-xs text-muted-foreground">— {phase.detail}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}

export default SyncModule;
