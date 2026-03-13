import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Route,
  DollarSign,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoutingResult, RoutingStats } from "./orchestration-types";

export function RoutingTabContent() {
  const { toast } = useToast();

  const { data: routingStats } = useQuery<RoutingStats>({
    queryKey: ["/api/admin/orchestration/routing/stats"],
  });

  const [routingBlueprintId, setRoutingBlueprintId] = useState("");
  const [routingPriority, setRoutingPriority] = useState<"cost" | "speed" | "balanced">("balanced");
  const [routingResult, setRoutingResult] = useState<RoutingResult | null>(null);

  const routeOrderMutation = useMutation({
    mutationFn: async (params: { blueprintId: number; prioritize: string }) => {
      const res = await apiRequest("POST", "/api/admin/orchestration/routing/route", params);
      return res.json() as Promise<RoutingResult>;
    },
    onSuccess: (data) => {
      setRoutingResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/routing/stats"] });
      toast({
        title: "Routing Complete",
        description: data.success ? `Routed to ${data.selectedProvider?.providerName}` : data.reason,
      });
    },
    onError: (error) => {
      toast({
        title: "Routing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Auto-Routing</h2>
        <Badge variant="outline" className="text-xs">
          {routingStats?.totalRoutings || 0} total routings
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Average Selected Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${(routingStats?.avgSelectedCost || 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Per routed order</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last Routing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {routingStats?.routingTimestamp 
                ? new Date(routingStats.routingTimestamp).toLocaleTimeString() 
                : "Never"}
            </p>
            <p className="text-xs text-muted-foreground">Most recent decision</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Provider Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {Object.keys(routingStats?.byProvider || {}).length}
            </p>
            <p className="text-xs text-muted-foreground">Active providers</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Route Order to Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="blueprintId">Blueprint ID</Label>
              <Input
                id="blueprintId"
                placeholder="e.g., 6 (Bella Canvas 3001)"
                value={routingBlueprintId}
                onChange={(e) => setRoutingBlueprintId(e.target.value)}
                className="h-12"
                data-testid="input-blueprint-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={routingPriority} onValueChange={(v) => setRoutingPriority(v as "cost" | "speed" | "balanced")}>
                <SelectTrigger className="h-12" data-testid="select-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cost">Lowest Cost</SelectItem>
                  <SelectItem value="speed">Fastest (USA)</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  const id = parseInt(routingBlueprintId);
                  if (!isNaN(id)) {
                    routeOrderMutation.mutate({ blueprintId: id, prioritize: routingPriority });
                  }
                }}
                disabled={routeOrderMutation.isPending || !routingBlueprintId}
                className="h-12 w-full"
                data-testid="button-route-order"
              >
                {routeOrderMutation.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Route className="w-5 h-5 mr-2" />
                )}
                Find Best Provider
              </Button>
            </div>
          </div>

          {routingResult && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  {routingResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  Routing Result
                </h4>
                <Badge variant={routingResult.success ? "default" : "destructive"}>
                  {routingResult.success ? "Success" : "Failed"}
                </Badge>
              </div>

              {routingResult.selectedProvider && (
                <div className="space-y-3">
                  <div className="p-3 rounded border bg-background">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-medium">{routingResult.selectedProvider.providerName}</p>
                        <p className="text-sm text-muted-foreground">
                          Provider ID: {routingResult.selectedProvider.providerId}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          ${routingResult.selectedProvider.costCents ? (routingResult.selectedProvider.costCents / 100).toFixed(2) : 'N/A'}
                        </p>
                        <div className="flex items-center gap-2">
                          {routingResult.selectedProvider.isUSA && (
                            <Badge variant="outline" className="text-xs">USA</Badge>
                          )}
                          <Badge variant={routingResult.selectedProvider.isHealthy ? "default" : "secondary"} className="text-xs">
                            {routingResult.selectedProvider.healthScore.toFixed(0)}% uptime
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {routingResult.selectedProvider.reason}
                    </p>
                  </div>

                  {routingResult.alternativeProviders.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Alternatives:</p>
                      <div className="space-y-2">
                        {routingResult.alternativeProviders.map((alt) => (
                          <div key={alt.providerId} className="p-2 rounded border bg-background/50 text-sm flex items-center justify-between gap-2">
                            <span>{alt.providerName}</span>
                            <span className="text-muted-foreground">
                              ${alt.costCents ? (alt.costCents / 100).toFixed(2) : 'N/A'}
                              {alt.isUSA && " (USA)"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!routingResult.success && (
                <p className="text-sm text-muted-foreground">{routingResult.reason}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
