import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Hash, Trash2, Loader2, X, Store, AlertTriangle } from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";

interface ChannelRow {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  storeExists: boolean;
  productCount?: number;
  isActive?: boolean;
  createdAt?: string;
}

function DeleteConfirm({
  label,
  onConfirm,
  onCancel,
  isPending,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
      <span className="text-xs text-red-300 flex-1">Delete &ldquo;{label}&rdquo;?</span>
      <button
        onClick={onConfirm}
        disabled={isPending}
        className="qr-btn qr-btn--touch text-xs px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded"
        data-testid="button-confirm-del-channel"
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
      </button>
      <button
        onClick={onCancel}
        className="qr-btn qr-btn--ghost qr-btn--touch p-1"
        data-testid="button-cancel-del-channel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AllChannelsManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: channels = [], isLoading } = useQuery<ChannelRow[]>({
    queryKey: ["all-channels"],
    queryFn: () => adminFetch<ChannelRow[]>("/channels"),
  });

  const deleteMutation = useMutation({
    mutationFn: (channelId: string) =>
      adminFetch(`/channels/${channelId}`, { method: "DELETE" }),
    onSuccess: (_, channelId) => {
      toast({ title: "Channel deleted" });
      setConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ["all-channels"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: () => toast({ title: "Error", description: "Could not delete channel.", variant: "destructive" }),
  });

  const orphaned = channels.filter(c => !c.storeExists);
  const active = channels.filter(c => c.storeExists);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
        <Hash className="h-9 w-9" />
        <p className="text-sm">No channels found</p>
      </div>
    );
  }

  const renderRow = (ch: ChannelRow) => (
    <div key={ch.id} className="glass-card p-3" data-testid={`row-channel-${ch.id}`}>
      {confirmId === ch.id ? (
        <DeleteConfirm
          label={ch.name}
          onConfirm={() => deleteMutation.mutate(ch.id)}
          onCancel={() => setConfirmId(null)}
          isPending={deleteMutation.isPending}
        />
      ) : (
        <div className="flex items-center gap-3">
          <Hash className="h-4 w-4 text-white/40 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="glass-body text-sm font-medium truncate" data-testid={`text-channel-name-${ch.id}`}>
              {ch.name}
              <span className="ml-2 text-[11px] font-mono text-white/30">{ch.id}</span>
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Store className="h-3 w-3 text-white/30 flex-shrink-0" />
              <span className={`text-xs ${ch.storeExists ? "glass-subtitle" : "text-amber-400/70"}`}>
                {ch.storeName}
              </span>
              {!ch.storeExists && (
                <span className="flex items-center gap-1 text-xs text-amber-400/70">
                  <AlertTriangle className="h-3 w-3" /> orphaned
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setConfirmId(ch.id)}
            className="p-1.5 text-white/25 hover-elevate rounded flex-shrink-0"
            data-testid={`button-delete-channel-${ch.id}`}
            title="Delete channel"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {orphaned.length > 0 && (
        <div className="space-y-2">
          <p className="glass-subtitle text-xs uppercase tracking-wider flex items-center gap-2 px-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400/70" />
            Orphaned channels
            <span className="normal-case opacity-60">({orphaned.length}) — store no longer exists</span>
          </p>
          {orphaned.map(renderRow)}
        </div>
      )}

      <div className="space-y-2">
        <p className="glass-subtitle text-xs uppercase tracking-wider px-1">
          Active channels
          <span className="normal-case opacity-60 ml-2">({active.length})</span>
        </p>
        {active.length === 0 ? (
          <p className="text-xs text-white/25 italic px-1 py-2">None</p>
        ) : (
          active.map(renderRow)
        )}
      </div>
    </div>
  );
}
