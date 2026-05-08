import { BackgroundDetailSkin } from "../skins/BackgroundSkin";
import type { SkinItem, SkinActions } from "../skins/types";

// VVS Shape: BackgroundShape
// Layer: Shape — popup presentation layer for the Background data type.
// Owns the overlay container; renders BackgroundDetailSkin for all controls.

export interface BackgroundShapeProps {
  open: boolean;
  item: SkinItem | null;
  actions?: SkinActions;
  onClose: () => void;
  isActionPending?: boolean;
}

export function BackgroundShape({ open, item, actions, onClose, isActionPending }: BackgroundShapeProps) {
  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      data-testid="overlay-background-detail"
    >
      <div
        className="bg-background rounded-lg p-6 w-full max-w-xs mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-background-detail"
      >
        <BackgroundDetailSkin
          item={item}
          actions={actions}
          onClose={onClose}
          isActionPending={isActionPending}
        />
      </div>
    </div>
  );
}
