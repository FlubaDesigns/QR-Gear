import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crop, Trash2, Image } from "lucide-react";
import type { CardSkinProps, DetailSkinProps } from "./types";

export function SourceImageCardSkin({ item, onClick, actions }: CardSkinProps) {
  const handleCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onCrop?.(item.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover-elevate transition-all" 
      onClick={onClick}
      data-testid={`card-source-${item.id}`}
    >
      <div className="relative aspect-square bg-muted">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid="img-source"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-12 w-12" />
          </div>
        )}
        {item.dimensions && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
            {item.dimensions}
          </Badge>
        )}
      </div>
      <CardContent className="p-2">
        <p className="text-xs truncate font-medium" data-testid="text-source-name">{item.name}</p>
        <div className="flex gap-1 mt-2">
          {actions?.onCrop && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={handleCrop}
              data-testid={`button-crop-${item.id}`}
            >
              <Crop className="h-3 w-3" />
            </Button>
          )}
          {actions?.onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={handleDelete}
              data-testid={`button-delete-${item.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SourceImageDetailSkin({ item, actions, onClose }: DetailSkinProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg" data-testid="text-source-detail-name">{item.name}</h3>
        {item.dimensions && (
          <p className="text-sm text-muted-foreground">Dimensions: {item.dimensions}</p>
        )}
      </div>

      <div className="grid-2x2">
        {actions?.onCrop && (
          <Button
            variant="outline"
            className="w-full h-14 text-base"
            onClick={() => { actions.onCrop?.(item.id); onClose?.(); }}
            data-testid="button-detail-crop"
          >
            <Crop className="h-5 w-5 mr-2" />
            Crop
          </Button>
        )}
        {actions?.onDelete && (
          <Button
            variant="destructive"
            className="w-full h-14 text-base"
            onClick={() => actions.onDelete?.(item.id)}
            data-testid="button-detail-delete"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
