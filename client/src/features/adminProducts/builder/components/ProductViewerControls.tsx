import { Flag, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { GenderFilter } from "../types";

interface ProductViewerControlsProps {
  showUSA: boolean;
  showOther: boolean;
  usaCount: number;
  otherCount: number;
  genderFilter: GenderFilter;
  genderCounts: { all: number; mens: number; womens: number; unisex: number };
  onShowUSAChange: (checked: boolean) => void;
  onShowOtherChange: (checked: boolean) => void;
  onGenderFilterChange: (filter: GenderFilter) => void;
}

export function ProductViewerControls({
  showUSA,
  showOther,
  usaCount,
  otherCount,
  genderFilter,
  genderCounts,
  onShowUSAChange,
  onShowOtherChange,
  onGenderFilterChange,
}: ProductViewerControlsProps) {
  const genderOptions: { value: GenderFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: genderCounts.all },
    { value: "mens", label: "Men", count: genderCounts.mens },
    { value: "womens", label: "Women", count: genderCounts.womens },
    { value: "unisex", label: "Unisex", count: genderCounts.unisex },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="filter-usa"
            checked={showUSA}
            onCheckedChange={onShowUSAChange}
            data-testid="switch-filter-usa"
          />
          <Label htmlFor="filter-usa" className="flex items-center gap-1.5 cursor-pointer text-sm">
            <Flag className="h-3.5 w-3.5 text-blue-600" />
            USA ({usaCount})
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="filter-other"
            checked={showOther}
            onCheckedChange={onShowOtherChange}
            data-testid="switch-filter-other"
          />
          <Label htmlFor="filter-other" className="flex items-center gap-1.5 cursor-pointer text-sm">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            Other ({otherCount})
          </Label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {genderOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("[GenderFilter] Tapped:", opt.value);
              onGenderFilterChange(opt.value);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              genderFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`button-gender-${opt.value}`}
          >
            {opt.label} ({opt.count})
          </button>
        ))}
      </div>
    </div>
  );
}
