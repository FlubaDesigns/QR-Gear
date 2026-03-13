import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { HealthDashboard } from "./orchestration-types";

export function HealthTabContent() {
  const { toast } = useToast();

  const { data: healthData, isLoading: healthLoading } = useQuery<HealthDashboard>({
    queryKey: ["/api/admin/orchestration/provider-health"],
    refetchInterval: 60000,
  });

  const checkHealthMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/orchestration/provider-health/check");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/provider-health"] });
      toast({ title: "Health Check Complete", description: "All providers have been checked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Provider Health Status</h2>
        <Button
          onClick={() => checkHealthMutation.mutate()}
          disabled={checkHealthMutation.isPending}
          className="h-12"
          data-testid="button-check-health"
        >
          {checkHealthMutation.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5 mr-2" />
          )}
          Check All Providers
        </Button>
      </div>

      {healthData?.summary && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${
                  healthData.summary.overallHealth === "healthy" ? "bg-green-500" :
                  healthData.summary.overallHealth === "degraded" ? "bg-yellow-500" : "bg-red-500"
                }`} />
                <span className="font-semibold text-lg capitalize">
                  System: {healthData.summary.overallHealth}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {healthData.summary.healthyProviders} healthy
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  {healthData.summary.unhealthyProviders} down
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {healthLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !healthData?.providers || healthData.providers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Providers Loaded</h3>
            <p className="text-muted-foreground mb-4">
              Provider adapters will appear here once configured.
            </p>
            <Button 
              onClick={() => checkHealthMutation.mutate()} 
              className="h-12"
              disabled={checkHealthMutation.isPending}
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Run First Health Check
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {healthData.providers.map((provider) => (
            <Card key={provider.providerType} data-testid={`card-health-${provider.providerType}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-semibold text-lg">{provider.displayName}</span>
                  {provider.isHealthy ? (
                    <Badge className="bg-green-600 min-h-8 px-3">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Healthy
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="min-h-8 px-3">
                      <XCircle className="w-4 h-4 mr-1" />
                      Down
                    </Badge>
                  )}
                </div>
                
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Time</span>
                    <span className={provider.responseTimeMs > 1000 ? "text-yellow-600" : "text-foreground"}>
                      {provider.responseTimeMs}ms
                    </span>
                  </div>
                  
                  {provider.stats24h.totalChecks > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">24h Uptime</span>
                        <span className={provider.stats24h.uptimePercent < 95 ? "text-yellow-600" : "text-green-600"}>
                          {provider.stats24h.uptimePercent}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Response</span>
                        <span>{provider.stats24h.avgResponseTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Checks (24h)</span>
                        <span>{provider.stats24h.totalChecks}</span>
                      </div>
                    </>
                  )}
                  
                  {provider.errorMessage && (
                    <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                      {provider.errorCode && <span className="font-mono mr-1">[{provider.errorCode}]</span>}
                      {provider.errorMessage}
                    </div>
                  )}
                  
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    Last check: {provider.lastCheck ? new Date(provider.lastCheck).toLocaleString() : "Never"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
