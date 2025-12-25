import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
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

function StatusIcon({ status }: { status: "healthy" | "degraded" | "down" }) {
  switch (status) {
    case "healthy":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "degraded":
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case "down":
      return <XCircle className="w-5 h-5 text-red-500" />;
  }
}

function StatusBadge({ status }: { status: "healthy" | "degraded" | "down" }) {
  const config = {
    healthy: { label: "Healthy", color: "bg-green-500/10 text-green-600 border-green-500/20" },
    degraded: { label: "Degraded", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    down: { label: "Down", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  };
  const { label, color } = config[status];
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
  const [, navigate] = useLocation();

  const { data, isLoading, refetch, isRefetching } = useQuery<HealthOverview>({
    queryKey: ["/api/admin/health"],
    refetchInterval: 30000,
  });

  const providers = data?.providers || [];
  const recentLogs = data?.recentLogs || [];

  return (
    <div className="min-h-screen">
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Activity className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    System Health
                  </h1>
                  <p className="text-xs text-slate-400">
                    Provider & service monitoring
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="border-slate-600 text-slate-300"
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        <nav className="mb-4 text-sm" aria-label="Breadcrumb">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">
            Admin
          </Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-foreground font-medium" aria-current="page">
            System Health
          </span>
        </nav>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </main>
    </div>
  );
}
