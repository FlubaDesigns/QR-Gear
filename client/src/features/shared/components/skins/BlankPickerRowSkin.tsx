import { Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UsaFlag from "@/components/UsaFlag";
import type { TierValue, ProductSelectItem } from "./ProductSelectCardSkin";

const TIER_COLORS: Record<string, string> = {
  good: "bg-blue-600 text-white",
  better: "bg-amber-500 text-white",
  best: "bg-emerald-600 text-white",
};

const TIER_LABELS: Record<string, string> = {
  good: "Good",
  better: "Better",
  best: "Best",
};

export interface BlankPickerRowSkinProps {
  item: ProductSelectItem;
  isSelected: boolean;
  onSelect: () => void;
  tier?: TierValue;
  onTierChange?: (tier: TierValue) => void;
  showTierControls?: boolean;
  selectLabel?: React.ReactNode;
  selectedLabel?: React.ReactNode;
  disableWhenSelected?: boolean;
}

export function BlankPickerRowSkin({
  item,
  isSelected,
  onSelect,
  tier,
  onTierChange,
  showTierControls,
  selectLabel,
  selectedLabel,
  disableWhenSelected,
}: BlankPickerRowSkinProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 py-2.5 px-2 rounded-md transition-colors ${isSelected ? "bg-primary/5" : ""}`}
      data-testid={`row-blank-${item.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-md bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
          {item.primaryImageUrl ? (
            <img
              src={item.primaryImageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain p-1"
              data-testid={`img-row-${item.id}`}
            />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className="text-sm font-medium leading-tight line-clamp-1"
              data-testid={`text-row-name-${item.id}`}
            >
              {item.name}
            </p>
            {item.madeInUSA && <UsaFlag className="w-3 h-2 flex-shrink-0" />}
            {tier && (
              <Badge
                className={`text-[10px] px-1.5 py-0 ${TIER_COLORS[tier]}`}
                data-testid={`badge-row-tier-${item.id}`}
              >
                {TIER_LABELS[tier]}
              </Badge>
            )}
          </div>
          {item.price != null && (
            <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-row-price-${item.id}`}>
              ${item.price.toFixed(2)}
              {item.cost != null && ` · cost $${item.cost.toFixed(2)}`}
            </p>
          )}
        </div>

        <Button
          size="sm"
          variant={isSelected ? "secondary" : "default"}
          className="flex-shrink-0"
          onClick={onSelect}
          disabled={isSelected && !!disableWhenSelected}
          data-testid={`button-row-select-${item.id}`}
        >
          {isSelected ? (
            selectedLabel ?? (
              <>
                <Check className="w-3.5 h-3.5 mr-1" />
                Added
              </>
            )
          ) : (
            selectLabel ?? "Add"
          )}
        </Button>
      </div>

      {showTierControls && isSelected && onTierChange && (
        <div className="flex gap-1.5 pl-14" data-testid={`tier-controls-row-${item.id}`}>
          {(["good", "better", "best"] as const).map(t => (
            <Button
              key={t}
              size="sm"
              variant={tier === t ? "default" : "outline"}
              className={`flex-1 text-xs h-7 ${tier === t ? TIER_COLORS[t] : ""}`}
              onClick={() => onTierChange(tier === t ? null : t)}
              data-testid={`button-row-tier-${t}-${item.id}`}
            >
              {TIER_LABELS[t]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
