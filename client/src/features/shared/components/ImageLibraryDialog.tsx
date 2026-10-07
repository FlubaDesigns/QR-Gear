import { ModalView } from './shapes/ModalView';
import { AdminImagesBrowser } from './AdminImagesBrowser';
export function ImageLibraryDialog({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (url: string) => void }) {
  return <ModalView open={open} onOpenChange={value => { if (!value) onClose(); }} title="Choose an image" showCloseButton={false} className="!overflow-y-auto max-h-[90dvh] [&>button]:h-11 [&>button]:w-11">
    {open && <div className="p-4 pt-14"><AdminImagesBrowser onSelect={url => { onSelect(url); onClose(); }} /></div>}
  </ModalView>;
}
