import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, AlertCircle, ChevronRight, Info, RefreshCw, Loader2, CheckCircle } from "lucide-react";

interface QueueItem {
  id: string;
  title: string;
  reason: string;
  priority: "critical" | "important" | "next" | "optional";
  category: "system" | "email" | "marketplace" | "sell" | "banking" | "place";
  href: string;
  count?: number;
}

interface QueueResponse {
  items: QueueItem[];
  generatedAt: string;
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
    dotClass: "bg-red-500",
  },
  important: {
    label: "Important",
    icon: AlertCircle,
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dotClass: "bg-amber-500",
  },
  next: {
    label: "Next",
    icon: ChevronRight,
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    dotClass: "bg-blue-500",
  },
  optional: {
    label: "Optional",
    icon: Info,
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  system: "System",
  email: "Email",
  marketplace: "Marketplace",
  sell: "Sell",
  banking: "Banking",
  place: "Place",
};

// ─── Queue card ───────────────────────────────────────────────────────────────

function QueueCard({ item }: { item: QueueItem }) {
  const [, navigate] = useLocation();
  const cfg = PRIORITY_CONFIG[item.priority];
  const Icon = cfg.icon;

  return (
    <button
      type="button"
      className="w-full min-h-[64px] text-left flex items-start gap-3 p-3 rounded-md bg-card border border-border hover-elevate active-elevate-2 cursor-pointer"
      onClick={() => navigate(item.href)}
      data-testid={`queue-item-${item.id}`}
    >
      <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      <span className="flex-1 min-w-0">
        <span className="flex items-start justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium leading-snug">{item.title}</span>
          <span className="flex items-center gap-1.5 flex-shrink-0">
            {item.count !== undefined && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                {item.count}
              </Badge>
            )}
            <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${cfg.badgeClass}`}>
              <Icon className="w-2.5 h-2.5 mr-1" />
              {cfg.label}
            </Badge>
          </span>
        </span>
        <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{item.reason}</span>
        <span className="text-xs text-muted-foreground/60 mt-1 inline-block">
          {CATEGORY_LABELS[item.category]}
        </span>
      </span>
    </button>
  );
}

// ─── Priority queue section ───────────────────────────────────────────────────

export default function PriorityQueue() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery<QueueResponse>({
    queryKey: ["/api/admin/dashboard/queue"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/queue");
      const response = await res.json();
      if (!Array.isArray(response?.items)) throw new Error("Invalid to-do list response.");
      return response;
    },
    staleTime: 60 * 1000,
  });

  const items = data?.items ?? [];
  const criticalCount = items.filter((i) => i.priority === "critical").length;

  return (
    <div className="space-y-2" data-testid="section-priority-queue">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">To-Do List</h2>
          {criticalCount > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs px-1.5 py-0 h-5">
              {criticalCount} critical
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          className="h-12 min-w-12"
          aria-label="Refresh to-do list"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          data-testid="button-refresh-queue"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
          Could not load your to-do list: {(error as Error).message}
          <Button variant="outline" className="mt-3 min-h-12 block" onClick={() => refetch()} disabled={isRefetching}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking system signals…
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 p-3 rounded-md bg-card border border-border">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-muted-foreground">All clear — no items need attention right now.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <QueueCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {data?.generatedAt && (
        <p className="text-xs text-muted-foreground/50">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

