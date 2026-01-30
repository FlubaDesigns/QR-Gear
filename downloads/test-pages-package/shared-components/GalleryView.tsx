import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Edit, Trash2, Archive, ExternalLink, Link as LinkIcon, Image, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface GalleryImage {
  url: string;
  label: string;
}

export interface GalleryViewItem {
  id: string;
  packetId?: string;
  name: string;
  primaryImage?: string;
  secondaryImage?: string;
  images?: GalleryImage[];  // For labeled swipeable images
  qrContent?: string;
  headerText?: string;
  footerText?: string;
  qrMode?: string;
  selectedSize?: string;
  colorCount?: number;
  sizeCount?: number;
  price?: number;
}

export interface GalleryViewProps {
  items: GalleryViewItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onEdit?: (id: string) => void;
  onAction?: (id: string) => void;
  isActionPending?: boolean;
  actionType?: "archive" | "delete";
  actionLabel?: string;
  actionConfirmTitle?: string;
  actionConfirmDescription?: string;
}

export function GalleryView({
  items,
  currentIndex,
  onClose,
  onNavigate,
  onEdit,
  onAction,
  isActionPending = false,
  actionType = "archive",
  actionLabel,
  actionConfirmTitle,
  actionConfirmDescription,
}: GalleryViewProps) {
  const [showImageIndex, setShowImageIndex] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const item = items[currentIndex];
  if (!item) return null;

  // Use labeled images array if provided, otherwise fall back to primary/secondary
  const galleryImages: GalleryImage[] = item.images && item.images.length > 0
    ? item.images
    : [
        item.primaryImage ? { url: item.primaryImage, label: "Composite" } : null,
        item.secondaryImage ? { url: item.secondaryImage, label: "QR Only" } : null,
      ].filter((img): img is GalleryImage => img !== null);

  const hasMultipleImages = galleryImages.length > 1;
  const currentImage = galleryImages[showImageIndex]?.url || null;
  const currentLabel = galleryImages[showImageIndex]?.label || "";

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < items.length - 1;

  const resolvedActionLabel = actionLabel || (actionType === "delete" ? "Delete" : "Archive");
  const ActionIcon = actionType === "delete" ? Trash2 : Archive;
  const resolvedConfirmTitle = actionConfirmTitle || (actionType === "delete" 
    ? "Delete this item?" 
    : "Archive this item?");
  const resolvedConfirmDescription = actionConfirmDescription || (actionType === "delete"
    ? "This will permanently delete this item. This action cannot be undone."
    : "This will hide the item from your library. You can restore it later if needed.");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && canGoPrev) onNavigate(currentIndex - 1);
    if (e.key === "ArrowRight" && canGoNext) onNavigate(currentIndex + 1);
    if (e.key === "Escape") onClose();
  };

  const handleAction = () => {
    if (onAction) {
      onAction(item.id);
    }
    setShowConfirm(false);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent 
        className="max-w-4xl w-full p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-background/80"
            onClick={onClose}
            data-testid="button-close-gallery"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
            {currentImage ? (
              <img
                src={currentImage}
                alt={item.name}
                className="max-w-full max-h-full object-contain"
                data-testid="img-gallery-main"
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
                onClick={() => {
                  onNavigate(currentIndex - 1);
                  setShowImageIndex(0);
                }}
                data-testid="button-gallery-prev"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            {canGoNext && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg"
                onClick={() => {
                  onNavigate(currentIndex + 1);
                  setShowImageIndex(0);
                }}
                data-testid="button-gallery-next"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}

            {hasMultipleImages && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-background/80 rounded-full px-3 py-1.5">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      showImageIndex === idx 
                        ? "bg-primary" 
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    onClick={() => setShowImageIndex(idx)}
                    title={img.label}
                    data-testid={`dot-gallery-${idx}`}
                  />
                ))}
              </div>
            )}

            <Badge variant="secondary" className="absolute top-4 left-4">
              {currentIndex + 1} / {items.length}
            </Badge>

            {hasMultipleImages && currentLabel && (
              <Badge variant="outline" className="absolute top-4 left-20 bg-background/80">
                {currentLabel}
              </Badge>
            )}

            {item.selectedSize && (
              <Badge variant="outline" className="absolute top-4 right-14 bg-background/80">
                {item.selectedSize}
              </Badge>
            )}
          </div>

          <div className="p-4 border-t space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg truncate" data-testid="text-gallery-name">
                  {item.name}
                </h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.qrMode && (
                    <Badge variant="secondary">
                      <QrCode className="h-3 w-3 mr-1" />
                      {item.qrMode}
                    </Badge>
                  )}
                  {(item.colorCount ?? 0) > 0 && (
                    <Badge variant="outline">
                      {item.colorCount} colors
                    </Badge>
                  )}
                  {(item.sizeCount ?? 0) > 0 && (
                    <Badge variant="outline">
                      {item.sizeCount} sizes
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(item.packetId || item.id)}
                    data-testid="button-gallery-edit"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {onAction && (
                  <Button
                    variant={actionType === "delete" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setShowConfirm(true)}
                    disabled={isActionPending}
                    data-testid="button-gallery-action"
                  >
                    <ActionIcon className="h-4 w-4 mr-1" />
                    {resolvedActionLabel}
                  </Button>
                )}
              </div>
            </div>

            {item.qrContent && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate flex-1" data-testid="text-gallery-url">
                  {item.qrContent}
                </span>
                {item.qrContent.startsWith("http") && (
                  <a 
                    href={item.qrContent} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}

            {(item.headerText || item.footerText) && (
              <div className="space-y-1">
                {item.headerText && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Header:</span>{" "}
                    <span className="font-medium" data-testid="text-gallery-header">{item.headerText}</span>
                  </p>
                )}
                {item.footerText && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Footer:</span>{" "}
                    <span className="font-medium" data-testid="text-gallery-footer">{item.footerText}</span>
                  </p>
                )}
              </div>
            )}

            {item.price !== undefined && item.price > 0 && (
              <p className="text-sm text-muted-foreground">
                Price: <span className="font-medium text-foreground">${item.price.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{resolvedConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{resolvedConfirmDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className={actionType === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                onClick={handleAction}
              >
                {resolvedActionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
