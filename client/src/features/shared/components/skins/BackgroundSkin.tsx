import { Trash2, Image, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CardSkinProps } from "./types";

// VVSS 1·1·1·0  Skin: BackgroundCardSkin
// Layer: Skin — flat card, no Shape popup.
// Actions (crop, archive) fire directly from card buttons.

export function BackgroundCardSkin({ item, actions, isActionPending }: CardSkinProps) {
  const handleCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onCrop?.(item.id);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  return (
    <Card data-testid={`card-background-${item.id}`}>
      <div className="relative aspect-square bg-muted rounded-t-md overflow-hidden">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid={`img-background-${item.id}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-10 w-10" />
          </div>
        )}
      </div>

      <CardContent className="p-2 space-y-2">
        <p
          className="text-xs truncate font-medium leading-tight"
          title={item.name}
          data-testid={`text-background-name-${item.id}`}
        >
          {item.name}
        </p>

        <div className="flex gap-1">
          {actions?.onCrop && (
            <Button
              size="icon"
              variant="outline"
              className="flex-1"
              onClick={handleCrop}
              disabled={isActionPending}
              data-testid={`button-crop-${item.id}`}
              title="Crop (9:16)"
            >
              <Crop className="h-3 w-3" />
            </Button>
          )}
          {actions?.onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="flex-1 text-destructive"
              onClick={handleArchive}
              disabled={isActionPending}
              data-testid={`button-archive-${item.id}`}
              title="Archive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
