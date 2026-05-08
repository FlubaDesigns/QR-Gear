import { Trash2, Image, Crop, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CardSkinProps, DetailSkinProps } from "./types";

// VVS Skin: BackgroundSkin
// Layer: Skin — owns ALL knobs and controls for the Background data type.
// Card variant: renders inside ScrollGridView.
// Detail variant: renders inside the popup overlay.

// ── Card ─────────────────────────────────────────────────────────────────────

export function BackgroundCardSkin({ item, onClick, actions, isActionPending }: CardSkinProps) {
  const handleCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onCrop?.(item.id);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  return (
    <Card
      className="cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-background-${item.id}`}
    >
      <div className="relative aspect-square bg-muted rounded-t-md overflow-hidden">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid={`img-background-${item.id}`}
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
          data-testid={`text-background-name-${item.id}`}
        >
          {item.name}
        </p>

        <div className="flex gap-1">
          {actions?.onCrop && (
            <Button
              size="icon"
              variant="outline"
              className="flex-1"
              onClick={handleCrop}
              disabled={isActionPending}
              data-testid={`button-crop-${item.id}`}
              title="Crop (9:16)"
            >
              <Crop className="h-3 w-3" />
            </Button>
          )}
          {actions?.onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="flex-1 text-destructive"
              onClick={handleArchive}
              disabled={isActionPending}
              data-testid={`button-archive-${item.id}`}
              title="Archive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Detail (popup content) ────────────────────────────────────────────────────

export function BackgroundDetailSkin({ item, actions, onClose, isActionPending }: DetailSkinProps) {
  const raw         = item.metadata?.raw as Record<string, unknown> | undefined;
  const grfId       = raw?.grfId       as string | undefined;
  const sourceGrfId = raw?.sourceGrfId as string | undefined;
  const mimeType    = raw?.mimeType    as string | undefined;

  const handleCrop = () => {
    actions?.onCrop?.(item.id);
  };

  const handleArchive = () => {
    actions?.onDelete?.(item.id);
  };

  return (
    <div className="space-y-4 w-full">

      {/* Large image preview */}
      <div className="relative w-full aspect-square bg-muted rounded-md overflow-hidden">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-contain"
            data-testid="img-background-detail"
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
          data-testid="text-background-detail-name"
        >
          {item.name}
        </p>
        <div className="flex flex-wrap gap-1 pt-1">
          {mimeType && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-background-mimetype">
              {mimeType}
            </Badge>
          )}
          {grfId && (
            <Badge variant="outline" className="text-xs font-mono" data-testid="badge-background-grfid">
              {grfId}
            </Badge>
          )}
          {sourceGrfId && (
            <Badge variant="outline" className="text-xs font-mono text-muted-foreground" data-testid="badge-background-source">
              src: {sourceGrfId}
            </Badge>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {actions?.onCrop && (
          <Button
            variant="default"
            className="flex-1"
            onClick={handleCrop}
            disabled={isActionPending}
            data-testid="button-detail-crop"
          >
            <Crop className="h-4 w-4 mr-2" />
            Crop (9:16)
          </Button>
        )}
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
      </div>

      {onClose && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onClose}
          data-testid="button-detail-close"
        >
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      )}

    </div>
  );
}
