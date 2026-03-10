import { useQuery, useMutation } from "@tanstack/react-query";
import AdminShell from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Clock,
  Send,
  Inbox,
  AlertTriangle,
  Play,
  RotateCcw,
  Pause,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NexusMailStatus {
  ready: boolean;
  provider: string;
  health: {
    score: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
    consecutiveFailures: number;
    isPaused: boolean;
  };
  outboxStats: {
    queued: number;
    sending: number;
    sent: number;
    failed: number;
    dead: number;
  };
}

interface OutboxRecord {
  id: string;
  to: string;
  subject: string;
  templateSlug: string;
  status: string;
  createdAt: any;
  sentAt?: any;
  retryCount: number;
  lastError?: string;
}

function HealthStatusBadge({ status, isPaused }: { status: string; isPaused?: boolean }) {
  if (isPaused) {
    return (
      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
        <Pause className="w-3 h-3 mr-1" />
        Paused
      </Badge>
    );
  }
  
  const config: Record<string, { label: string; color: string }> = {
    healthy: { label: "Healthy", color: "bg-green-500/10 text-green-600 border-green-500/20" },
    degraded: { label: "Degraded", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    unhealthy: { label: "Unhealthy", color: "bg-red-500/10 text-red-600 border-red-500/20" },
    not_configured: { label: "Not Configured", color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  };
  const { label, color } = config[status] || config.unhealthy;
  return <Badge variant="outline" className={color}>{label}</Badge>;
}

function OutboxStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string }> = {
    queued: { color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    sending: { color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    sent: { color: "bg-green-500/10 text-green-600 border-green-500/20" },
    failed: { color: "bg-red-500/10 text-red-600 border-red-500/20" },
    dead: { color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  };
  const { color } = config[status] || config.queued;
  return <Badge variant="outline" className={color}>{status}</Badge>;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className={`p-4 rounded-lg ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function AdminEmailHealth() {
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<NexusMailStatus>({
    queryKey: ["/api/admin/nexusmail/status"],
    refetchInterval: 30000,
  });

  const { data: outboxData, isLoading: outboxLoading, refetch: refetchOutbox } = useQuery<{ records: OutboxRecord[] }>({
    queryKey: ["/api/admin/nexusmail/outbox"],
  });

  const processOutboxMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/nexusmail/process-outbox", { limit: 10 });
    },
    onSuccess: () => {
      toast({ title: "Processing outbox", description: "Queued emails are being sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nexusmail/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nexusmail/outbox"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const retryFailedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/nexusmail/retry-failed", { limit: 10 });
    },
    onSuccess: () => {
      toast({ title: "Retrying failed emails", description: "Failed emails are being retried" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nexusmail/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nexusmail/outbox"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const seedTemplatesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/nexusmail/seed-templates");
    },
    onSuccess: () => {
      toast({ title: "Templates seeded", description: "Default email templates have been created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = statusLoading || outboxLoading;
  const records = outboxData?.records || [];
  const stats = status?.outboxStats || { queued: 0, sending: 0, sent: 0, failed: 0, dead: 0 };

  const handleRefresh = () => {
    refetchStatus();
    refetchOutbox();
  };

  return (
    <AdminShell
      title="Email System Health"
      subtitle="NexusMail monitoring & controls"
      icon={Mail}
      actions={
        <Button
          variant="outline"
          onClick={handleRefresh}
          className="min-h-12"
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      }
    >
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Provider Status
                  </CardTitle>
                  <HealthStatusBadge 
                    status={status?.ready ? status.health.status : 'not_configured'} 
                    isPaused={status?.health?.isPaused}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <p className="font-semibold capitalize">{status?.provider || 'Not configured'}</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Health Score</p>
                    <p className="font-semibold">{status?.health?.score?.toFixed(0) || 0}%</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Consecutive Failures</p>
                    <p className={`font-semibold ${(status?.health?.consecutiveFailures || 0) > 0 ? 'text-red-500' : ''}`}>
                      {status?.health?.consecutiveFailures || 0}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold">{status?.ready ? 'Ready' : 'Not Ready'}</p>
                  </div>
                </div>

                {!status?.ready && (
                  <div className="mt-4 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-600">Email provider not configured</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Set QR_RESEND_API_KEY in your environment variables to enable email sending.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => seedTemplatesMutation.mutate()}
                          disabled={seedTemplatesMutation.isPending}
                          data-testid="button-seed-templates"
                        >
                          Seed Default Templates
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  Outbox Queue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <StatCard icon={Clock} label="Queued" value={stats.queued} color="bg-blue-500/10 text-blue-600" />
                  <StatCard icon={Send} label="Sending" value={stats.sending} color="bg-yellow-500/10 text-yellow-600" />
                  <StatCard icon={CheckCircle} label="Sent" value={stats.sent} color="bg-green-500/10 text-green-600" />
                  <StatCard icon={AlertCircle} label="Failed" value={stats.failed} color="bg-red-500/10 text-red-600" />
                  <StatCard icon={XCircle} label="Dead" value={stats.dead} color="bg-gray-500/10 text-gray-500" />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => processOutboxMutation.mutate()}
                    disabled={processOutboxMutation.isPending || stats.queued === 0}
                    data-testid="button-process-outbox"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Process Queue ({stats.queued})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryFailedMutation.mutate()}
                    disabled={retryFailedMutation.isPending || stats.failed === 0}
                    data-testid="button-retry-failed"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Retry Failed ({stats.failed})
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Emails
                </CardTitle>
              </CardHeader>
              <CardContent>
                {records.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {records.map((record) => (
                        <div key={record.id} className="p-3 rounded-lg bg-muted/50 border">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <OutboxStatusBadge status={record.status} />
                                <span className="text-xs text-muted-foreground truncate">
                                  {record.templateSlug}
                                </span>
                              </div>
                              <p className="font-medium text-sm truncate">{record.subject}</p>
                              <p className="text-xs text-muted-foreground truncate">{record.to}</p>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              {record.createdAt && (
                                <p>{new Date(record.createdAt._seconds ? record.createdAt._seconds * 1000 : record.createdAt).toLocaleString()}</p>
                              )}
                              {record.retryCount > 0 && (
                                <p className="text-orange-500">Retries: {record.retryCount}</p>
                              )}
                            </div>
                          </div>
                          {record.lastError && (
                            <p className="text-xs text-red-500 mt-2 font-mono bg-red-500/10 p-2 rounded truncate">
                              {record.lastError}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No emails in outbox</p>
                    <p className="text-sm">Emails will appear here when triggered</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
    </AdminShell>
  );
}
