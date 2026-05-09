import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Image } from "lucide-react";
import type { DetailSkinProps } from "../skins/types";

// VVSS Shape: CroppedDetailShape (digit 4)
// Layer: Shape — renders inside ModalView (owned by CroppedCardSkin)
// Data type: Cropped GRF derivative
// Actions: archive

export function CroppedDetailShape({ item, actions, onClose }: DetailSkinProps) {
  const raw         = item.metadata?.raw as Record<string, unknown> | undefined;
  const grfId       = raw?.grfId       as string | undefined;
  const sourceGrfId = raw?.sourceGrfId as string | undefined;
  const mimeType    = raw?.mimeType    as string | undefined;

  const handleArchive = () => {
    actions?.onDelete?.(item.id);
  };

  return (
    <div className="space-y-4 w-full">

      {/* Large image preview */}
      <div className="relative w-full max-h-52 aspect-[9/16] bg-muted rounded-md overflow-hidden">
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
        <div className="flex flex-wrap gap-1 pt-1">
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
          {mimeType && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-cropped-mimetype">
              {mimeType}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        {actions?.onDelete && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleArchive}
            data-testid="button-detail-archive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Archive
          </Button>
        )}
        {onClose && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onClose}
            data-testid="button-detail-close"
          >
            Close
          </Button>
        )}
      </div>

    </div>
  );
}
