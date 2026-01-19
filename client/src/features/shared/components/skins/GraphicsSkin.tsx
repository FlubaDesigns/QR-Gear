import { Archive, Edit, Link as LinkIcon, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CardSkinProps, DetailSkinProps, SkinItem } from "./types";

export function GraphicsCardSkin({ item, onClick }: CardSkinProps) {
  const imageUrl = item.primaryImage || item.secondaryImage;
  const hasMultipleImages = !!(item.primaryImage && item.secondaryImage);

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover-elevate transition-all" 
      onClick={onClick}
      data-testid={`graphic-card-${item.id}`}
    >
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-contain"
            data-testid="img-graphic"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <QrCode className="h-12 w-12" />
          </div>
        )}
        {hasMultipleImages && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
            2 images
          </Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <h3 className="font-medium text-sm truncate" data-testid="text-graphic-name">
          {item.name}
        </h3>
        {item.qrContent && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            {item.qrContent}
          </p>
        )}
        {(item.headerText || item.footerText) && (
          <p className="text-xs text-muted-foreground truncate">
            {item.headerText || item.footerText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function GraphicsDetailSkin({ 
  item, 
  actions, 
  isActionPending,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: DetailSkinProps) {
  return (
    <div className="space-y-4">
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
              <Badge variant="outline">{item.colorCount} colors</Badge>
            )}
            {(item.sizeCount ?? 0) > 0 && (
              <Badge variant="outline">{item.sizeCount} sizes</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {actions.onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onEdit!(item.packetId || item.id)}
              data-testid="button-gallery-edit"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {actions.onArchive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onArchive!(item.id)}
              disabled={isActionPending}
              data-testid="button-gallery-archive"
            >
              <Archive className="h-4 w-4 mr-1" />
              Archive
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

      {item.price && (
        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
          <span className="text-sm text-muted-foreground">Price:</span>
          <span className="font-semibold text-primary" data-testid="text-gallery-price">
            ${item.price.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
