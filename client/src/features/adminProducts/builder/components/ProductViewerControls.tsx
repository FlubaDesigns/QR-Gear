import { Flag, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ProductViewerControlsProps {
  showUSA: boolean;
  showOther: boolean;
  usaCount: number;
  otherCount: number;
  onShowUSAChange: (checked: boolean) => void;
  onShowOtherChange: (checked: boolean) => void;
}

export function ProductViewerControls({
  showUSA,
  showOther,
  usaCount,
  otherCount,
  onShowUSAChange,
  onShowOtherChange,
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
          Made in USA ({usaCount})
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
          Made Elsewhere ({otherCount})
        </Label>
      </div>
    </div>
  );
}
