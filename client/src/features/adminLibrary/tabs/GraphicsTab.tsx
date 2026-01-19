import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, Image, Link as LinkIcon, QrCode, Edit, X, Trash2, ExternalLink, Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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

interface ProductPacket {
  id: string;
  productName?: string;
  qrOnlyUrl?: string;
  compositeUrl?: string;
  qrContent?: string;
  headerText?: string;
  footerText?: string;
  qrProductState?: string;
  pricing?: {
    customerPrice?: number;
  };
  createdAt?: string | null;
  archived?: boolean;
}

function GraphicCard({ 
  packet, 
  onClick 
}: { 
  packet: ProductPacket; 
  onClick: () => void;
}) {
  const imageUrl = packet.compositeUrl || packet.qrOnlyUrl;
  const hasComposite = !!packet.compositeUrl;
  const hasQrOnly = !!packet.qrOnlyUrl;

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover-elevate transition-all" 
      onClick={onClick}
      data-testid={`graphic-card-${packet.id}`}
    >
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={packet.productName || 'Untitled'}
            className="w-full h-full object-contain"
            data-testid="img-graphic"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-12 w-12" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          {hasComposite && hasQrOnly && (
            <Badge variant="secondary" className="text-xs">2 images</Badge>
          )}
        </div>
      </div>
      <CardContent className="p-3 space-y-1">
        <h3 className="font-medium text-sm truncate" data-testid="text-graphic-name">
          {packet.productName || "Untitled"}
        </h3>
        {packet.qrContent && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            {packet.qrContent}
          </p>
        )}
        {(packet.headerText || packet.footerText) && (
          <p className="text-xs text-muted-foreground truncate">
            {packet.headerText || packet.footerText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GraphicViewer({
  packets,
  currentIndex,
  onClose,
  onNavigate,
  onEdit,
  onArchive,
}: {
  packets: ProductPacket[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onEdit: (packetId: string) => void;
  onArchive: (packetId: string) => void;
}) {
  const [showComposite, setShowComposite] = useState(true);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const packet = packets[currentIndex];
  
  if (!packet) return null;

  const hasComposite = !!packet.compositeUrl;
  const hasQrOnly = !!packet.qrOnlyUrl;
  const hasMultiple = hasComposite && hasQrOnly;
  const currentImage = showComposite && hasComposite ? packet.compositeUrl : packet.qrOnlyUrl;
  const currentLabel = showComposite && hasComposite ? "Composite" : "QR Only";

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < packets.length - 1;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && canGoPrev) onNavigate(currentIndex - 1);
    if (e.key === "ArrowRight" && canGoNext) onNavigate(currentIndex + 1);
    if (e.key === "Escape") onClose();
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
            data-testid="button-close-viewer"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
            {currentImage ? (
              <img
                src={currentImage}
                alt={packet.productName || 'Graphic'}
                className="max-w-full max-h-full object-contain"
                data-testid="img-viewer-graphic"
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
                onClick={() => onNavigate(currentIndex - 1)}
                data-testid="button-prev-packet"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            {canGoNext && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full shadow-lg"
                onClick={() => onNavigate(currentIndex + 1)}
                data-testid="button-next-packet"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}

            {hasMultiple && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-background/80 rounded-full px-3 py-1.5">
                <button
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${showComposite ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
                  onClick={() => setShowComposite(true)}
                  data-testid="dot-composite"
                />
                <button
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${!showComposite ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
                  onClick={() => setShowComposite(false)}
                  data-testid="dot-qr"
                />
              </div>
            )}

            <Badge variant="secondary" className="absolute top-4 left-4">
              {currentIndex + 1} / {packets.length}
            </Badge>

            {hasMultiple && (
              <Badge variant="outline" className="absolute top-4 left-20 bg-background/80">
                {currentLabel}
              </Badge>
            )}
          </div>

          <div className="p-4 border-t space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg truncate" data-testid="text-viewer-name">
                  {packet.productName || "Untitled Graphic"}
                </h3>
                {packet.qrProductState && (
                  <Badge variant="secondary" className="mt-1">
                    {packet.qrProductState.replace('qr_', '').toUpperCase()}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(packet.id)}
                  data-testid="button-edit-graphic"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchiveConfirm(true)}
                  data-testid="button-archive-graphic"
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Archive
                </Button>
              </div>
            </div>

            {packet.qrContent && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate flex-1" data-testid="text-viewer-url">
                  {packet.qrContent}
                </span>
                <a 
                  href={packet.qrContent} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            {(packet.headerText || packet.footerText) && (
              <div className="space-y-1">
                {packet.headerText && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Header:</span>{" "}
                    <span className="font-medium" data-testid="text-header">{packet.headerText}</span>
                  </p>
                )}
                {packet.footerText && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Footer:</span>{" "}
                    <span className="font-medium" data-testid="text-footer">{packet.footerText}</span>
                  </p>
                )}
              </div>
            )}

            {packet.pricing?.customerPrice && (
              <p className="text-sm text-muted-foreground">
                Price: <span className="font-medium text-foreground">${packet.pricing.customerPrice.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this graphic?</AlertDialogTitle>
              <AlertDialogDescription>
                This will hide the graphic from your library. You can restore it later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                onArchive(packet.id);
                setShowArchiveConfirm(false);
              }}>
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

export default function GraphicsTab() {
  const [, navigate] = useLocation();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; packets: ProductPacket[] }>({
    queryKey: ["/api/test/packets", "graphics"],
    queryFn: async () => {
      const res = await fetch("/api/test/packets");
      if (!res.ok) throw new Error("Failed to fetch packets");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (packetId: string) => {
      const res = await fetch(`/api/test/packets/${packetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/test/packets"] });
      toast({ title: "Archived", description: "Graphic has been archived" });
      setViewerIndex(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive graphic", variant: "destructive" });
    },
  });

  const packets = data?.packets || [];
  const packetsWithGraphics = packets.filter(p => (p.compositeUrl || p.qrOnlyUrl) && !p.archived);

  const handleEdit = (packetId: string) => {
    navigate(`/test-store-builder?packetId=${packetId}`);
  };

  const handleArchive = (packetId: string) => {
    archiveMutation.mutate(packetId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-graphics">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (packetsWithGraphics.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg">
        <QrCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground" data-testid="text-no-graphics">
          No graphics saved yet. Use the Products Builder to create graphics.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" data-testid="graphics-grid">
        {packetsWithGraphics.map((packet, index) => (
          <GraphicCard 
            key={packet.id} 
            packet={packet} 
            onClick={() => setViewerIndex(index)}
          />
        ))}
      </div>

      {viewerIndex !== null && (
        <GraphicViewer
          packets={packetsWithGraphics}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
          onEdit={handleEdit}
          onArchive={handleArchive}
        />
      )}
    </>
  );
}
