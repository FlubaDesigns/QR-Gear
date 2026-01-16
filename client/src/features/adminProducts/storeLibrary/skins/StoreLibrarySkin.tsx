import { ArrowRight, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <>
      <Button
        variant="default"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={handleMove}
        data-testid="button-action-move"
      >
        <ArrowRight className="w-4 h-4" />
        Move to Target Store
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={handleReplicate}
        data-testid="button-action-replicate"
      >
        <Copy className="w-4 h-4" />
        Replicate to Target Store
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={handleDelete}
        data-testid="button-action-delete"
      >
        <Trash2 className="w-4 h-4" />
        Delete Selected
      </Button>
    </>
  );
}
