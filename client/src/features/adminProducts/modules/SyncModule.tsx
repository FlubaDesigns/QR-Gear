import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useProductsContext } from "../ProductsContext";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SyncModuleProps {
  selectedProviders: string[];
}

type PhaseStatus = "idle" | "pending" | "done" | "error";

interface SyncPhase {
  label: string;
  status: PhaseStatus;
  detail?: string;
}

function statusToPhases(s: any): SyncPhase[] {
  if (!s || s.status === "never_run") return [];
  const toStatus = (phase: any): PhaseStatus => {
    if (!phase || phase.status === "pending") return "idle";
    if (phase.status === "running") return "pending";
    if (phase.status === "completed") return "done";
    if (phase.status === "failed") return "error";
    return "idle";
  };
  const detail = (phase: any): string | undefined => {
    if (!phase) return undefined;
    if (phase.error) return `Error: ${phase.error}`;
    if (phase.count !== undefined) return `${phase.count} records`;
    if (phase.status === "running") return "running…";
    return undefined;
  };
  return [
    { label: "Printify blueprints", status: toStatus(s.printify), detail: detail(s.printify) },
    { label: "Printful products", status: toStatus(s.printful), detail: detail(s.printful) },
    { label: "Master catalog build", status: toStatus(s.master), detail: detail(s.master) },
  ];
}

export function SyncModule({ selectedProviders: _selectedProviders }: SyncModuleProps) {
  const { api } = useProductsContext();
  const { toast } = useToast();
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [phases, setPhases] = useState<SyncPhase[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef(false);

  const pollStatus = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/master-catalog/rebuild-status");
      const data = await res.json();
      setPhases(statusToPhases(data));
      if (data.status === "completed") {
        setIsPolling(false);
        pollingRef.current = false;
        setLastSynced(new Date());
        queryClient.invalidateQueries({ queryKey: ["/api/master-catalog"] });
        api.invalidateProducts();
        toast({ title: "Rebuild complete", description: `Master catalog populated. Check the blanks list.` });
      } else if (data.status === "failed") {
        setIsPolling(false);
        pollingRef.current = false;
        toast({ title: "Rebuild failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch (_e) {
    }
  };

  useEffect(() => {
    if (!isPolling) return;
    pollingRef.current = true;
    const interval = setInterval(() => {
      if (!pollingRef.current) { clearInterval(interval); return; }
      pollStatus();
    }, 3000);
    return () => { pollingRef.current = false; clearInterval(interval); };
  }, [isPolling]);

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      setPhases([
        { label: "Printify blueprints", status: "pending" },
        { label: "Printful products", status: "idle" },
        { label: "Master catalog build", status: "idle" },
      ]);
      const res = await apiRequest("POST", "/api/admin/master-catalog/rebuild-full", {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setIsPolling(true);
    },
    onError: (error: Error) => {
      toast({ title: "Rebuild failed to start", description: error.message, variant: "destructive" });
      setPhases([]);
    },
  });

  const formatLastSynced = () => {
    if (!lastSynced) return "Never";
    const diffMs = Date.now() - lastSynced.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  const PhaseIcon = ({ status }: { status: PhaseStatus }) => {
    if (status === "pending") return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />;
  };

  const isRunning = rebuildMutation.isPending || isPolling;

  return (
    <CollapsibleModule
      title="Sync"
      icon={<RefreshCw className="h-4 w-4" />}
      className="bg-muted/30"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            onClick={() => rebuildMutation.mutate()}
            disabled={isRunning}
            size="sm"
            data-testid="button-sync-catalog"
          >
            {isRunning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isRunning ? "Rebuilding…" : "Full Rebuild"}
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
