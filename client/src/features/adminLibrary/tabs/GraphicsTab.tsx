import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, QrCode, ChevronLeft, ChevronRight, X, ImageIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { GraphicsCardSkin, GraphicsDetailSkin } from "@/features/shared/components/skins/GraphicsSkin";
import type { SkinItem } from "@/features/shared/components/skins/types";
import { adminFetch } from "@/lib/adminFetch";

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

function packetToSkinItem(packet: ProductPacket): SkinItem {
  const images: { url: string; label: string }[] = [];
  if (packet.compositeUrl) {
    images.push({ url: packet.compositeUrl, label: "Graphic" });
  }
  if (packet.qrOnlyUrl) {
    images.push({ url: packet.qrOnlyUrl, label: "QR Code" });
  }

  return {
    id: packet.id,
    packetId: packet.id,
    name: packet.productName || "Untitled",
    primaryImage: packet.compositeUrl,
    secondaryImage: packet.qrOnlyUrl,
    images: images.length > 0 ? images : undefined,
    qrContent: packet.qrContent,
    headerText: packet.headerText,
    footerText: packet.footerText,
    qrMode: packet.qrProductState?.replace('qr_', '').toUpperCase(),
    price: packet.pricing?.customerPrice,
    createdAt: packet.createdAt,
  };
}

export default function GraphicsTab() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showPrimary, setShowPrimary] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; packets: ProductPacket[] }>({
    queryKey: ["/api/admin/packets", "graphics"],
    queryFn: async () => {
      return adminFetch<any>("/packets");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (packetId: string) => {
      return adminFetch<any>(`/packets/${packetId}`, { method: "PATCH", json: { archived: true } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packets"] });
      toast({ title: "Archived", description: "Graphic has been archived" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive graphic", variant: "destructive" });
    },
  });

  const packets = data?.packets || [];
  const packetsWithGraphics = packets.filter(p => (p.compositeUrl || p.qrOnlyUrl) && !p.archived);
  const skinItems = packetsWithGraphics.map(packetToSkinItem);

  const selectedItem = selectedIndex !== null ? skinItems[selectedIndex] : null;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < skinItems.length - 1;
  const hasSecondaryImage = selectedItem?.secondaryImage && selectedItem?.primaryImage;
  const displayImage = selectedItem
    ? (showPrimary ? selectedItem.primaryImage : selectedItem.secondaryImage) || selectedItem.primaryImage || selectedItem.secondaryImage
    : null;

  const handlePrev = () => { if (hasPrev) { setSelectedIndex(selectedIndex! - 1); setShowPrimary(true); } };
  const handleNext = () => { if (hasNext) { setSelectedIndex(selectedIndex! + 1); setShowPrimary(true); } };
  const handleClose = () => { setSelectedIndex(null); setShowPrimary(true); };

  const handleEdit = (packetId: string) => {
    navigate(`/admin/store-builder?packetId=${packetId}`);
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
      <ScrollGridView
        items={skinItems}
        columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        height="auto"
        emptyMessage="No items to display."
        emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
        footer={null}
        renderItem={(item, index) => (
          <GraphicsCardSkin
            item={item}
            actions={{ onEdit: handleEdit, onArchive: handleArchive }}
            onClick={() => setSelectedIndex(index)}
          />
        )}
      />

      <ModalView
        open={selectedIndex !== null}
        onOpenChange={(open) => !open && handleClose()}
        title={selectedItem?.name || "Item Preview"}
        showCloseButton={false}
      >
        <div className="relative">
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70"
            onClick={handleClose}
            data-testid="button-gallery-close"
          >
            <X className="h-5 w-5 text-white" />
          </Button>

          <div className="relative aspect-square sm:aspect-video bg-muted flex items-center justify-center">
            {displayImage ? (
              <img
                src={displayImage}
                alt={selectedItem?.name || "Preview"}
                className="max-w-full max-h-full object-contain"
                data-testid="img-gallery-preview"
              />
            ) : (
              <ImageIcon className="h-24 w-24 text-muted-foreground" />
            )}

            {hasPrev && (
              <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={handlePrev} data-testid="button-gallery-prev">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {hasNext && (
              <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={handleNext} data-testid="button-gallery-next">
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            {hasSecondaryImage && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                <Button variant={showPrimary ? "default" : "secondary"} size="sm" onClick={() => setShowPrimary(true)} data-testid="button-show-composite">Composite</Button>
                <Button variant={!showPrimary ? "default" : "secondary"} size="sm" onClick={() => setShowPrimary(false)} data-testid="button-show-qr">QR Only</Button>
              </div>
            )}

            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {(selectedIndex ?? 0) + 1} / {skinItems.length}
            </div>
          </div>

          <div className="p-4 border-t flex flex-col items-center">
            {selectedItem && (
              <GraphicsDetailSkin
                item={selectedItem}
                actions={{
                  onEdit: handleEdit,
                  onArchive: () => setShowConfirm(true),
                }}
                isActionPending={archiveMutation.isPending}
                onClose={handleClose}
                onPrev={handlePrev}
                onNext={handleNext}
                hasPrev={hasPrev}
                hasNext={hasNext}
              />
            )}
          </div>
        </div>
      </ModalView>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this graphic?</AlertDialogTitle>
            <AlertDialogDescription>This will hide the graphic from your library. You can restore it later if needed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (selectedItem) handleArchive(selectedItem.id); setShowConfirm(false); }}
              data-testid="button-confirm-action"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
