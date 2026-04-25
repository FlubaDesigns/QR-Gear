import { useState, useEffect, useCallback } from "react";
import { Archive, Loader2, Image, CheckCircle2, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";

interface SavedSession {
  id: string;
  status: 'artifact_ready' | 'committed' | 'working';
  draftName?: string | null;
  working?: { title?: string | null };
  generated?: {
    packetId?: string | null;
    previewImageUrl?: string | null;
  };
  updatedAt?: string | null;
  sourceMasterId?: string | null;
}

function relativeDate(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function SessionCard({
  session,
  onSelect,
  onDelete,
  isDeleting,
}: {
  session: SavedSession;
  onSelect: (s: SavedSession) => void;
  onDelete: (s: SavedSession, e: React.MouseEvent) => void;
  isDeleting: boolean;
}) {
  const title = session.draftName || session.working?.title || 'Untitled';
  const imageUrl = session.generated?.previewImageUrl;
  const isCommitted = session.status === 'committed';

  return (
    <Card
      className="overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onSelect(session)}
      data-testid={`load-saved-card-${session.id}`}
    >
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {session.generated?.packetId
              ? <Package className="h-10 w-10 opacity-40" />
              : <Image className="h-10 w-10 opacity-40" />
            }
          </div>
        )}
        <div className="absolute top-2 right-2">
          {isCommitted ? (
            <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          ) : (
            <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              <Package className="h-3 w-3 mr-1" />
              Has Packet
            </Badge>
          )}
        </div>
        <button
          type="button"
          className="absolute top-2 left-2 p-1 rounded-md bg-background/80 hover-elevate text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
          onClick={(e) => onDelete(session, e)}
          disabled={isDeleting}
          data-testid={`button-delete-saved-${session.id}`}
        >
          {isDeleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />
          }
        </button>
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="font-medium text-sm truncate" data-testid="text-saved-session-name">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">
          {relativeDate(session.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );
}

interface LoadSavedModuleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideCard?: boolean;
}

export function LoadSavedModule({ open: externalOpen, onOpenChange: onExternalOpenChange, hideCard }: LoadSavedModuleProps = {}) {
  const { toast } = useToast();

  const controlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? externalOpen! : internalOpen;

  const setOpen = (v: boolean) => {
    if (!controlled) setInternalOpen(v);
    if (onExternalOpenChange) onExternalOpenChange(v);
  };

  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ sessions: SavedSession[] }>("/build-sessions");
      const all: SavedSession[] = data.sessions || [];
      const relevant = all
        .filter(s => s.status === 'artifact_ready' || s.status === 'committed')
        .sort((a, b) => {
          const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bt - at;
        });
      setSessions(relevant);
    } catch {
      toast({ title: 'Could not load saved builds', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) fetchSessions();
  }, [open, fetchSessions]);

  const handleSelect = useCallback((session: SavedSession) => {
    setSelecting(true);
    window.location.href = `/admin/products?resume=${session.id}`;
  }, []);

  const handleDelete = useCallback(async (session: SavedSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const label = session.draftName || session.working?.title || 'Untitled';
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setDeletingId(session.id);
    try {
      await adminFetch(`/build-sessions/${session.id}`, { method: "DELETE" });
      setSessions(prev => prev.filter(s => s.id !== session.id));
      toast({ title: 'Draft deleted' });
    } catch {
      toast({ title: 'Could not delete draft', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }, [toast]);

  return (
    <>
      {!hideCard && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/40 rounded-md border">
          <div className="flex items-center gap-2 min-w-0">
            <Archive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Resume a saved build</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                Pick up any item that already has a packet or was saved
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="default"
            onClick={() => setOpen(true)}
            data-testid="button-load-saved"
            className="w-full sm:w-auto flex-shrink-0"
          >
            <Archive className="h-4 w-4 mr-2" />
            Load Saved
          </Button>
        </div>
      )}

      <ModalView
        open={open}
        onOpenChange={setOpen}
        title="Resume a Saved Build"
        maxWidth="sm:max-w-2xl"
        className="max-sm:!fixed max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:!top-auto max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!w-full max-sm:!max-w-full max-sm:!rounded-t-2xl max-sm:!rounded-b-none max-sm:!h-[88svh] max-sm:!max-h-[88svh]"
      >
        <div className="p-4 overflow-y-auto h-full">
          {loading ? (
            <div className="flex items-center justify-center py-16" data-testid="loader-saved-picker">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No saved builds yet.</p>
              <p className="text-xs mt-1">Create a packet and save it to see it here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sessions.map(s => (
                <div key={s.id} className="relative">
                  {selecting && deletingId !== s.id && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                  <SessionCard
                    session={s}
                    onSelect={handleSelect}
                    onDelete={handleDelete}
                    isDeleting={deletingId === s.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalView>
    </>
  );
}
