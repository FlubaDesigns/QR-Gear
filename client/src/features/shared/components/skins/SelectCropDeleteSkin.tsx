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

  return (
    <div className="space-y-3">
      {onSelect && (
        <Button
          size="lg"
          className="w-full"
          onClick={handleSelect}
          data-testid="button-select"
        >
          <Check className="h-5 w-5 mr-2" />
          Use This Image
        </Button>
      )}
      {onCrop && (
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          onClick={handleCrop}
          data-testid="button-crop"
        >
          <Crop className="h-5 w-5 mr-2" />
          Crop First
        </Button>
      )}
      {onDelete && (
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-red-400 hover:text-red-300"
          onClick={handleDelete}
          disabled={isDeleting}
          data-testid="button-delete"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      )}
    </div>
  );
}
