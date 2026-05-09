import { Trash2, Image, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DetailSkinProps } from "../skins/types";

// VVSS 1·1·1·1  Shape: BackgroundDetailShape
// Layer: Shape — content rendered inside ModalView (owned by BackgroundCardSkin).
// Fully independent of the Skin that calls it.

export function BackgroundDetailShape({ item, actions, isActionPending }: DetailSkinProps) {
  const raw         = item.metadata?.raw as Record<string, unknown> | undefined;
  const grfId       = raw?.grfId       as string | undefined;
  const sourceGrfId = raw?.sourceGrfId as string | undefined;
  const mimeType    = raw?.mimeType    as string | undefined;

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
            onClick={() => actions.onCrop!(item.id)}
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
            onClick={() => actions.onDelete!(item.id)}
            disabled={isActionPending}
            data-testid="button-detail-archive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Archive
          </Button>
        )}
      </div>

    </div>
  );
}
