import { X, Package, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface LightboxItem {
  id: string;
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface LightboxAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: (items: LightboxItem[]) => void;
}

interface SharedLightboxProps {
  items: LightboxItem[];
  onRemoveItem: (itemId: string) => void;
  onClearAll: () => void;
  actions?: LightboxAction[];
  title?: string;
  emptyMessage?: string;
  className?: string;
}

export function SharedLightbox({
  items,
  onRemoveItem,
  onClearAll,
  actions = [],
  title = "Selected Items",
  emptyMessage = "No items selected",
  className,
}: SharedLightboxProps) {
  const hasItems = items.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col border-l bg-muted/30",
        className
      )}
      data-testid="panel-shared-lightbox"
    >
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{title}</span>
          {hasItems && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-lightbox-count">
              {items.length}
            </Badge>
          )}
        </div>
        {hasItems && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-xs h-7"
            data-testid="button-clear-all"
          >
            Clear All
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {!hasItems ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {emptyMessage}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-md bg-background border hover-elevate group"
                data-testid={`lightbox-item-${item.id}`}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-10 h-10 rounded object-cover bg-muted"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  {item.subtitle && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => onRemoveItem(item.id)}
                  data-testid={`button-remove-${item.id}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {hasItems && actions.length > 0 && (
        <div className="p-3 border-t bg-background space-y-2" data-testid="lightbox-actions">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || "default"}
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => action.onClick(items)}
              data-testid={`button-action-${action.id}`}
            >
              {action.icon || <ArrowRight className="w-4 h-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function createMoveAction(
  targetLabel: string,
  onMove: (items: LightboxItem[]) => void
): LightboxAction {
  return {
    id: "move",
    label: `Move to ${targetLabel}`,
    icon: <ArrowRight className="w-4 h-4" />,
    variant: "default",
    onClick: onMove,
  };
}

export function createDeleteAction(
  onDelete: (items: LightboxItem[]) => void
): LightboxAction {
  return {
    id: "delete",
    label: "Delete Selected",
    icon: <Trash2 className="w-4 h-4" />,
    variant: "destructive",
    onClick: onDelete,
  };
}
