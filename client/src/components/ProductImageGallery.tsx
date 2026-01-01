import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductImageGalleryProps {
  images: Array<{
    url: string;
    alt?: string;
    label?: string;
  }>;
  className?: string;
}

export default function ProductImageGallery({ images, className }: ProductImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

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
      <div className={cn("relative aspect-square rounded-lg overflow-hidden", className)}>
        <img
          src={images[0].url}
          alt={images[0].alt || "Product image"}
          className="w-full h-full object-cover"
          data-testid="img-product-single"
        />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div 
        className="relative aspect-square rounded-lg overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        data-testid="container-image-gallery"
      >
        <img
          src={images[currentIndex].url}
          alt={images[currentIndex].alt || `Product image ${currentIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
          data-testid={`img-product-${currentIndex}`}
        />
        
        {images[currentIndex].label && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {images[currentIndex].label}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white h-10 w-10 rounded-full qr-touch-48"
          onClick={goToPrev}
          data-testid="button-gallery-prev"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white h-10 w-10 rounded-full qr-touch-48"
          onClick={goToNext}
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
  );
}
