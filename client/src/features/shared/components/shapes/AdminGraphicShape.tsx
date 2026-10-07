import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon } from "lucide-react";
import { AdminGraphicDetailSkin } from "../skins/AdminGraphicSkins";
import type { GalleryShapeProps } from "../SkinHorizontalViewer";

// VVS Shape layer — AdminGraphic data type.
// Owns: Dialog container, image preview and counter badge.
// Delegates: all detail metadata to AdminGraphicDetailSkin.

export function AdminGraphicShape({
  open,
  item,
  actions,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  isActionPending,
  itemIndex,
  totalItems,
}: GalleryShapeProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl w-[95vw] max-h-[90dvh] overflow-y-auto p-0 [&>button]:h-11 [&>button]:w-11"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{item?.name || "Graphic details"}</DialogTitle>
        <div className="relative w-full">
          {/* Image preview */}
          <div className="relative aspect-square sm:aspect-video bg-muted flex items-center justify-center overflow-hidden">
            {item?.primaryImage ? (
              <img
                src={item.primaryImage}
                alt={item.name}
                className="max-w-full max-h-full object-contain"
                data-testid="img-shape-preview"
              />
            ) : (
              <ImageIcon className="h-24 w-24 text-muted-foreground" />
            )}

            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {itemIndex + 1} / {totalItems}
            </div>
          </div>

          {/* Detail skin */}
          {item && (
            <div className="p-4 border-t">
              <AdminGraphicDetailSkin
                item={item}
                actions={actions}
                isActionPending={isActionPending}
                onClose={onClose}
                onPrev={onPrev}
                onNext={onNext}
                hasPrev={hasPrev}
                hasNext={hasNext}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
