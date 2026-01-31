import { Button } from "@/components/ui/button";
import { Crop, Trash2 } from "lucide-react";

export interface CropDeleteSkinProps {
  itemId: string;
  onCrop?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  isDeleting?: boolean;
}

export function CropDeleteSkin({ 
  itemId, 
  onCrop, 
  onDelete, 
  onClose,
  isDeleting 
}: CropDeleteSkinProps) {
  const handleCrop = () => {
    onCrop?.(itemId);
    onClose?.();
  };

  const handleDelete = () => {
    onDelete?.(itemId);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
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
