import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Image, Link as LinkIcon, QrCode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SharedViewer, type GalleryViewItem } from "@/features/shared/components/SharedViewer";

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

function packetToGalleryItem(packet: ProductPacket): GalleryViewItem {
  return {
    id: packet.id,
    packetId: packet.id,
    name: packet.productName || "Untitled",
    primaryImage: packet.compositeUrl,
    secondaryImage: packet.qrOnlyUrl,
    qrContent: packet.qrContent,
    headerText: packet.headerText,
    footerText: packet.footerText,
    qrMode: packet.qrProductState?.replace('qr_', '').toUpperCase(),
    price: packet.pricing?.customerPrice,
  };
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

  const galleryItems = packetsWithGraphics.map(packetToGalleryItem);

  return (
    <>
      <SharedViewer mode="grid">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" data-testid="graphics-grid">
          {packetsWithGraphics.map((packet, index) => (
            <GraphicCard 
              key={packet.id} 
              packet={packet} 
              onClick={() => setViewerIndex(index)}
            />
          ))}
        </div>
      </SharedViewer>

      {viewerIndex !== null && (
        <SharedViewer
          mode="gallery"
          galleryProps={{
            items: galleryItems,
            currentIndex: viewerIndex,
            onClose: () => setViewerIndex(null),
            onNavigate: setViewerIndex,
            onEdit: handleEdit,
            onAction: handleArchive,
            isActionPending: archiveMutation.isPending,
            actionType: "archive",
            actionConfirmTitle: "Archive this graphic?",
            actionConfirmDescription: "This will hide the graphic from your library. You can restore it later if needed.",
          }}
        />
      )}
    </>
  );
}
