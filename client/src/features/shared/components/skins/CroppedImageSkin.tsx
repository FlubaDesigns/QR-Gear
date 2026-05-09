import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Image } from "lucide-react";
import type { CardSkinProps } from "./types";

// VVSS 1·1·1·0  Skin: CroppedCardSkin
// Layer: Skin — flat card, no Shape popup.
// Actions (archive) fire directly from card buttons.

export function CroppedCardSkin({ item, actions, isActionPending }: CardSkinProps) {
  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  return (
    <Card data-testid={`card-cropped-${item.id}`}>
      <div className="bg-muted rounded-t-md p-2">
        <div className="relative aspect-[9/16] overflow-hidden rounded-sm">
          {item.primaryImage ? (
            <img
              src={item.primaryImage}
              alt={item.name}
              className="w-full h-full object-cover"
              data-testid={`img-cropped-${item.id}`}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Image className="h-10 w-10" />
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-2 space-y-2">
        <p
          className="text-xs truncate font-medium leading-tight"
          title={item.name}
          data-testid={`text-cropped-name-${item.id}`}
        >
          {item.name}
        </p>

        <div className="flex gap-1">
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
