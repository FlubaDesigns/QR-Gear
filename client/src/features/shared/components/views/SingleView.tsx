import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface SingleViewItem {
  id: string;
  name: string;
  imageUrl: string;
  dimensions?: string;
}

export interface SingleViewProps {
  item: SingleViewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function SingleView({ item, open, onOpenChange, children }: SingleViewProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-slate-900 border-slate-700">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
          onClick={() => onOpenChange(false)}
          data-testid="button-close-single-view"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="relative">
          <img
            src={item.imageUrl}
            alt=""
            className="w-full max-h-[70vh] object-contain bg-black"
            data-testid="img-single-view"
          />
        </div>
        <div className="p-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
