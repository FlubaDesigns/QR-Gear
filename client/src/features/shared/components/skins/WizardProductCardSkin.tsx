import { Badge } from "@/components/ui/badge";
import { Check, Package, DollarSign } from "lucide-react";
import type { WizardMode } from "@shared/wizardProduct";

export interface WizardProductItem {
  id: string | number;
  canonicalBlankKey: string;
  blueprintId: number;
  title: string;
  imageUrl: string;
  description?: string;
  retailPrice?: number;
  memberEarnings?: number;
  brand?: string;
  colorCount?: number;
  sizeCount?: number;
}

export interface WizardProductCardSkinProps {
  item: WizardProductItem;
  isSelected: boolean;
  mode: WizardMode;
  onSelect: (item: WizardProductItem) => void;
  onOpenDetail: (item: WizardProductItem) => void;
}

export function WizardProductCardSkin({
  item,
  isSelected,
  mode,
  onSelect,
  onOpenDetail,
}: WizardProductCardSkinProps) {
  return (
    <button
      onClick={() => onSelect(item)}
      className={`w-full flex items-center gap-3 p-2 rounded-xl border-2 transition-all text-left ${
        isSelected
          ? "border-orange-500 bg-orange-500/15"
          : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
      }`}
      data-testid={`button-product-${item.canonicalBlankKey}`}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title}
          loading="lazy"
          className="w-14 h-14 rounded-lg object-cover bg-white flex-shrink-0 cursor-zoom-in"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(item);
          }}
          data-testid={`img-product-${item.canonicalBlankKey}`}
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
          <Package className="w-7 h-7 text-slate-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
        )}
        {item.retailPrice != null && (
          <p className="text-base font-bold text-emerald-400">${item.retailPrice.toFixed(2)}</p>
        )}
        {mode === "member" && item.memberEarnings != null && (
          <p className="text-xs text-green-400">Earn ${item.memberEarnings.toFixed(2)}</p>
        )}
      </div>
      {isSelected && <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />}
    </button>
  );
}
