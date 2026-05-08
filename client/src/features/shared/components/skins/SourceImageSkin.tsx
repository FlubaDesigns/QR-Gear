import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crop, Trash2, Image } from "lucide-react";
import { ModalView } from "@/features/shared/components/shapes/ModalView";
import { SourceDetailShape } from "@/features/shared/components/shapes/SourceShape";
import type { CardSkinProps } from "./types";

// VVSS Skin: SourceCardSkin (digit 3)
// Owns the card tile AND the Shape popup (digit 4).
// Shape = SourceDetailShape rendered inside ModalView, state managed here.
// Actions (crop, delete) are passed in from the tab which owns the mutations.

export function SourceCardSkin({ item, actions, isActionPending }: CardSkinProps) {
  const [open, setOpen] = useState(false);

  const handleCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onCrop?.(item.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions?.onDelete?.(item.id);
  };

  const handleCropFromShape = () => {
    setOpen(false);
    actions?.onCrop?.(item.id);
  };

  const handleDeleteFromShape = () => {
    setOpen(false);
    actions?.onDelete?.(item.id);
  };

  return (
    <>
      <Card
        className="cursor-pointer transition-all"
        onClick={() => setOpen(true)}
        data-testid={`card-source-${item.id}`}
      >
        <div className="relative aspect-square bg-muted rounded-t-md overflow-hidden">
          {item.primaryImage ? (
            <img
              src={item.primaryImage}
              alt={item.name}
              className="w-full h-full object-cover"
              data-testid={`img-source-${item.id}`}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Image className="h-10 w-10" />
            </div>
          )}
          {item.dimensions && (
            <Badge variant="secondary" className="absolute top-1 right-1 text-xs">
              {item.dimensions}
            </Badge>
          )}
        </div>

        <CardContent className="p-2 space-y-2">
          <p
            className="text-xs truncate font-medium leading-tight"
            title={item.name}
            data-testid={`text-source-name-${item.id}`}
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
                data-testid={`button-crop-${item.id}`}
                title="Crop"
              >
                <Crop className="h-3 w-3" />
              </Button>
            )}
            {actions?.onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="flex-1 text-destructive"
                onClick={handleDelete}
                disabled={isActionPending}
                data-testid={`button-delete-${item.id}`}
                title="Archive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* VVSS Shape — digit 4 — owned by this Skin */}
      <ModalView
        open={open}
        onOpenChange={setOpen}
        title="Source Image"
        maxWidth="max-w-sm"
      >
        <div className="p-6">
          <SourceDetailShape
            item={item}
            actions={{
              onCrop:   actions?.onCrop   ? handleCropFromShape   : undefined,
              onDelete: actions?.onDelete ? handleDeleteFromShape : undefined,
            }}
            onClose={() => setOpen(false)}
          />
        </div>
      </ModalView>
    </>
  );
}
