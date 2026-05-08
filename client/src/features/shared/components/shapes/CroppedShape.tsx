import { CroppedDetailSkin } from "../skins/CroppedImageSkin";
import type { SkinItem, SkinActions } from "../skins/types";

// VVS Shape: CroppedShape
// Layer: Shape — popup presentation layer for the Cropped data type.
// Owns the overlay container; renders CroppedDetailSkin for all controls.

export interface CroppedShapeProps {
  open: boolean;
  item: SkinItem | null;
  actions?: SkinActions;
  onClose: () => void;
  isActionPending?: boolean;
}

export function CroppedShape({ open, item, actions, onClose, isActionPending }: CroppedShapeProps) {
  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      data-testid="overlay-cropped-detail"
    >
      <div
        className="bg-background rounded-lg p-6 w-full max-w-xs mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-cropped-detail"
      >
        <CroppedDetailSkin
          item={item}
          actions={actions}
          onClose={onClose}
          isActionPending={isActionPending}
        />
      </div>
    </div>
  );
}
