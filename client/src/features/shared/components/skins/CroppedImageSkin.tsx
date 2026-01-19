import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Image, Check } from "lucide-react";
import type { CardSkinProps, DetailSkinProps } from "./types";

export function CroppedImageCardSkin({ item, onClick, actions }: CardSkinProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover-elevate transition-all" 
      onClick={onClick}
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
          <Badge variant="default" className="absolute top-2 right-2 text-xs">
            <Check className="h-3 w-3 mr-1" />
            In Use
          </Badge>
        )}
      </div>
      <CardContent className="p-2">
        <p className="text-xs truncate font-medium" data-testid="text-cropped-name">{item.name}</p>
        <div className="flex gap-1 mt-2">
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

export function CroppedImageDetailSkin({ item, actions }: DetailSkinProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg" data-testid="text-cropped-detail-name">{item.name}</h3>
        {item.isUsed && (
          <Badge variant="default">
            <Check className="h-3 w-3 mr-1" />
            In Use
          </Badge>
        )}
      </div>

      <div className="grid-2x2">
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
