import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

export interface PriceBreakdownData {
  baseCost: number;
  qrUpcharge: number;
  markupPercent: number;
  customerPrice: number | null;
  textUpcharge?: number;
}

export interface PriceBreakdownSkinProps {
  data: PriceBreakdownData;
  compact?: boolean;
}

export function PriceBreakdownSkin({ data, compact = false }: PriceBreakdownSkinProps) {
  const { baseCost, qrUpcharge, markupPercent, customerPrice, textUpcharge } = data;
  const hasCost = baseCost > 0 || customerPrice !== null;

  const calculatedPrice = baseCost > 0
    ? ((baseCost + qrUpcharge + (textUpcharge || 0)) * (1 + markupPercent / 100))
    : null;
  const displayPrice = customerPrice ?? calculatedPrice;

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap" data-testid="price-breakdown-compact">
        <span className="text-xs text-muted-foreground">
          Cost: {baseCost > 0 ? `$${baseCost.toFixed(2)}` : "--"}
        </span>
        <span className="text-xs text-muted-foreground">+${qrUpcharge.toFixed(2)} QR</span>
        {(textUpcharge ?? 0) > 0 && (
          <span className="text-xs text-muted-foreground">+${textUpcharge!.toFixed(2)} text</span>
        )}
        <span className="text-xs text-muted-foreground">+{markupPercent}%</span>
        <span className="text-sm font-bold text-green-600" data-testid="price-customer">
          {displayPrice ? `$${displayPrice.toFixed(2)}` : "--"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 flex-wrap" data-testid="price-breakdown">
      <div>
        <div className="text-[10px] text-muted-foreground uppercase">Cost</div>
        <div className="text-xs text-muted-foreground" data-testid="price-base-cost">
          {baseCost > 0 ? `$${baseCost.toFixed(2)}` : <span className="text-amber-500">No cost</span>}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground uppercase">+QR</div>
        <div className="text-xs text-muted-foreground">${qrUpcharge.toFixed(2)}</div>
      </div>
      {(textUpcharge ?? 0) > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">+Text</div>
          <div className="text-xs text-muted-foreground">${textUpcharge!.toFixed(2)}</div>
        </div>
      )}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase">+{markupPercent}%</div>
        <div className="text-xs text-muted-foreground">markup</div>
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground uppercase">Customer Price</div>
        <div className="text-lg font-bold text-green-600" data-testid="price-customer">
          {displayPrice ? `$${displayPrice.toFixed(2)}` : <span className="text-amber-500">--</span>}
        </div>
      </div>
    </div>
  );
}

export default PriceBreakdownSkin;
