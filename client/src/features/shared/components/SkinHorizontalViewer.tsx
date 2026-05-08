import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SinglePaneViewer } from "./viewers/SinglePaneViewer";
import { SkinHorizontalView } from "./views/SkinHorizontalView";
import type { SkinItem, SkinActions, CardSkinProps } from "./skins/types";

// VVS Viewer code: 1·2·1
// SinglePane + HorizontalScroll + Shape popup.
// Owns: selection state, prev/next navigation, optional confirm dialog.
// Does NOT own: popup UI, detail content — those belong to the Shape layer.

type CardSkinComponent = React.ComponentType<CardSkinProps>;

// Props that every Shape used with this viewer must accept.
export interface GalleryShapeProps {
  open: boolean;
  item: SkinItem | null;
  actions?: SkinActions;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  isActionPending?: boolean;
  itemIndex: number;
  totalItems: number;
}

type GalleryShapeComponent = React.ComponentType<GalleryShapeProps>;

export interface SkinHorizontalViewerProps {
  items: SkinItem[];
  CardSkin: CardSkinComponent;
  Shape: GalleryShapeComponent;
  actions: SkinActions;
  isActionPending?: boolean;
  cardWidth?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  /** When set, archive/delete actions show a confirm dialog before firing */
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
  Shape,
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

  const handleConfirm = () => {
    if (selectedItem && confirmAction) {
      if (confirmAction.type === "archive") actions.onArchive?.(selectedItem.id);
      else                                   actions.onDelete?.(selectedItem.id);
    }
    setShowConfirm(false);
    handleClose(); // Close shape popup immediately — item will vanish after query invalidates
  };

  // Intercept destructive actions to show confirm dialog when configured
  const shapeActions: SkinActions = {
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
        actions={shapeActions}
        isActionPending={isActionPending}
        cardWidth={cardWidth}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        emptyIcon={emptyIcon}
      />

      {/* Shape owns the popup presentation entirely */}
      <Shape
        open={selectedIndex !== null}
        item={selectedItem}
        actions={shapeActions}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isActionPending={isActionPending}
        itemIndex={selectedIndex ?? 0}
        totalItems={items.length}
      />

      {/* Confirm dialog — system-level, not popup content */}
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
                onClick={handleConfirm}
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

export type { SkinItem, SkinActions, CardSkinProps };
