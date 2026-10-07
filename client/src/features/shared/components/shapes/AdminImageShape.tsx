import { Button } from '@/components/ui/button';
import { ModalView } from './ModalView';
import { AdminImagePreview } from '../skins/AdminImageSkin';
import type { SkinItem } from '../skins/types';

export function AdminImageShape({ item, onClose, onArchive, onSelect, pending }: { item: SkinItem | null; onClose: () => void; onArchive: (id: string) => void; onSelect?: (url: string) => void; pending: boolean }) {
  return <ModalView open={!!item} onOpenChange={open => { if (!open && !pending) onClose(); }} title={item?.name || 'Image'} showCloseButton={false}
    maxWidth="max-w-md" className="!overflow-y-auto max-h-[90dvh] [&>button]:h-11 [&>button]:w-11">
    {item && <div><div className="bg-muted"><AdminImagePreview url={item.primaryImage} name={item.name} className="w-full max-h-[55dvh] object-contain" /></div>
      <div className="p-4 space-y-3"><p className="font-medium break-words">{item.name}</p>
        {onSelect && <Button className="w-full min-h-[44px]" disabled={!item.primaryImage || pending} onClick={() => { if (item.primaryImage) onSelect(item.primaryImage); }}>Use this image</Button>}
        <Button variant="outline" className="w-full min-h-[44px]" disabled={pending} onClick={() => onArchive(item.id)}>Archive</Button>
      </div></div>}
  </ModalView>;
}
