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

export interface ViewerItem {
  id: string;
  packetId?: string;
  productName?: string;
  name?: string;
  primaryImage?: string;
  secondaryImage?: string;
  qrContent?: string;
  headerText?: string;
  footerText?: string;
  qrProductState?: string;
  selectedSize?: string;
  enabledColors?: string[];
  enabledSizes?: string[];
  customerPrice?: number;
}

interface LibraryViewerProps {
  items: ViewerItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onEdit: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  isDeleting?: boolean;
  mode: "graphics" | "templates";
}

export function LibraryViewer({
  items,
  currentIndex,
  onClose,
  onNavigate,
  onEdit,
  onDelete,
  onArchive,
  isDeleting,
  mode,
}: LibraryViewerProps) {
  const [showImageIndex, setShowImageIndex] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const item = items[currentIndex];
  if (!item) return null;

  const images = [item.primaryImage, item.secondaryImage].filter(Boolean) as string[];
  const hasMultipleImages = images.length > 1;
  const currentImage = images[showImageIndex] || null;
  const imageLabels = ["Composite", "QR Only"];

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < items.length - 1;

  const displayName = item.productName || item.name || "Untitled";
  const qrMode = item.qrProductState?.replace('qr_', '').toUpperCase();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && canGoPrev) onNavigate(currentIndex - 1);
    if (e.key === "ArrowRight" && canGoNext) onNavigate(currentIndex + 1);
    if (e.key === "Escape") onClose();
  };

  const handleAction = () => {
    if (mode === "graphics" && onArchive) {
      onArchive(item.id);
    } else if (mode === "templates" && onDelete) {
      onDelete(item.id);
    }
    setShowConfirm(false);
  };

  const actionLabel = mode === "graphics" ? "Archive" : "Delete";
  const ActionIcon = mode === "graphics" ? Archive : Trash2;
  const confirmTitle = mode === "graphics" 
    ? "Archive this graphic?" 
    : "Delete this template and its packet?";
  const confirmDescription = mode === "graphics"
    ? "This will hide the graphic from your library. You can restore it later if needed."
    : "This will permanently delete the template and the underlying graphics packet. This action cannot be undone.";

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
            data-testid="button-close-viewer"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
            {currentImage ? (
              <img
                src={currentImage}
                alt={displayName}
                className="max-w-full max-h-full object-contain"
                data-testid="img-viewer"
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
                data-testid="button-prev-item"
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
                data-testid="button-next-item"
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
                    data-testid={`dot-image-${idx}`}
                  />
                ))}
              </div>
            )}

            <Badge variant="secondary" className="absolute top-4 left-4">
              {currentIndex + 1} / {items.length}
            </Badge>

            {hasMultipleImages && (
              <Badge variant="outline" className="absolute top-4 left-20 bg-background/80">
                {imageLabels[showImageIndex]}
              </Badge>
            )}

            {item.selectedSize && (
              <Badge variant="outline" className="absolute top-4 right-14 bg-background/80">
                Size: {item.selectedSize}
              </Badge>
            )}
          </div>

          <div className="p-4 border-t space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg truncate" data-testid="text-viewer-name">
                  {displayName}
                </h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {qrMode && (
                    <Badge variant="secondary">
                      <QrCode className="h-3 w-3 mr-1" />
                      {qrMode}
                    </Badge>
                  )}
                  {item.enabledColors && item.enabledColors.length > 0 && (
                    <Badge variant="outline">
                      {item.enabledColors.length} colors
                    </Badge>
                  )}
                  {item.enabledSizes && item.enabledSizes.length > 0 && (
                    <Badge variant="outline">
                      {item.enabledSizes.length} sizes
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(item.packetId || item.id)}
                  data-testid="button-edit-item"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={mode === "templates" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setShowConfirm(true)}
                  disabled={isDeleting}
                  data-testid="button-action-item"
                >
                  <ActionIcon className="h-4 w-4 mr-1" />
                  {actionLabel}
                </Button>
              </div>
            </div>

            {item.qrContent && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate flex-1" data-testid="text-viewer-url">
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
                    <span className="font-medium" data-testid="text-header">{item.headerText}</span>
                  </p>
                )}
                {item.footerText && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Footer:</span>{" "}
                    <span className="font-medium" data-testid="text-footer">{item.footerText}</span>
                  </p>
                )}
              </div>
            )}

            {item.customerPrice && (
              <p className="text-sm text-muted-foreground">
                Price: <span className="font-medium text-foreground">${item.customerPrice.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className={mode === "templates" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                onClick={handleAction}
              >
                {actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
