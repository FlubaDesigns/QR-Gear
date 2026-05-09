import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crop, Trash2, Image } from "lucide-react";
import type { DetailSkinProps } from "../skins/types";

// VVSS Shape: SourceDetailShape (digit 4)
// Layer: Shape — renders inside ModalView
// Data type: Source GRF original
// Actions: crop, delete

export function SourceDetailShape({ item, actions, onClose }: DetailSkinProps) {
  const raw              = item.metadata?.raw as Record<string, unknown> | undefined;
  const originalFilename = raw?.originalFilename as string | undefined;
  const mimeType         = raw?.mimeType         as string | undefined;
  const grfId            = raw?.grfId            as string | undefined;

  const handleCrop = () => {
    actions?.onCrop?.(item.id);
  };

  const handleDelete = () => {
    actions?.onDelete?.(item.id);
  };

  return (
    <div className="space-y-4 w-full">

      {/* Large image preview */}
      <div className="relative w-full max-h-52 aspect-square bg-muted rounded-md overflow-hidden">
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
        <div className="flex flex-wrap gap-1 pt-1">
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
