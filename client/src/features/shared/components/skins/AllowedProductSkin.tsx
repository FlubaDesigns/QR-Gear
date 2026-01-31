import { Check, Package, DollarSign } from "lucide-react";
import type { CardSkinProps, DetailSkinProps, ProductPacket } from "./types";

export function AllowedProductCardSkin({ 
  item, 
  actions,
  onClick 
}: CardSkinProps & { selectedId?: string }) {
  const isSelected = item.isUsed;
  const metadata = item.metadata as Partial<ProductPacket> | undefined;
  const earnings = metadata?.memberEarnings || 0;
  
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
      <div className="relative aspect-square bg-slate-700 flex items-center justify-center overflow-hidden">
        {item.primaryImage ? (
          <img 
            src={item.primaryImage} 
            alt={item.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <Package className="w-12 h-12 text-slate-500" />
        )}
        {/* Earnings badge at bottom of image */}
        {earnings > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-bold">
                You earn ${earnings.toFixed(2)}
              </span>
            </div>
          </div>
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
  const metadata = item.metadata as Partial<ProductPacket> | undefined;
  
  const baseCost = metadata?.baseCost || 0;
  const retailPrice = metadata?.retailPrice || 0;
  const profit = metadata?.profit || 0;
  const earnings = metadata?.memberEarnings || 0;
  const upcharges = metadata?.upcharges;
  const brand = metadata?.brand;
  
  return (
    <div className="text-center space-y-4 w-full">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{item.name}</h3>
        {brand && <p className="text-sm text-muted-foreground">by {brand}</p>}
      </div>
      
      {/* Pricing Breakdown */}
      <div className="bg-slate-800/50 rounded-lg p-4 text-left space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Base Price</span>
          <span className="text-white">${baseCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Retail Price</span>
          <span className="text-white font-medium">${retailPrice.toFixed(2)}</span>
        </div>
        <div className="border-t border-slate-700 pt-2 flex justify-between text-sm">
          <span className="text-slate-400">Your Profit (25%)</span>
          <span className="text-green-400 font-bold">${earnings.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Size Upcharges */}
      {upcharges && Object.keys(upcharges).length > 0 && (
        <div className="bg-slate-800/30 rounded-lg p-3 text-left">
          <p className="text-xs text-slate-400 mb-2">Size Upcharges:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(upcharges).map(([size, upcharge]) => (
              <span key={size} className="text-xs bg-slate-700 px-2 py-1 rounded">
                {size}: +${upcharge.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {actions?.onSelect && (
        <button
          onClick={() => actions.onSelect?.(item.id)}
          disabled={isActionPending}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
          data-testid="button-select-product"
        >
          {item.isUsed ? 'Selected' : 'Select This Product'}
        </button>
      )}
    </div>
  );
}
