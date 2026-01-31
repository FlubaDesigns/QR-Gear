import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Image, Check } from "lucide-react";
import type { CardSkinProps, DetailSkinProps } from "./types";

export function CroppedImageCardSkin({ item, onClick, actions }: CardSkinProps) {
  const handleClick = () => {
    if (actions?.onSelect) {
      actions.onSelect(item.id);
    } else {
      onClick?.();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  return (
    <Card 
      className={`overflow-hidden cursor-pointer hover-elevate transition-all ${item.isUsed ? 'ring-2 ring-primary' : ''}`}
      onClick={handleClick}
      data-testid={`card-cropped-${item.id}`}
    >
      <div className="relative aspect-[9/16] bg-muted">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid="img-cropped"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-12 w-12" />
          </div>
        )}
        {item.isUsed && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <Check className="h-8 w-8 text-primary" />
          </div>
        )}
      </div>
      <CardContent className="p-2">
        <p className="text-xs truncate font-medium" data-testid="text-cropped-name">{item.name}</p>
        {actions?.onDelete && (
          <div className="flex gap-1 mt-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={handleDelete}
              data-testid={`button-delete-${item.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CroppedImageDetailSkin({ item, actions }: DetailSkinProps) {
  return (
    <div className="space-y-4 w-full max-w-md">
      <div className="space-y-2 text-center">
        <h3 className="font-semibold text-lg" data-testid="text-cropped-detail-name">{item.name}</h3>
        {item.isUsed && (
          <Badge variant="default">
            <Check className="h-3 w-3 mr-1" />
            In Use
          </Badge>
        )}
      </div>

      <div className="grid-2x2 w-full">
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
