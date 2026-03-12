import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function PreviewDrawer({
  open,
  onClose,
  title = "Preview",
  children,
}: PreviewDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 p-4 pb-2 border-b border-border">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={onClose}
            data-testid="button-close-preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="p-4" data-testid="preview-drawer-content">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
