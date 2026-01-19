import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, Image, Link as LinkIcon, QrCode, Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProductPacket {
  id: string;
  productName?: string;
  qrOnlyUrl?: string;
  compositeUrl?: string;
  qrContent?: string;
  qrProductState?: string;
  pricing?: {
    customerPrice?: number;
  };
  createdAt?: string | null;
}

function GraphicSwiperCard({ packet, onEdit }: { packet: ProductPacket; onEdit: (id: string) => void }) {
  const [showComposite, setShowComposite] = useState(true);
  
  const hasComposite = !!packet.compositeUrl;
  const hasQrOnly = !!packet.qrOnlyUrl;
  const hasMultiple = hasComposite && hasQrOnly;

  const handlePrev = () => setShowComposite(!showComposite);
  const handleNext = () => setShowComposite(!showComposite);

  const currentImage = showComposite ? packet.compositeUrl : packet.qrOnlyUrl;
  const currentLabel = showComposite ? "Composite" : "QR Only";

  return (
    <Card className="overflow-hidden group" data-testid={`graphic-card-${packet.id}`}>
      <div className="relative aspect-square bg-muted">
        {currentImage ? (
          <img
            src={currentImage}
            alt={`${packet.productName || 'Untitled'} - ${currentLabel}`}
            className="w-full h-full object-contain"
            data-testid="img-graphic"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-12 w-12" />
          </div>
        )}
        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/80 hover:bg-background"
              onClick={handlePrev}
              data-testid="button-prev-graphic"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/80 hover:bg-background"
              onClick={handleNext}
              data-testid="button-next-graphic"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              <div className={`h-2 w-2 rounded-full ${showComposite ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <div className={`h-2 w-2 rounded-full ${!showComposite ? "bg-primary" : "bg-muted-foreground/30"}`} />
            </div>
          </>
        )}
        <Badge 
          variant="secondary" 
          className="absolute top-2 right-2"
        >
          {currentLabel}
        </Badge>
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onEdit(packet.id)}
          data-testid={`button-edit-${packet.id}`}
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-medium truncate" data-testid="text-graphic-name">
          {packet.productName || "Untitled"}
        </h3>
        <div className="flex flex-wrap gap-1">
          {hasComposite && (
            <Badge variant="outline" className="text-xs">
              <Image className="h-3 w-3 mr-1" />
              Composite
            </Badge>
          )}
          {hasQrOnly && (
            <Badge variant="outline" className="text-xs">
              <QrCode className="h-3 w-3 mr-1" />
              QR Only
            </Badge>
          )}
          {packet.qrProductState && (
            <Badge variant="secondary" className="text-xs">
              {packet.qrProductState.replace('qr_', '').toUpperCase()}
            </Badge>
          )}
        </div>
        {packet.qrContent && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate" data-testid="text-qr-content">{packet.qrContent}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GraphicsTab() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ success: boolean; packets: ProductPacket[] }>({
    queryKey: ["/api/test/packets", "graphics"],
    queryFn: async () => {
      const res = await fetch("/api/test/packets");
      if (!res.ok) throw new Error("Failed to fetch packets");
      return res.json();
    },
  });

  const packets = data?.packets || [];
  const packetsWithGraphics = packets.filter(p => p.compositeUrl || p.qrOnlyUrl);

  const handleEdit = (packetId: string) => {
    navigate(`/test-store-builder?packetId=${packetId}`);
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="graphics-grid">
      {packetsWithGraphics.map(packet => (
        <GraphicSwiperCard key={packet.id} packet={packet} onEdit={handleEdit} />
      ))}
    </div>
  );
}
