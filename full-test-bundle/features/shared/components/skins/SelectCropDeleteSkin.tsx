import { Button } from "@/components/ui/button";
import { Check, Crop, Trash2 } from "lucide-react";

export interface SelectCropDeleteSkinProps {
  itemId: string;
  onSelect?: (id: string) => void;
  onCrop?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  isDeleting?: boolean;
}

export function SelectCropDeleteSkin({ 
  itemId, 
  onSelect,
  onCrop, 
  onDelete, 
  onClose,
  isDeleting 
}: SelectCropDeleteSkinProps) {
  const handleSelect = () => {
    onSelect?.(itemId);
    onClose?.();
  };

  const handleCrop = () => {
    onCrop?.(itemId);
  };

  const handleDelete = () => {
    onDelete?.(itemId);
  };

  const buttonCount = [onSelect, onCrop, onDelete].filter(Boolean).length;
  const gridCols = buttonCount === 3 ? 'grid-cols-3' : buttonCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className={`grid gap-3 ${gridCols}`}>
      {onSelect && (
        <Button
          variant="default"
          className="h-14 text-base"
          onClick={handleSelect}
          data-testid="button-select"
        >
          <Check className="h-5 w-5 mr-2" />
          Select
        </Button>
      )}
      {onCrop && (
        <Button
          variant="outline"
          className="h-14 text-base"
          onClick={handleCrop}
          data-testid="button-crop"
        >
          <Crop className="h-5 w-5 mr-2" />
          Crop
        </Button>
      )}
      {onDelete && (
        <Button
          variant="destructive"
          className="h-14 text-base"
          onClick={handleDelete}
          disabled={isDeleting}
          data-testid="button-delete"
        >
          <Trash2 className="h-5 w-5 mr-2" />
          Delete
        </Button>
      )}
    </div>
  );
}
