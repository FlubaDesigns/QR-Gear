import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crop, Trash2, Image } from "lucide-react";
import type { CardSkinProps, DetailSkinProps } from "./types";

// ── Card skin (VVS: shown in ScrollGridView) ──────────────────────────────────

export function SourceImageCardSkin({ item, onClick, actions }: CardSkinProps) {
  const handleCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onCrop?.(item.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  return (
    <Card
      className="cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-source-${item.id}`}
    >
      {/* Image container — clipping lives here, not on Card */}
      <div className="relative aspect-square bg-muted rounded-t-md overflow-hidden">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid={`img-source-${item.id}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-10 w-10" />
          </div>
        )}
        {item.dimensions && (
          <Badge variant="secondary" className="absolute top-1 right-1 text-xs">
            {item.dimensions}
          </Badge>
        )}
      </div>

      <CardContent className="p-2 space-y-2">
        <p
          className="text-xs truncate font-medium leading-tight"
          title={item.name}
          data-testid={`text-source-name-${item.id}`}
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
              data-testid={`button-crop-${item.id}`}
              title="Crop"
            >
              <Crop className="h-3 w-3" />
            </Button>
          )}
          {actions?.onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="flex-1 text-destructive"
              onClick={handleDelete}
              data-testid={`button-delete-${item.id}`}
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

// ── Detail skin (VVS: shown inside ItemModalView / popup) ─────────────────────

export function SourceImageDetailSkin({ item, actions, onClose }: DetailSkinProps) {
  const raw = item.metadata?.raw as Record<string, unknown> | undefined;
  const originalFilename = raw?.originalFilename as string | undefined;
  const mimeType         = raw?.mimeType         as string | undefined;
  const grfId            = raw?.grfId            as string | undefined;

  const handleCrop = () => {
    actions?.onCrop?.(item.id);
    onClose?.();
  };

  const handleDelete = () => {
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
            data-testid="img-source-detail"
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
          data-testid="text-source-detail-name"
        >
          {item.name}
        </p>
        {originalFilename && originalFilename !== item.name && (
          <p className="text-xs text-muted-foreground" data-testid="text-source-detail-filename">
            {originalFilename}
          </p>
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          {mimeType && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-source-mimetype">
              {mimeType}
            </Badge>
          )}
          {item.dimensions && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-source-dimensions">
              {item.dimensions}
            </Badge>
          )}
          {grfId && (
            <Badge variant="outline" className="text-xs font-mono" data-testid="badge-source-grfid">
              {grfId}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        {actions?.onCrop && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCrop}
            data-testid="button-detail-crop"
          >
            <Crop className="h-4 w-4 mr-2" />
            Crop
          </Button>
        )}
        {actions?.onDelete && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDelete}
            data-testid="button-detail-delete"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Archive
          </Button>
        )}
      </div>

    </div>
  );
}
