import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Image, X } from "lucide-react";
import type { CardSkinProps, DetailSkinProps } from "./types";

// VVS Skin: CroppedImageSkin
// Layer: Skin — owns ALL knobs and controls for the Cropped data type.
// Card variant: renders inside ScrollGridView.
// Detail variant: renders inside the popup overlay.

// ── Card ─────────────────────────────────────────────────────────────────────

export function CroppedCardSkin({ item, onClick, actions, isActionPending }: CardSkinProps) {
  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  return (
    <Card
      className="cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-cropped-${item.id}`}
    >
      <div className="relative aspect-[9/16] bg-muted rounded-t-md overflow-hidden">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid={`img-cropped-${item.id}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-10 w-10" />
          </div>
        )}
      </div>

      <CardContent className="p-2 space-y-2">
        <p
          className="text-xs truncate font-medium leading-tight"
          title={item.name}
          data-testid={`text-cropped-name-${item.id}`}
        >
          {item.name}
        </p>

        {actions?.onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="w-full text-destructive"
            onClick={handleArchive}
            disabled={isActionPending}
            data-testid={`button-archive-${item.id}`}
            title="Archive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Detail (popup content) ────────────────────────────────────────────────────

export function CroppedDetailSkin({ item, actions, onClose, isActionPending }: DetailSkinProps) {
  const raw          = item.metadata?.raw as Record<string, unknown> | undefined;
  const grfId        = raw?.grfId        as string | undefined;
  const sourceGrfId  = raw?.sourceGrfId  as string | undefined;
  const mimeType     = raw?.mimeType     as string | undefined;

  const handleArchive = () => {
    actions?.onDelete?.(item.id);
  };

  return (
    <div className="space-y-4 w-full">

      {/* Large image preview */}
      <div className="relative w-full aspect-[9/16] bg-muted rounded-md overflow-hidden">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-contain"
            data-testid="img-cropped-detail"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-16 w-16" />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-1">
        <p
          className="font-semibold text-sm leading-tight"
          data-testid="text-cropped-detail-name"
        >
          {item.name}
        </p>
        <div className="flex flex-wrap gap-1 pt-1">
          {mimeType && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-cropped-mimetype">
              {mimeType}
            </Badge>
          )}
          {grfId && (
            <Badge variant="outline" className="text-xs font-mono" data-testid="badge-cropped-grfid">
              {grfId}
            </Badge>
          )}
          {sourceGrfId && (
            <Badge variant="outline" className="text-xs font-mono text-muted-foreground" data-testid="badge-cropped-source">
              src: {sourceGrfId}
            </Badge>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {actions?.onDelete && (
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleArchive}
            disabled={isActionPending}
            data-testid="button-detail-archive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Archive
          </Button>
        )}
        {onClose && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            data-testid="button-detail-close"
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        )}
      </div>

    </div>
  );
}
