import { useEffect, useState } from 'react';
import { ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalView } from './ModalView';
import { TemplateDetailSkin } from '../skins/TemplateSkin';
import type { GalleryShapeProps } from '../SkinHorizontalViewer';

export function TemplateShape({ open, item, actions, onClose, onPrev, onNext, hasPrev, hasNext, isActionPending, itemIndex, totalItems }: GalleryShapeProps) {
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => setImageIndex(0), [item?.id]);
  const images = item?.images || [];
  const currentImage = images[imageIndex] || images[0];
  return (
    <ModalView open={open} onOpenChange={value => { if (!value && !isActionPending) onClose(); }} title={item?.name || 'Template'} showCloseButton={false}
      className="!overflow-y-auto max-h-[90dvh] [&>button]:h-11 [&>button]:w-11">
      <div className="min-w-0">
        <div className="aspect-square sm:aspect-video bg-muted flex items-center justify-center">
          {currentImage ? <img src={currentImage.url} alt={`${item?.name} — ${currentImage.label}`} className="max-w-full max-h-full object-contain" data-testid="img-template-preview" /> : <ImageIcon className="h-20 w-20 text-muted-foreground" />}
        </div>
        <div className="p-4 space-y-4">
          {images.length > 1 ? (
            <div className="flex flex-wrap gap-2" aria-label="Template images">
              {images.map((image, index) => <Button key={image.url} className="min-h-[44px]" variant={index === imageIndex ? 'default' : 'outline'} aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}>{image.label}</Button>)}
            </div>
          ) : currentImage && <p className="text-sm text-muted-foreground">{currentImage.label}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" className="h-11 w-11" size="icon" aria-label="Previous template" onClick={onPrev} disabled={!hasPrev || isActionPending}><ChevronLeft /></Button>
            <span className="text-sm text-muted-foreground">{itemIndex + 1} / {totalItems}</span>
            <Button variant="outline" className="h-11 w-11" size="icon" aria-label="Next template" onClick={onNext} disabled={!hasNext || isActionPending}><ChevronRight /></Button>
          </div>
          {item && <TemplateDetailSkin item={item} actions={actions} isActionPending={isActionPending} />}
        </div>
      </div>
    </ModalView>
  );
}
