import { Check, Package } from "lucide-react";
import type { CardSkinProps, DetailSkinProps } from "./types";

export function AllowedProductCardSkin({ 
  item, 
  actions,
  onClick 
}: CardSkinProps & { selectedId?: string }) {
  const isSelected = item.isUsed;
  
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden border-2 transition-all text-left w-full ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-slate-600 hover:border-slate-500'
      }`}
      data-testid={`product-card-${item.id}`}
    >
      <div className="aspect-square bg-slate-700 flex items-center justify-center overflow-hidden">
        {item.primaryImage ? (
          <img 
            src={item.primaryImage} 
            alt={item.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <Package className="w-12 h-12 text-slate-500" />
        )}
      </div>
      <div className="p-3 bg-slate-800">
        <p className="text-sm text-white truncate">{item.name}</p>
      </div>
      {isSelected && (
        <div className="absolute top-2 right-2 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
    </button>
  );
}

export function AllowedProductDetailSkin({ 
  item, 
  actions,
  isActionPending,
  onClose 
}: DetailSkinProps) {
  return (
    <div className="text-center space-y-3 w-full">
      <h3 className="text-lg font-semibold text-foreground">{item.name}</h3>
      {actions?.onSelect && (
        <button
          onClick={() => actions.onSelect?.(item.id)}
          disabled={isActionPending}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          data-testid="button-select-product"
        >
          {item.isUsed ? 'Selected' : 'Select This Product'}
        </button>
      )}
    </div>
  );
}
