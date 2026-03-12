import { Badge } from "@/components/ui/badge";
import { Star, Award, Crown } from "lucide-react";

export interface TierItem {
  id: string;
  tierKey: string;
  displayName: string;
  tagline?: string;
  description?: string;
  productCount: number;
  previewImages: string[];
}

export interface TierCardSkinProps {
  item: TierItem;
  onSelect: (tierKey: string) => void;
}

const TIER_ICONS: Record<string, typeof Star> = {
  good: Star,
  better: Award,
  best: Crown,
};

const TIER_STYLES: Record<string, { border: string; bg: string; glow: string; accent: string }> = {
  good: {
    border: "border-blue-500",
    bg: "bg-blue-500/10",
    glow: "bg-blue-500/20",
    accent: "text-blue-400",
  },
  better: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    glow: "bg-amber-500/20",
    accent: "text-amber-400",
  },
  best: {
    border: "border-emerald-500",
    bg: "bg-emerald-500/10",
    glow: "bg-emerald-500/20",
    accent: "text-emerald-400",
  },
};

export function TierCardSkin({ item, onSelect }: TierCardSkinProps) {
  const style = TIER_STYLES[item.tierKey] || TIER_STYLES.good;
  const Icon = TIER_ICONS[item.tierKey] || Star;

  return (
    <button
      onClick={() => onSelect(item.tierKey)}
      className={`w-full p-4 rounded-xl border-2 transition-all text-left relative overflow-visible ${style.border} ${style.bg} hover:scale-[1.01]`}
      data-testid={`button-tier-${item.tierKey}`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 ${style.glow}`}>
          <Icon className={`w-6 h-6 ${style.accent}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-bold ${style.accent}`}>
            {item.displayName}
          </h3>
          {item.tagline && (
            <p className="text-sm text-slate-300 mt-0.5">{item.tagline}</p>
          )}
          {item.description && (
            <p className="text-xs text-slate-400 mt-1">{item.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {item.productCount} {item.productCount === 1 ? "product" : "products"}
            </Badge>
            {item.previewImages.slice(0, 3).map((imgUrl, idx) => (
              <img
                key={idx}
                src={imgUrl}
                alt=""
                className="w-8 h-8 rounded-md object-cover bg-white border border-slate-600"
                loading="lazy"
              />
            ))}
            {item.productCount > 3 && (
              <span className="text-xs text-slate-500">+{item.productCount - 3} more</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
