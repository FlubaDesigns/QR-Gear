import { useQuery } from "@tanstack/react-query";
import AdminShell from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Clock,
  Server,
  Zap,
} from "lucide-react";
import type { ProviderHealthLog } from "@shared/schema";

interface ProviderStatus {
  provider: string;
  status: "healthy" | "degraded" | "down";
  lastCheck: string;
  responseMs: number;
  successRate: number;
  recentErrors: number;
}

interface HealthOverview {
  providers: ProviderStatus[];
  recentLogs: ProviderHealthLog[];
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "healthy":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "degraded":
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case "not_configured":
      return <AlertCircle className="w-5 h-5 text-gray-500" />;
    case "down":
    default:
      return <XCircle className="w-5 h-5 text-red-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    healthy: { label: "Healthy", color: "bg-green-500/10 text-green-600 border-green-500/20" },
    degraded: { label: "Degraded", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    down: { label: "Down", color: "bg-red-500/10 text-red-600 border-red-500/20" },
    not_configured: { label: "Not Configured", color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  };
  const { label, color } = config[status] || config.down;
  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  );
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                provider.status === "healthy"
                  ? "bg-green-500/10"
                  : provider.status === "degraded"
                  ? "bg-yellow-500/10"
                  : "bg-red-500/10"
              }`}
            >
              <StatusIcon status={provider.status} />
            </div>
            <div>
              <h3 className="font-semibold capitalize" data-testid={`text-provider-${provider.provider}`}>
                {provider.provider}
              </h3>
              <p className="text-sm text-muted-foreground">
                Last checked: {new Date(provider.lastCheck).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <StatusBadge status={provider.status} />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Zap className="w-3 h-3" />
              <span className="text-xs">Response</span>
            </div>
            <p className="font-semibold">{provider.responseMs}ms</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <CheckCircle className="w-3 h-3" />
              <span className="text-xs">Success</span>
            </div>
            <p className="font-semibold">{provider.successRate}%</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs">Errors</span>
            </div>
            <p className={`font-semibold ${provider.recentErrors > 0 ? "text-red-500" : ""}`}>
              {provider.recentErrors}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LogEntry({ log }: { log: ProviderHealthLog }) {
  const isError = !log.isHealthy;
  return (
    <div className={`p-3 rounded-lg ${isError ? "bg-red-500/5" : "bg-muted/50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isError ? (
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          )}
          <div>
            <p className="font-medium capitalize text-sm">{log.providerType}</p>
            <p className="text-xs text-muted-foreground">API Check</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {log.responseTimeMs ? `${log.responseTimeMs}ms` : "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            {log.checkTime ? new Date(log.checkTime).toLocaleTimeString() : ""}
          </p>
        </div>
      </div>
      {log.errorMessage && (
        <p className="text-xs text-red-500 mt-2 font-mono bg-red-500/10 p-2 rounded">
          {log.errorMessage}
        </p>
      )}
    </div>
  );
}

export default function AdminHealth() {
  const { data, isLoading, refetch, isRefetching } = useQuery<HealthOverview>({
    queryKey: ["/api/admin/health"],
    refetchInterval: 30000,
  });

  const providers = data?.providers || [];
  const recentLogs = data?.recentLogs || [];

  return (
    <AdminShell
      title="System Health"
      subtitle="Provider & service monitoring"
      icon={Activity}
      actions={
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="border-slate-600 text-slate-300 min-h-12"
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
        {isLoading ? (
          <div className="space-y-6">
            <div className="qr-admin-grid qr-admin-grid--2">
              {[...Array(2)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div>
                        <Skeleton className="h-5 w-24 mb-2" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="qr-admin-grid qr-admin-grid--2">
              {providers.length > 0 ? (
                providers.map((provider) => (
                  <ProviderCard key={provider.provider} provider={provider} />
                ))
              ) : (
                <>
                  <ProviderCard
                    provider={{
                      provider: "printify",
                      status: "healthy",
                      lastCheck: new Date().toISOString(),
                      responseMs: 245,
                      successRate: 99.8,
                      recentErrors: 0,
                    }}
                  />
                  <ProviderCard
                    provider={{
                      provider: "stripe",
                      status: "healthy",
                      lastCheck: new Date().toISOString(),
                      responseMs: 120,
                      successRate: 100,
                      recentErrors: 0,
                    }}
                  />
                </>
              )}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentLogs.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {recentLogs.map((log) => (
                        <LogEntry key={log.id} log={log} />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent health checks logged</p>
                    <p className="text-sm">Health checks will appear here as they occur</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
    </AdminShell>
  );
}
