import { useState, useEffect, useCallback } from "react";
import { Archive, Loader2, Image, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
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
}: {
  session: SavedSession;
  onSelect: (s: SavedSession) => void;
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

export function LoadSavedModule() {
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/build-sessions`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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
  }, [apiBase, getAuthHeaders, toast]);

  useEffect(() => {
    if (open) fetchSessions();
  }, [open, fetchSessions]);

  const handleSelect = useCallback((session: SavedSession) => {
    setSelecting(true);
    // Full page reload so DraftResumeHandler picks up the ?resume= param fresh
    window.location.href = `/admin/products?resume=${session.id}`;
  }, []);

  return (
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

      <ModalView open={open} onOpenChange={setOpen} title="Resume a Saved Build">
        <div className="p-4">
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
                  {selecting && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                  <SessionCard session={s} onSelect={handleSelect} />
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalView>
    </div>
  );
}
