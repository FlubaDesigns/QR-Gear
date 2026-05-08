import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, ImageIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SinglePaneViewer } from "./viewers/SinglePaneViewer";
import { SkinHorizontalView } from "./views/SkinHorizontalView";
import type { SkinItem, SkinActions, CardSkinProps, DetailSkinProps } from "./skins/types";

// VVS Viewer code: 1·2·1
// SinglePane + HorizontalScroll + Popup shape.
// Composed viewer — owns selection state, popup dialog, prev/next, and optional confirm.

type CardSkinComponent = React.ComponentType<CardSkinProps>;
type DetailSkinComponent = React.ComponentType<DetailSkinProps>;

export interface SkinHorizontalViewerProps {
  items: SkinItem[];
  CardSkin: CardSkinComponent;
  DetailSkin: DetailSkinComponent;
  actions: SkinActions;
  isActionPending?: boolean;
  cardWidth?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  confirmAction?: {
    type: "archive" | "delete";
    title: string;
    description: string;
  };
  /** Optional header rendered above the scroll strip (e.g. filter controls) */
  header?: React.ReactNode;
  className?: string;
}

export function SkinHorizontalViewer({
  items,
  CardSkin,
  DetailSkin,
  actions,
  isActionPending = false,
  cardWidth = "160px",
  isLoading,
  emptyMessage,
  emptyIcon,
  confirmAction,
  header,
  className,
}: SkinHorizontalViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showConfirm, setShowConfirm]     = useState(false);

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null;
  const hasPrev      = selectedIndex !== null && selectedIndex > 0;
  const hasNext      = selectedIndex !== null && selectedIndex < items.length - 1;

  const handlePrev  = () => { if (hasPrev) setSelectedIndex(selectedIndex! - 1); };
  const handleNext  = () => { if (hasNext) setSelectedIndex(selectedIndex! + 1); };
  const handleClose = () => setSelectedIndex(null);

  const handleConfirmAction = () => {
    if (selectedItem && confirmAction) {
      if (confirmAction.type === "archive") actions.onArchive?.(selectedItem.id);
      else                                   actions.onDelete?.(selectedItem.id);
    }
    setShowConfirm(false);
  };

  // Intercept archive/delete to show confirm dialog when configured
  const wrappedActions: SkinActions = {
    ...actions,
    onArchive: confirmAction?.type === "archive" ? () => setShowConfirm(true) : actions.onArchive,
    onDelete:  confirmAction?.type === "delete"  ? () => setShowConfirm(true) : actions.onDelete,
  };

  return (
    <SinglePaneViewer className={className}>
      {header && <div className="mb-4">{header}</div>}

      <SkinHorizontalView
        items={items}
        CardSkin={CardSkin}
        onSelect={(_, index) => setSelectedIndex(index)}
        selectedId={selectedItem?.id ?? null}
        actions={wrappedActions}
        isActionPending={isActionPending}
        cardWidth={cardWidth}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        emptyIcon={emptyIcon}
      />

      {/* Detail popup */}
      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden p-0" aria-describedby={undefined}>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10"
              onClick={handleClose}
              data-testid="button-viewer-close"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Image preview with prev/next */}
            <div className="relative aspect-square sm:aspect-video bg-muted flex items-center justify-center overflow-hidden">
              {selectedItem?.primaryImage ? (
                <img
                  src={selectedItem.primaryImage}
                  alt={selectedItem.name}
                  className="max-w-full max-h-full object-contain"
                  data-testid="img-viewer-preview"
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
                  data-testid="button-viewer-prev"
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
                  data-testid="button-viewer-next"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}

              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                {(selectedIndex ?? 0) + 1} / {items.length}
              </div>
            </div>

            {/* Detail skin */}
            {selectedItem && (
              <div className="p-4 border-t">
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
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Optional confirm dialog */}
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
    </SinglePaneViewer>
  );
}

export type { SkinItem, SkinActions, CardSkinProps, DetailSkinProps };
