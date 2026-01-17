import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Image, Link as LinkIcon, QrCode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLibraryContext } from "../LibraryContext";

interface GraphicAsset {
  id: string;
  name?: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  category?: string;
  metadata?: {
    isQrOnly?: boolean;
    isComposite?: boolean;
    storeId?: string;
    channelId?: string;
    qrContent?: string;
  };
  createdAt?: any;
}

interface GraphicPair {
  qrOnly?: GraphicAsset;
  composite?: GraphicAsset;
  name: string;
  qrContent?: string;
}

function GraphicSwiperCard({ pair }: { pair: GraphicPair }) {
  const [showComposite, setShowComposite] = useState(true);
  const images = [
    { label: "Composite", asset: pair.composite },
    { label: "QR Only", asset: pair.qrOnly },
  ].filter(i => i.asset);

  const handlePrev = () => setShowComposite(!showComposite);
  const handleNext = () => setShowComposite(!showComposite);

  const currentImage = showComposite ? pair.composite : pair.qrOnly;
  const currentLabel = showComposite ? "Composite" : "QR Only";

  return (
    <Card className="overflow-hidden" data-testid={`graphic-card-${pair.composite?.id || pair.qrOnly?.id}`}>
      <div className="relative aspect-square bg-muted">
        {currentImage?.publicUrl ? (
          <img
            src={currentImage.publicUrl}
            alt={`${pair.name} - ${currentLabel}`}
            className="w-full h-full object-contain"
            data-testid="img-graphic"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-12 w-12" />
          </div>
        )}
        {images.length > 1 && (
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
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-medium truncate" data-testid="text-graphic-name">
          {pair.name}
        </h3>
        <div className="flex flex-wrap gap-1">
          {pair.composite && (
            <Badge variant="outline" className="text-xs">
              <Image className="h-3 w-3 mr-1" />
              Composite
            </Badge>
          )}
          {pair.qrOnly && (
            <Badge variant="outline" className="text-xs">
              <QrCode className="h-3 w-3 mr-1" />
              QR Only
            </Badge>
          )}
        </div>
        {pair.qrContent && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate" data-testid="text-qr-content">{pair.qrContent}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GraphicsTab() {
  const { api } = useLibraryContext();

  const { data: assets = [], isLoading } = useQuery<GraphicAsset[]>({
    queryKey: [...api.getQueryKey("source"), "graphics"],
    queryFn: async () => {
      const allAssets = await api.fetchAssets("source");
      return allAssets.filter((a: any) => a.category?.includes('graphic')) as GraphicAsset[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-graphics">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pairs: GraphicPair[] = [];
  const processedIds = new Set<string>();

  for (const asset of assets) {
    if (processedIds.has(asset.id)) continue;

    const baseName = asset.name?.replace(/ - (QR Only|Composite)$/, "") || "Untitled";
    
    const matchingAsset = assets.find(a => 
      a.id !== asset.id && 
      a.name?.replace(/ - (QR Only|Composite)$/, "") === baseName
    );

    if (matchingAsset) {
      processedIds.add(asset.id);
      processedIds.add(matchingAsset.id);

      const isQrOnly = asset.metadata?.isQrOnly || asset.name?.includes("QR Only");
      pairs.push({
        name: baseName,
        qrOnly: isQrOnly ? asset : matchingAsset,
        composite: isQrOnly ? matchingAsset : asset,
        qrContent: asset.metadata?.qrContent || matchingAsset?.metadata?.qrContent,
      });
    } else {
      processedIds.add(asset.id);
      const isQrOnly = asset.metadata?.isQrOnly || asset.name?.includes("QR Only");
      pairs.push({
        name: baseName,
        qrOnly: isQrOnly ? asset : undefined,
        composite: isQrOnly ? undefined : asset,
        qrContent: asset.metadata?.qrContent,
      });
    }
  }

  if (pairs.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg">
        <QrCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground" data-testid="text-no-graphics">
          No graphics saved yet. Use the Products Builder to save graphics.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="graphics-grid">
      {pairs.map((pair, idx) => (
        <GraphicSwiperCard key={pair.composite?.id || pair.qrOnly?.id || idx} pair={pair} />
      ))}
    </div>
  );
}
