import { Dialog, DialogContent } from "@/components/ui/dialog";

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
      <DialogContent className="max-w-md p-0 overflow-hidden bg-slate-900 border-slate-700">
        <div className="relative">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full max-h-[60vh] object-contain bg-black"
            data-testid="img-single-view"
          />
        </div>
        <div className="p-4 space-y-4">
          <div className="text-center">
            <h3 className="font-semibold text-lg text-white" data-testid="text-item-name">
              {item.name}
            </h3>
            {item.dimensions && (
              <p className="text-sm text-slate-400">{item.dimensions}</p>
            )}
          </div>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
