import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  alt?: string;
  label?: string;
  type?: string;
}

interface ProductImageGalleryProps {
  images: GalleryImage[];
  className?: string;
}

interface LightboxProps {
  images: GalleryImage[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onIndexChange: (index: number) => void;
}

function Lightbox({ images, currentIndex, onClose, onNext, onPrev, onIndexChange }: LightboxProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) onNext();
    else if (distance < -minSwipeDistance) onPrev();
  };

  const content = (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={onClose}
      data-testid="lightbox-overlay"
    >
      <div className="flex-shrink-0 flex items-center justify-between p-4">
        <div className="text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          data-testid="button-lightbox-close"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-4 relative"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 sm:left-4 bg-white/10 hover:bg-white/20 text-white h-12 w-12 rounded-full z-10"
            onClick={onPrev}
            data-testid="button-lightbox-prev"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}

        <img
          src={images[currentIndex].url}
          alt={images[currentIndex].alt || `Image ${currentIndex + 1}`}
          className="max-w-full max-h-[70vh] object-contain rounded-sm"
          data-testid="img-lightbox-main"
        />

        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 sm:right-4 bg-white/10 hover:bg-white/20 text-white h-12 w-12 rounded-full z-10"
            onClick={onNext}
            data-testid="button-lightbox-next"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}
      </div>

      {images[currentIndex].label && (
        <div className="flex-shrink-0 text-center text-white text-sm py-2">
          {images[currentIndex].label}
        </div>
      )}

      {images.length > 1 && (
        <div
          className="flex-shrink-0 flex justify-center gap-2 p-4 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, index) => (
            <button
              key={index}
              className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 overflow-hidden border-2 transition-all flex-shrink-0 rounded-sm",
                index === currentIndex
                  ? "border-white ring-2 ring-white/50"
                  : "border-transparent opacity-50 hover:opacity-80"
              )}
              onClick={() => onIndexChange(index)}
              data-testid={`button-lightbox-thumb-${index}`}
            >
              <img
                src={img.url}
                alt={img.alt || `Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

export default function ProductImageGallery({ images, className }: ProductImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Long-press to open lightbox on mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const minSwipeDistance = 50;

  useEffect(() => {
    setCurrentIndex(0);
    setIsLightboxOpen(false);
  }, [images[0]?.url]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLightboxOpen(false);
    };
    if (isLightboxOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isLightboxOpen]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setIsLightboxOpen(true);
    }, 500);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (didLongPress.current) return;
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) goToNext();
    else if (distance < -minSwipeDistance) goToPrev();
  };

  if (!images || images.length === 0) {
    return (
      <div className={cn("aspect-square bg-muted flex items-center justify-center", className)}>
        <p className="text-muted-foreground">No images available</p>
      </div>
    );
  }

  const objectFit = images[currentIndex]?.type === 'mockup' || images[currentIndex]?.type === 'graphic'
    ? 'object-contain'
    : 'object-cover';

  if (images.length === 1) {
    return (
      <>
        <div
          className={cn("relative aspect-square overflow-hidden cursor-pointer group", className)}
          onClick={() => setIsLightboxOpen(true)}
          data-testid="container-image-single"
        >
          <img
            src={images[0].url}
            alt={images[0].alt || "Product image"}
            className={`w-full h-full ${images[0].type === 'mockup' || images[0].type === 'graphic' ? 'object-contain' : 'object-cover'}`}
            data-testid="img-product-single"
          />
          {/* Zoom hint — visible on hover (desktop) and always on mobile */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2 pointer-events-none">
            <div className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-sm opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-3.5 w-3.5" />
              <span className="sm:hidden">Tap to zoom</span>
            </div>
          </div>
        </div>
        {isLightboxOpen && (
          <Lightbox
            images={images}
            currentIndex={currentIndex}
            onClose={() => setIsLightboxOpen(false)}
            onNext={goToNext}
            onPrev={goToPrev}
            onIndexChange={setCurrentIndex}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={cn("relative", className)}>
        <div
          className="relative aspect-square overflow-hidden cursor-pointer group"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => { if (!didLongPress.current) setIsLightboxOpen(true); }}
          data-testid="container-image-gallery"
        >
          <img
            src={images[currentIndex].url}
            alt={images[currentIndex].alt || `Product image ${currentIndex + 1}`}
            className={`w-full h-full transition-opacity duration-300 ${objectFit}`}
            data-testid={`img-product-${currentIndex}`}
          />

          {/* Zoom hint — always visible on mobile, hover-only on desktop */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end p-2 pointer-events-none">
            <div className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-sm opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-3.5 w-3.5" />
              <span className="sm:hidden">Tap to zoom</span>
            </div>
          </div>

          {images[currentIndex].label && (
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-sm">
              {images[currentIndex].label}
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white h-10 w-10 rounded-full qr-touch-48"
            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            data-testid="button-gallery-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white h-10 w-10 rounded-full qr-touch-48"
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            data-testid="button-gallery-next"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Dot indicators — mobile only (hidden when thumbs show below) */}
        <div className="flex sm:hidden justify-center gap-1.5 mt-2">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === currentIndex
                  ? "bg-primary w-3"
                  : "bg-muted-foreground/30 w-1.5"
              )}
              onClick={() => setCurrentIndex(index)}
              data-testid={`button-gallery-dot-${index}`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>

        {/* Thumbnail strip — visible on ALL screen sizes */}
        <div className="flex justify-center gap-1.5 mt-2 overflow-x-auto pb-1">
          {images.map((img, index) => (
            <button
              key={index}
              className={cn(
                "w-14 h-14 border-2 overflow-hidden transition-all flex-shrink-0 rounded-sm",
                index === currentIndex
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent opacity-50 hover:opacity-100"
              )}
              onClick={() => setCurrentIndex(index)}
              data-testid={`button-gallery-thumb-${index}`}
            >
              <img
                src={img.url}
                alt={img.alt || `Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      {isLightboxOpen && (
        <Lightbox
          images={images}
          currentIndex={currentIndex}
          onClose={() => setIsLightboxOpen(false)}
          onNext={goToNext}
          onPrev={goToPrev}
          onIndexChange={setCurrentIndex}
        />
      )}
    </>
  );
}
