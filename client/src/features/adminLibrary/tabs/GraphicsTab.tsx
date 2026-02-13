import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SkinGridViewer } from "@/features/shared/components/SkinGridViewer";
import { GraphicsCardSkin, GraphicsDetailSkin } from "@/features/shared/components/skins/GraphicsSkin";
import type { SkinItem } from "@/features/shared/components/skins/types";

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
  // Build images array for gallery view - Graphics show the artwork
  const images: { url: string; label: string }[] = [];
  
  // 1. Composite graphic (primary for graphics)
  if (packet.compositeUrl) {
    images.push({ url: packet.compositeUrl, label: "Graphic" });
  }
  
  // 2. QR code
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
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive graphic", variant: "destructive" });
    },
  });

  const packets = data?.packets || [];
  const packetsWithGraphics = packets.filter(p => (p.compositeUrl || p.qrOnlyUrl) && !p.archived);
  const skinItems = packetsWithGraphics.map(packetToSkinItem);

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
    <SkinGridViewer
      items={skinItems}
      CardSkin={GraphicsCardSkin}
      DetailSkin={GraphicsDetailSkin}
      actions={{
        onEdit: handleEdit,
        onArchive: handleArchive,
      }}
      isActionPending={archiveMutation.isPending}
      confirmAction={{
        type: "archive",
        title: "Archive this graphic?",
        description: "This will hide the graphic from your library. You can restore it later if needed.",
      }}
    />
  );
}
