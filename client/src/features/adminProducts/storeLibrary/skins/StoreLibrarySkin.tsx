import { ArrowRight, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LightboxItem } from "@/features/shared/components/SharedLightbox";

interface StoreLibrarySkinProps {
  items: LightboxItem[];
  onClearSelection: () => void;
}

export function StoreLibrarySkin({ items, onClearSelection }: StoreLibrarySkinProps) {
  const { toast } = useToast();

  const handleMove = () => {
    toast({
      title: "Move action triggered",
      description: `Moving ${items.length} product(s) to target store`,
    });
    onClearSelection();
  };

  const handleReplicate = () => {
    toast({
      title: "Replicate action triggered",
      description: `Copying ${items.length} product(s) to target store`,
    });
  };

  const handleDelete = () => {
    toast({
      title: "Delete action triggered",
      description: `Deleting ${items.length} product(s)`,
      variant: "destructive",
    });
    onClearSelection();
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleMove}
        className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full"
        data-testid="button-action-move"
      >
        <ArrowRight className="h-5 w-5" />
        Move to Target
      </button>
      <button
        onClick={handleReplicate}
        className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
        data-testid="button-action-replicate"
      >
        <Copy className="h-5 w-5" />
        Copy to Target
      </button>
      <button
        onClick={handleDelete}
        className="qr-btn qr-btn--danger qr-btn--touch qr-btn--full"
        data-testid="button-action-delete"
      >
        <Trash2 className="h-5 w-5" />
        Delete
      </button>
    </div>
  );
}
