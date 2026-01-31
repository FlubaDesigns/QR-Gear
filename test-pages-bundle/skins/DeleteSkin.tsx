import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface DeleteSkinProps {
  itemId: string;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  isDeleting?: boolean;
}

export function DeleteSkin({ 
  itemId, 
  onDelete, 
  onClose,
  isDeleting 
}: DeleteSkinProps) {
  const handleDelete = () => {
    onDelete?.(itemId);
  };

  return (
    <div className="flex justify-center">
      {onDelete && (
        <Button
          variant="destructive"
          className="h-14 text-base w-full max-w-xs"
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
