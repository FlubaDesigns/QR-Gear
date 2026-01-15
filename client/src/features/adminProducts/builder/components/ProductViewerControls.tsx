import { Flag, Globe, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch
          id="filter-usa"
          checked={showUSA}
          onCheckedChange={onShowUSAChange}
          data-testid="switch-filter-usa"
        />
        <Label htmlFor="filter-usa" className="flex items-center gap-1.5 cursor-pointer">
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
        <Label htmlFor="filter-other" className="flex items-center gap-1.5 cursor-pointer">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          Other ({otherCount})
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={genderFilter} onValueChange={(v) => onGenderFilterChange(v as GenderFilter)}>
          <SelectTrigger className="h-8 w-[140px]" data-testid="select-gender-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({genderCounts.all})</SelectItem>
            <SelectItem value="mens">Men's ({genderCounts.mens})</SelectItem>
            <SelectItem value="womens">Women's ({genderCounts.womens})</SelectItem>
            <SelectItem value="unisex">Unisex ({genderCounts.unisex})</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
