import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, CloudOff, RefreshCw } from "lucide-react";

export type PublishStatus = "synced" | "pending" | "error" | "not-published" | "unknown";

interface PublishStatusBadgeProps {
  printifyProductId?: string | null;
  publishStatus?: "synced" | "pending" | "error" | null;
  lastPublishedAt?: string | null;
  publishError?: string | null;
  onRepublish?: () => void;
  isRepublishing?: boolean;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const value: any = iso;
    const date = value?.toDate?.() || new Date(typeof value === 'object' && (value.seconds ?? value._seconds) != null ? (value.seconds ?? value._seconds) * 1000 : value);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function resolveState(
  printifyProductId: string | null | undefined,
  publishStatus: "synced" | "pending" | "error" | null | undefined
): PublishStatus {
  if (!printifyProductId) return "not-published";
  if (publishStatus === "error") return "error";
  if (publishStatus === "pending") return "pending";
  return publishStatus === "synced" ? "synced" : "unknown";
}

export function PublishStatusBadge({
  printifyProductId,
  publishStatus,
  lastPublishedAt,
  publishError,
  onRepublish,
  isRepublishing,
}: PublishStatusBadgeProps) {
  const [showError, setShowError] = useState(false);
  const state = resolveState(printifyProductId, publishStatus);

  if (state === "unknown") return <Badge variant="outline" data-testid="status-publish-unknown">Sync status unavailable</Badge>;

  if (state === "not-published") {
    return (
      <Badge
        variant="outline"
        className="gap-1 text-xs text-muted-foreground border-muted-foreground/30"
        data-testid="status-publish-not-published"
      >
        <CloudOff className="w-2.5 h-2.5" />
        Not Published
      </Badge>
    );
  }

  if (state === "pending") {
    return (
      <Badge
        variant="outline"
        className="gap-1 text-xs text-amber-600 border-amber-400/50 dark:text-amber-400"
        data-testid="status-publish-pending"
      >
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Syncing
      </Badge>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); setShowError((v) => !v); }}
          className="min-h-12 text-left" aria-expanded={showError}
          data-testid="status-publish-error"
        >
          <Badge
            variant="outline"
            className="gap-1 text-xs text-destructive border-destructive/40 cursor-pointer"
          >
            <AlertCircle className="w-2.5 h-2.5" />
            Error
          </Badge>
        </button>
        {showError && publishError && (
          <p
            className="text-xs text-destructive leading-tight max-w-full [overflow-wrap:anywhere]"
            data-testid="text-publish-error-message"
          >
            {publishError}
          </p>
        )}
        {onRepublish && (
          <Button
            size="sm"
            variant="outline"
            className="h-12 text-sm px-4 gap-2"
            onClick={(e) => { e.stopPropagation(); onRepublish(); }}
            disabled={isRepublishing}
            data-testid="button-republish"
          >
            {isRepublishing ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <RefreshCw className="w-2.5 h-2.5" />
            )}
            Retry
          </Button>
        )}
      </div>
    );
  }

  const timestamp = formatTimestamp(lastPublishedAt);
  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant="outline"
        className="gap-1 text-xs text-emerald-600 border-emerald-400/50 dark:text-emerald-400"
        data-testid="status-publish-synced"
      >
        <CheckCircle2 className="w-2.5 h-2.5" />
        Synced
      </Badge>
      {timestamp && (
        <span className="text-xs text-muted-foreground leading-none pl-0.5" data-testid="text-publish-timestamp">
          {timestamp}
        </span>
      )}
    </div>
  );
}
