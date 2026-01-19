import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, ImageIcon, Layers } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { SkinItem, SkinActions, CardSkinProps, DetailSkinProps } from "./skins/types";

type CardSkinComponent = React.ComponentType<CardSkinProps>;
type DetailSkinComponent = React.ComponentType<DetailSkinProps>;

interface SkinGridViewerProps {
  items: SkinItem[];
  CardSkin: CardSkinComponent;
  DetailSkin: DetailSkinComponent;
  actions: SkinActions;
  isActionPending?: boolean;
  gridColumns?: string;
  confirmAction?: {
    type: "archive" | "delete";
    title: string;
    description: string;
  };
}

export function SkinGridViewer({
  items,
  CardSkin,
  DetailSkin,
  actions,
  isActionPending = false,
  gridColumns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  confirmAction,
}: SkinGridViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showPrimary, setShowPrimary] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < items.length - 1;
  const hasSecondaryImage = selectedItem?.secondaryImage && selectedItem?.primaryImage;

  const handlePrev = () => {
    if (hasPrev) {
      setSelectedIndex(selectedIndex! - 1);
      setShowPrimary(true);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setSelectedIndex(selectedIndex! + 1);
      setShowPrimary(true);
    }
  };

  const handleClose = () => {
    setSelectedIndex(null);
    setShowPrimary(true);
  };

  const handleConfirmAction = () => {
    if (selectedItem && confirmAction) {
      if (confirmAction.type === "archive" && actions.onArchive) {
        actions.onArchive(selectedItem.id);
      } else if (confirmAction.type === "delete" && actions.onDelete) {
        actions.onDelete(selectedItem.id);
      }
    }
    setShowConfirm(false);
  };

  const wrappedActions: SkinActions = {
    ...actions,
    onArchive: confirmAction?.type === "archive" 
      ? () => setShowConfirm(true) 
      : actions.onArchive,
    onDelete: confirmAction?.type === "delete" 
      ? () => setShowConfirm(true) 
      : actions.onDelete,
  };

  const displayImage = selectedItem 
    ? (showPrimary ? selectedItem.primaryImage : selectedItem.secondaryImage) || selectedItem.primaryImage || selectedItem.secondaryImage
    : null;

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg">
        <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground" data-testid="text-no-items">
          No items to display.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`grid ${gridColumns} gap-4`} data-testid="viewer-grid">
        {items.map((item, index) => (
          <CardSkin
            key={item.id}
            item={item}
            actions={actions}
            onClick={() => setSelectedIndex(index)}
          />
        ))}
      </div>

      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-hidden p-0">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10"
              onClick={handleClose}
              data-testid="button-gallery-close"
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="relative aspect-square sm:aspect-video bg-muted flex items-center justify-center">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={selectedItem?.name || "Preview"}
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

              {hasSecondaryImage && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                  <Button
                    variant={showPrimary ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setShowPrimary(true)}
                    data-testid="button-show-composite"
                  >
                    Composite
                  </Button>
                  <Button
                    variant={!showPrimary ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setShowPrimary(false)}
                    data-testid="button-show-qr"
                  >
                    QR Only
                  </Button>
                </div>
              )}

              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                {(selectedIndex ?? 0) + 1} / {items.length}
              </div>
            </div>

            <div className="p-4 border-t">
              {selectedItem && (
                <DetailSkin
                  item={selectedItem}
                  actions={wrappedActions}
                  isActionPending={isActionPending}
                  onClose={handleClose}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {confirmAction && (
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmAction.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmAction.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmAction}
                className={confirmAction.type === "delete" ? "bg-destructive hover:bg-destructive/90" : ""}
                data-testid="button-confirm-action"
              >
                {confirmAction.type === "archive" ? "Archive" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export type { SkinItem, SkinActions, CardSkinProps, DetailSkinProps };
