import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  alt?: string;
  label?: string;
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
          className="max-w-full max-h-[70vh] object-contain rounded-lg"
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
                "w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0",
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

  const minSwipeDistance = 50;

  // Close lightbox on escape key
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
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
  };

  if (!images || images.length === 0) {
    return (
      <div className={cn("aspect-square bg-muted rounded-lg flex items-center justify-center", className)}>
        <p className="text-muted-foreground">No images available</p>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <>
        <div 
          className={cn("relative aspect-square rounded-lg overflow-hidden cursor-pointer group", className)}
          onClick={() => setIsLightboxOpen(true)}
          data-testid="container-image-single"
        >
          <img
            src={images[0].url}
            alt={images[0].alt || "Product image"}
            className="w-full h-full object-cover"
            data-testid="img-product-single"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
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
          className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => setIsLightboxOpen(true)}
          data-testid="container-image-gallery"
        >
          <img
            src={images[currentIndex].url}
            alt={images[currentIndex].alt || `Product image ${currentIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
            data-testid={`img-product-${currentIndex}`}
          />
          
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-70 transition-opacity drop-shadow-lg" />
          </div>
          
          {images[currentIndex].label && (
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
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

        <div className="flex justify-center gap-2 mt-3">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all qr-touch-48",
                index === currentIndex 
                  ? "bg-primary w-4" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              onClick={() => setCurrentIndex(index)}
              data-testid={`button-gallery-dot-${index}`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex justify-center gap-1 mt-2">
          {images.map((img, index) => (
            <button
              key={index}
              className={cn(
                "w-12 h-12 rounded border-2 overflow-hidden transition-all qr-touch-48",
                index === currentIndex 
                  ? "border-primary ring-2 ring-primary/30" 
                  : "border-transparent opacity-60 hover:opacity-100"
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
