import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";

export interface ProductColor {
  name: string;
  hex: string;
}

interface ColorSwatchPickerProps {
  label?: string;
  colors: ProductColor[];
  selectedColor: string | null;
  onChange: (color: ProductColor) => void;
  testIdPrefix?: string;
}

function getLuminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => parseInt(c, 16) / 255);
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastQRColor(productColorHex: string): "black" | "white" {
  const luminance = getLuminance(productColorHex);
  return luminance > 0.5 ? "black" : "white";
}

export function ColorSwatchPicker({
  label = "Product Color",
  colors,
  selectedColor,
  onChange,
  testIdPrefix = "color-swatch",
}: ColorSwatchPickerProps) {
  if (!colors || colors.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">No colors available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {colors.map((color, index) => {
          const isSelected = selectedColor === color.hex;
          const checkColor = getLuminance(color.hex) > 0.5 ? "#000000" : "#ffffff";
          
          return (
            <button
              key={`${color.hex}-${index}`}
              type="button"
              onClick={() => onChange(color)}
              className={`
                w-10 h-10 rounded-full border-2 transition-all
                flex items-center justify-center
                ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}
              `}
              style={{ backgroundColor: color.hex }}
              title={color.name}
              data-testid={`${testIdPrefix}-${index}`}
            >
              {isSelected && (
                <Check className="h-5 w-5" style={{ color: checkColor }} />
              )}
            </button>
          );
        })}
      </div>
      {selectedColor && (
        <p className="text-xs text-muted-foreground">
          Selected: {colors.find(c => c.hex === selectedColor)?.name || selectedColor}
        </p>
      )}
    </div>
  );
}
