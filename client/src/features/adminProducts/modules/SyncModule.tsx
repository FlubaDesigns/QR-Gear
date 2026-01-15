import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useProductsContext } from "../ProductsContext";

interface SyncModuleProps {
  selectedProviders: string[];
}

export function SyncModule({ selectedProviders }: SyncModuleProps) {
  const { api } = useProductsContext();
  const { toast } = useToast();
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const prevProvidersRef = useRef<string[]>(selectedProviders);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const syncMutation = useMutation({
    mutationFn: api.syncCatalog,
    onSuccess: (result) => {
      setLastSynced(new Date());
      toast({ title: "Sync complete", description: `Synced ${result.synced} products` });
      api.invalidateProducts();
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const prev = prevProvidersRef.current;
    const changed = 
      prev.length !== selectedProviders.length ||
      prev.some((p) => !selectedProviders.includes(p)) ||
      selectedProviders.some((p) => !prev.includes(p));

    prevProvidersRef.current = selectedProviders;

    if (!changed) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!syncMutation.isPending && selectedProviders.length > 0) {
        syncMutation.mutate();
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [selectedProviders, syncMutation.isPending]);

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

  return (
    <CollapsibleModule
      title="Sync"
      icon={<RefreshCw className="h-4 w-4" />}
      className="bg-muted/30"
    >
      <div className="flex flex-wrap items-center gap-4">
        <Button
          onClick={() => syncMutation.mutate()}
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

        {syncMutation.isPending && (
          <span className="text-xs text-muted-foreground">
            Syncing...
          </span>
        )}
      </div>
    </CollapsibleModule>
  );
}

export default SyncModule;
