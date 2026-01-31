import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader2, Layers, QrCode, Check, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface TemplatePickerItem {
  id: string;
  name: string;
  primaryImage?: string | null;
  secondaryImage?: string | null;
  productName?: string | null;
  packetId?: string | null;
  qrMode?: string | null;
  colorCount?: number;
  sizeCount?: number;
}

interface TemplatePickerSkinProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (packetId: string) => void;
  fetchTemplates: () => Promise<TemplatePickerItem[]>;
}

export function TemplatePickerSkin({
  isOpen,
  onClose,
  onSelect,
  fetchTemplates,
}: TemplatePickerSkinProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplatePickerItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showImageIndex, setShowImageIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    
    setIsLoading(true);
    setCurrentIndex(0);
    setShowImageIndex(0);
    
    fetchTemplates()
      .then(setTemplates)
      .catch(err => console.error("Failed to load templates:", err))
      .finally(() => setIsLoading(false));
  }, [isOpen, fetchTemplates]);

  if (!isOpen) return null;

  const template = templates[currentIndex];
  const images = template 
    ? [template.primaryImage, template.secondaryImage].filter(Boolean) as string[] 
    : [];
  const hasMultipleImages = images.length > 1;
  const currentImage = images[showImageIndex] || null;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < templates.length - 1;

  const handleLoad = () => {
    if (template?.packetId) {
      onSelect(template.packetId);
      onClose();
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      setCurrentIndex(currentIndex - 1);
      setShowImageIndex(0);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setCurrentIndex(currentIndex + 1);
      setShowImageIndex(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Select Template</DialogTitle>
        </VisuallyHidden>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-3">Loading templates...</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No templates found. Create one in Products Builder first.</p>
            <Button className="mt-4" onClick={onClose}>Close</Button>
          </div>
        ) : template ? (
          <div className="relative">
            <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={template.name}
                  className="max-w-full max-h-full object-contain cursor-pointer"
                  onClick={handleLoad}
                  data-testid="img-template-picker-main"
                />
              ) : (
                <div className="text-muted-foreground">
                  <Image className="h-16 w-16" />
                </div>
              )}

              {canGoPrev && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg"
                  onClick={handlePrev}
                  data-testid="button-picker-prev"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}

              {canGoNext && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg"
                  onClick={handleNext}
                  data-testid="button-picker-next"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}

              {hasMultipleImages && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-background/80 rounded-full px-3 py-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      className={`h-2.5 w-2.5 rounded-full transition-colors ${
                        showImageIndex === idx 
                          ? "bg-primary" 
                          : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      }`}
                      onClick={() => setShowImageIndex(idx)}
                      data-testid={`dot-picker-${idx}`}
                    />
                  ))}
                </div>
              )}

              <Badge variant="secondary" className="absolute top-4 left-4">
                {currentIndex + 1} / {templates.length}
              </Badge>

              {hasMultipleImages && (
                <Badge variant="outline" className="absolute top-4 left-20 bg-background/80">
                  {showImageIndex === 0 ? "Composite" : "QR Only"}
                </Badge>
              )}
            </div>

            <div className="p-4 border-t space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-lg truncate" data-testid="text-picker-name">
                    {template.name}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {template.qrMode && (
                      <Badge variant="secondary">
                        <QrCode className="h-3 w-3 mr-1" />
                        {template.qrMode}
                      </Badge>
                    )}
                    {(template.colorCount ?? 0) > 0 && (
                      <Badge variant="outline">{template.colorCount} colors</Badge>
                    )}
                    {(template.sizeCount ?? 0) > 0 && (
                      <Badge variant="outline">{template.sizeCount} sizes</Badge>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleLoad}
                  disabled={!template.packetId}
                  data-testid="button-picker-load"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Load
                </Button>
              </div>
              {template.productName && template.productName !== template.name && (
                <p className="text-sm text-muted-foreground">
                  Product: {template.productName}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
