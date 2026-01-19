import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
  alt?: string;
  className?: string;
}

export function ImageLightbox({
  imageUrl,
  onClose,
  alt = "Full size preview",
  className,
}: ImageLightboxProps) {
  if (!imageUrl) return null;

  return (
    <DialogPrimitive.Root open onOpenChange={() => onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={onClose}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center p-4 outline-none",
            className
          )}
          onClick={onClose}
          data-testid="lightbox-content"
        >
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-full max-h-[75vh] object-contain rounded-lg cursor-pointer"
            onClick={onClose}
            data-testid="lightbox-image"
          />
          <button
            type="button"
            onClick={onClose}
            className="qr-btn qr-btn--primary qr-btn--touch qr-btn--xl mt-8"
            style={{ minWidth: '280px' }}
            data-testid="button-lightbox-close"
          >
            Tap to Close
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
