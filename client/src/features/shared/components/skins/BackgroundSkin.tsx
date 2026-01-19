import { Trash2, Image, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CardSkinProps, DetailSkinProps } from "./types";

export function BackgroundCardSkin({ item, onClick }: CardSkinProps) {
  return (
    <Card 
      className="overflow-hidden cursor-pointer hover-elevate transition-all" 
      onClick={onClick}
      data-testid={`background-card-${item.id}`}
    >
      <div className="relative aspect-video bg-muted">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid="img-background"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Image className="h-12 w-12" />
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-medium text-sm truncate" data-testid="text-background-name">
          {item.name}
        </h3>
      </CardContent>
    </Card>
  );
}

export function BackgroundDetailSkin({ 
  item, 
  actions, 
  isActionPending,
}: DetailSkinProps) {
  const formattedDate = item.createdAt 
    ? new Date(item.createdAt).toLocaleDateString() 
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg truncate" data-testid="text-gallery-name">
          {item.name}
        </h3>
        {formattedDate && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </p>
        )}
      </div>

      <div className="grid-2x2">
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
    </div>
  );
}
