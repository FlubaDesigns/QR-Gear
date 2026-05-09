import { useState, useEffect, useCallback } from "react";
import { Layers, Loader2, QrCode, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";

const QR_LABEL: Record<string, string> = {
  qr_canvas: "QR Canvas",
  qr_basics: "QR Basics",
  qr_plus: "QR Plus",
  qr_play: "QR Play",
  qr_compose: "QR Compose",
};

const LAYOUT_LABEL: Record<string, string> = {
  zone: "Zone",
  freeform: "Freeform",
  Z: "Zone",
  P: "Freeform",
};

function relativeDate(date: string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

interface BldDef {
  id: string;
  bldId: string;
  graphicLayoutMode?: string;
  layoutMode?: string;
  qrProductState?: string | null;
  qrSizePercent?: number;
  instanceCount?: number;
  qrgBlankId?: string | null;
  source?: string;
  createdAt?: string;
  name?: string;
}

function BldCard({
  def,
  onSelect,
  selecting,
}: {
  def: BldDef;
  onSelect: (d: BldDef) => void;
  selecting: boolean;
}) {
  const layoutRaw = def.graphicLayoutMode || def.layoutMode || "";
  const layoutLabel = LAYOUT_LABEL[layoutRaw] || layoutRaw || "—";
  const qrLabel = def.qrProductState ? (QR_LABEL[def.qrProductState] ?? def.qrProductState) : null;
  const instanceCount = def.instanceCount ?? 0;
  const blank = def.qrgBlankId || null;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onSelect(def)}
      data-testid={`card-bld-pick-${def.id}`}
    >
      <div className="flex items-center justify-center aspect-square bg-muted relative">
        {selecting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        <LayoutTemplate className="h-10 w-10 opacity-30 text-muted-foreground" />
        <div className="absolute top-2 right-2">
          <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
            {layoutLabel}
          </Badge>
        </div>
        {qrLabel && (
          <div className="absolute bottom-2 left-2">
            <Badge variant="outline" className="text-xs">
              <QrCode className="h-2.5 w-2.5 mr-1" />
              {qrLabel}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="font-mono text-xs font-semibold truncate" data-testid="text-bld-pick-id">
          {def.bldId}
        </p>
        {def.name && def.name !== def.bldId && (
          <p className="text-xs text-muted-foreground truncate">{def.name}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {instanceCount} layer{instanceCount !== 1 ? "s" : ""}
          </span>
          {blank && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[80px]">
              {blank}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{relativeDate(def.createdAt)}</p>
      </CardContent>
    </Card>
  );
}

interface LoadBldModuleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideCard?: boolean;
}

export function LoadBldModule({
  open: externalOpen,
  onOpenChange: onExternalOpenChange,
  hideCard,
}: LoadBldModuleProps = {}) {
  const { toast } = useToast();

  const controlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? externalOpen! : internalOpen;

  const setOpen = (v: boolean) => {
    if (!controlled) setInternalOpen(v);
    if (onExternalOpenChange) onExternalOpenChange(v);
  };

  const [defs, setDefs] = useState<BldDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const fetchDefs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ definitions: BldDef[] }>("/bld");
      const all: BldDef[] = data.definitions || [];
      const builderOnly = all
        .filter((d) => d.source === "builder")
        .sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        });
      setDefs(builderOnly);
    } catch {
      toast({ title: "Could not load saved styles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) fetchDefs();
  }, [open, fetchDefs]);

  const handleSelect = useCallback((def: BldDef) => {
    setSelecting(true);
    window.location.href = `/admin/products?bld=${encodeURIComponent(def.bldId)}`;
  }, []);

  return (
    <>
      {!hideCard && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/40 rounded-md border">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Start from a saved style</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                Pick a builder-generated design, then choose any product blank
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="default"
            onClick={() => setOpen(true)}
            data-testid="button-load-bld"
            className="w-full sm:w-auto flex-shrink-0"
          >
            <Layers className="h-4 w-4 mr-2" />
            Saved Styles
          </Button>
        </div>
      )}

      <ModalView
        open={open}
        onOpenChange={setOpen}
        title="Start from a Saved Style"
        maxWidth="sm:max-w-2xl"
        className="max-sm:!fixed max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:!top-auto max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!w-full max-sm:!max-w-full max-sm:!rounded-t-2xl max-sm:!rounded-b-none max-sm:!h-[88svh] max-sm:!max-h-[88svh]"
      >
        <div className="p-4 overflow-y-auto h-full">
          <p className="text-xs text-muted-foreground mb-4">
            Pick a saved build style. The builder will open pre-filled with that style's layout, fonts, and QR settings — then you choose any product blank to apply it to.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-16" data-testid="loader-bld-picker">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : defs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No saved build styles yet.</p>
              <p className="text-xs mt-1">Complete a build and commit it to save its style here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {defs.map((d) => (
                <BldCard
                  key={d.id}
                  def={d}
                  onSelect={handleSelect}
                  selecting={selecting}
                />
              ))}
            </div>
          )}
        </div>
      </ModalView>
    </>
  );
}
