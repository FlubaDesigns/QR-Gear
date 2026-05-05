import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Layers, ImageIcon, X, ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { adminFetch } from "@/lib/adminFetch";

interface GraphicAsset {
  id: string;
  grfId: string;
  name: string;
  description?: string | null;
  publicUrl: string;
  mimeType?: string | null;
  storagePath?: string | null;
  typeCode?: string | null;
  typeName?: string | null;
  roleCode?: string | null;
  sourceGrfId?: string | null;
  tags?: string[] | null;
  createdAt?: string | null;
  createdBy?: string | null;
  isActive?: boolean;
}

const TYPE_CODE_LABELS: Record<string, string> = {
  '01': 'Source',
  '02': 'Cropped',
  '03': 'Background',
  '04': 'QR Graphic',
  '05': 'Canvas Design',
  '06': 'URL Artifact',
  '07': 'Template',
};

const ROLE_CODE_LABELS: Record<string, string> = {
  '1': 'Source',
  '2': 'Derivative',
  '3': 'Renderable',
  '4': 'Final',
  '5': 'Template',
};

function GraphicCard({
  asset,
  onClick,
  onArchive,
}: {
  asset: GraphicAsset;
  onClick: () => void;
  onArchive: (id: string) => void;
}) {
  const typeLabel = asset.typeCode
    ? (TYPE_CODE_LABELS[asset.typeCode] ?? asset.typeName ?? 'Graphic')
    : (asset.typeName ?? 'Graphic');

  return (
    <div
      className="group relative cursor-pointer rounded-md overflow-hidden border bg-card hover-elevate transition-all"
      onClick={onClick}
      data-testid={`card-graphic-${asset.id}`}
    >
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {asset.publicUrl ? (
          <img
            src={asset.publicUrl}
            alt={asset.name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="h-10 w-10 text-muted-foreground opacity-40" />
        )}
      </div>

      {asset.grfId && (
        <div className="absolute top-1.5 left-1.5">
          <Badge className="text-xs font-mono px-1.5 py-0.5 bg-background/90 text-foreground border">
            {asset.grfId}
          </Badge>
        </div>
      )}

      <button
        type="button"
        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-background/80 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors invisible group-hover:visible"
        onClick={(e) => { e.stopPropagation(); onArchive(asset.id); }}
        data-testid={`button-archive-graphic-${asset.id}`}
        title="Archive"
        aria-label="Archive graphic"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="p-2 space-y-0.5">
        <p className="text-xs font-medium truncate" title={asset.name} data-testid={`text-graphic-name-${asset.id}`}>
          {asset.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {typeLabel}
          {asset.roleCode && (
            <span className="ml-1 opacity-70">
              · {ROLE_CODE_LABELS[asset.roleCode] ?? asset.roleCode}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function GraphicDetailPanel({
  asset,
  onArchive,
  isArchiving,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  asset: GraphicAsset;
  onArchive: () => void;
  isArchiving: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const typeLabel = asset.typeCode
    ? (TYPE_CODE_LABELS[asset.typeCode] ?? asset.typeName ?? 'Graphic')
    : (asset.typeName ?? 'Graphic');

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" data-testid="text-detail-graphic-name">{asset.name}</p>
          {asset.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{asset.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
          {asset.roleCode && (
            <Badge variant="outline" className="text-xs">
              {ROLE_CODE_LABELS[asset.roleCode] ?? asset.roleCode}
            </Badge>
          )}
        </div>
      </div>

      {asset.grfId && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Tag className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-mono select-all" data-testid="text-detail-graphic-id">{asset.grfId}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            disabled={!hasPrev}
            data-testid="button-detail-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={!hasNext}
            data-testid="button-detail-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onArchive}
            disabled={isArchiving}
            data-testid="button-detail-archive"
          >
            {isArchiving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Archive
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-detail-close">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function GraphicsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: assets = [], isLoading } = useQuery<GraphicAsset[]>({
    queryKey: ["library", "/api/admin", "assets", "grf"],
    queryFn: () => adminFetch<GraphicAsset[]>("/graphics"),
  });

  const archiveMutation = useMutation({
    mutationFn: (grfId: string) =>
      adminFetch(`/graphics/${grfId}/archive`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", "/api/admin", "assets", "grf"] });
      setSelectedIndex(null);
      toast({ title: "Archived", description: "Graphic removed from library" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive graphic", variant: "destructive" });
    },
  });

  const selectedAsset = selectedIndex !== null ? assets[selectedIndex] : null;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < assets.length - 1;

  const handlePrev = () => { if (hasPrev) setSelectedIndex(selectedIndex! - 1); };
  const handleNext = () => { if (hasNext) setSelectedIndex(selectedIndex! + 1); };
  const handleClose = () => setSelectedIndex(null);

  const handleArchive = (id: string) => {
    archiveMutation.mutate(id);
    setShowConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-graphics">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg">
        <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground text-sm" data-testid="text-no-graphics">
          No graphics saved yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use "Save to Library" in the Products Builder to add graphics here.
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollGridView
        items={assets.map((a) => ({ id: a.id, name: a.name }))}
        columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        height="auto"
        emptyMessage="No graphics to display."
        emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
        footer={null}
        renderItem={(_, index) => (
          <GraphicCard
            asset={assets[index]}
            onClick={() => setSelectedIndex(index)}
            onArchive={(id) => { setSelectedIndex(index); setShowConfirm(true); void id; }}
          />
        )}
      />

      <ModalView
        open={selectedIndex !== null}
        onOpenChange={(open) => !open && handleClose()}
        title={selectedAsset?.name ?? "Graphic Preview"}
        showCloseButton={false}
      >
        <div className="relative">
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70"
            onClick={handleClose}
            data-testid="button-gallery-close"
          >
            <X className="h-5 w-5 text-white" />
          </Button>

          <div className="relative aspect-square sm:aspect-video bg-muted flex items-center justify-center overflow-hidden">
            {selectedAsset?.publicUrl ? (
              <img
                src={selectedAsset.publicUrl}
                alt={selectedAsset.name}
                className="max-w-full max-h-full object-contain"
                data-testid="img-gallery-preview"
              />
            ) : (
              <ImageIcon className="h-24 w-24 text-muted-foreground" />
            )}

            {hasPrev && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2"
                onClick={handlePrev}
                data-testid="button-gallery-prev"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {hasNext && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={handleNext}
                data-testid="button-gallery-next"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {(selectedIndex ?? 0) + 1} / {assets.length}
            </div>
          </div>

          {selectedAsset && (
            <GraphicDetailPanel
              asset={selectedAsset}
              onArchive={() => setShowConfirm(true)}
              isArchiving={archiveMutation.isPending}
              onClose={handleClose}
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          )}
        </div>
      </ModalView>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this graphic?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the graphic from your library. The underlying image file is not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAsset && handleArchive(selectedAsset.id)}
              data-testid="button-confirm-action"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
