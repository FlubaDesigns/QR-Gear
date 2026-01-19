import { Trash2, Edit, Link as LinkIcon, ExternalLink, Image, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CardSkinProps, DetailSkinProps } from "./types";

export function TemplateCardSkin({ item, onClick }: CardSkinProps) {
  const imageUrl = item.primaryImage || item.secondaryImage;

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover-elevate transition-all" 
      onClick={onClick}
      data-testid={`template-card-${item.id}`}
    >
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-contain"
            data-testid="img-template"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-12 w-12" />
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <h3 className="font-medium text-sm truncate" data-testid="text-template-name">
          {item.name}
        </h3>
        {item.qrContent && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            {item.qrContent}
          </p>
        )}
        {item.price && (
          <p className="text-xs font-medium text-primary">
            ${item.price.toFixed(2)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TemplateDetailSkin({ 
  item, 
  actions, 
  isActionPending,
}: DetailSkinProps) {
  return (
    <div className="space-y-4 w-full max-w-md">
      <div className="space-y-2 text-center">
        <h3 className="font-semibold text-lg truncate" data-testid="text-gallery-name">
          {item.name}
        </h3>
        <div className="flex flex-wrap gap-1 justify-center">
          {item.qrMode && (
            <Badge variant="secondary">
              <Package className="h-3 w-3 mr-1" />
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

      <div className="grid-2x2 w-full">
        {actions?.onEdit && (
          <Button
            variant="outline"
            className="w-full h-14 text-base"
            onClick={() => actions.onEdit?.(item.packetId || item.id)}
            data-testid="button-gallery-edit"
          >
            <Edit className="h-5 w-5 mr-2" />
            Edit
          </Button>
        )}
        {actions?.onDelete && (
          <Button
            variant="destructive"
            className="w-full h-14 text-base"
            onClick={() => actions.onDelete?.(item.id)}
            disabled={isActionPending}
            data-testid="button-gallery-delete"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Delete
          </Button>
        )}
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
              <span className="font-medium">{item.headerText}</span>
            </p>
          )}
          {item.footerText && (
            <p className="text-sm">
              <span className="text-muted-foreground">Footer:</span>{" "}
              <span className="font-medium">{item.footerText}</span>
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
