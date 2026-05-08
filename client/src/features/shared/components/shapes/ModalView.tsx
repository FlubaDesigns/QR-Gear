import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface ModalViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  showCloseButton?: boolean;
}

export function ModalView({
  open,
  onOpenChange,
  title = "Preview",
  children,
  maxWidth = "max-w-3xl",
  className,
  showCloseButton = true,
}: ModalViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${maxWidth} w-[95vw] max-h-[90vh] overflow-hidden p-0 ${className || ""}`}
        aria-describedby={undefined}
        data-testid="modal-view-content"
      >
        <VisuallyHidden>
          <DialogTitle>{title}</DialogTitle>
        </VisuallyHidden>
        {showCloseButton && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 z-10 bg-background/80"
            onClick={() => onOpenChange(false)}
            data-testid="button-modal-close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

export interface ImageModalViewProps {
  imageUrl: string | null;
  onClose: () => void;
  alt?: string;
}

export function ImageModalView({
  imageUrl,
  onClose,
  alt = "Full size preview",
}: ImageModalViewProps) {
  if (!imageUrl) return null;

  return (
    <ModalView
      open={true}
      onOpenChange={() => onClose()}
      title={alt}
      maxWidth="max-w-[95vw]"
      className="bg-transparent border-none shadow-none"
      showCloseButton={false}
    >
      <div
        className="flex flex-col items-center justify-center p-4 min-h-[50vh]"
        onClick={onClose}
        data-testid="lightbox-content"
      >
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full max-h-[75vh] object-contain rounded-lg cursor-pointer"
          data-testid="lightbox-image"
        />
        <button
          type="button"
          onClick={onClose}
          className="qr-btn qr-btn--primary qr-btn--touch qr-btn--xl mt-8 min-w-[280px]"
          data-testid="button-lightbox-close"
        >
          Tap to Close
        </button>
      </div>
    </ModalView>
  );
}

export interface ItemModalViewProps {
  item: { id: string; name: string; imageUrl: string; dimensions?: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function ItemModalView({ item, open, onOpenChange, children }: ItemModalViewProps) {
  if (!item) return null;

  return (
    <ModalView
      open={open}
      onOpenChange={onOpenChange}
      title={item.name || "Image Preview"}
      maxWidth="max-w-sm"
      className="bg-slate-900 border-slate-700"
    >
      <div className="relative">
        <img
          src={item.imageUrl}
          alt=""
          className="w-full max-h-[60vh] object-contain bg-black"
          data-testid="img-modal-view"
        />
      </div>
      <div className="p-4">
        {children}
      </div>
    </ModalView>
  );
}
