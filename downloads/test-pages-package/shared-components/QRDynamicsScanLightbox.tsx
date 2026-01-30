import * as DialogPrimitive from "@radix-ui/react-dialog";
import { QRDynamicsScanSkin, type QRDynamicsScanItem } from "../skins/QRDynamicsScanSkin";

interface QRDynamicsScanLightboxProps {
  item: QRDynamicsScanItem | null;
  onClose: () => void;
  onIntervalChange: (itemId: string, interval: 'daily' | 'weekly' | 'monthly') => void;
  isUpdating?: boolean;
}

export function QRDynamicsScanLightbox({
  item,
  onClose,
  onIntervalChange,
  isUpdating = false,
}: QRDynamicsScanLightboxProps) {
  if (!item) return null;

  return (
    <DialogPrimitive.Root open onOpenChange={() => onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={onClose}
        />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-md outline-none"
          data-testid="lightbox-qr-dynamics-scan"
        >
          <QRDynamicsScanSkin
            item={item}
            onClose={onClose}
            onIntervalChange={(interval) => onIntervalChange(item.id, interval)}
            isUpdating={isUpdating}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
