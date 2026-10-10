import { useId } from 'react';
import { Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getColorHex } from '@shared/colorUtils';
import type { ProductColor } from '@shared/adapters/catalog.adapter';

export type { ProductColor } from '@shared/adapters/catalog.adapter';

type SelectableColor = ProductColor & { available?: boolean };
interface ColorSwatchPickerProps {
  label?: string;
  hideLabel?: boolean;
  colors: SelectableColor[];
  /** Canonical color name, never the display hex (distinct colors can share it). */
  selectedColor: string | null;
  onChange: (color: ProductColor) => void;
  displayType?: 'swatches' | 'dropdown';
  invalid?: boolean;
  disabled?: boolean;
  testIdPrefix?: string;
}

function getLuminance(hex: string): number {
  const rgb = hex.replace('#', '').match(/.{2}/g);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(c => parseInt(c, 16) / 255);
  const linear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function getContrastQRColor(productColorHex: string): 'black' | 'white' {
  return getLuminance(productColorHex) > 0.5 ? 'black' : 'white';
}

/** Shared product selection control. Callers supply QRG-approved colors and own side effects. */
export function ColorSwatchPicker({ label = 'Product Color', hideLabel = false, colors,
  selectedColor, onChange, displayType = 'swatches', invalid = false, disabled = false,
  testIdPrefix = 'color-swatch' }: ColorSwatchPickerProps) {
  const id = useId();
  const selected = colors.find(color => color.name === selectedColor && color.available !== false);
  const selectColor = (name: string) => {
    const color = colors.find(item => item.name === name && item.available !== false);
    if (color && !disabled) onChange({ name: color.name, hex: getColorHex(color) });
  };
  const swatch = (color: ProductColor) => <span className="w-4 h-4 rounded-full border border-border shrink-0" style={{ backgroundColor: getColorHex(color) }} />;
  const testId = (name: string) => `${testIdPrefix}-${name.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-2">
      {!hideLabel && <Label htmlFor={displayType === 'dropdown' ? id : undefined}>{label}</Label>}
      {!colors.some(color => color.available !== false) ? (
        <p role="status" className="text-sm text-muted-foreground">No colors available for this product.</p>
      ) : displayType === 'dropdown' ? (
        <Select value={selected?.name ?? ''} onValueChange={selectColor} disabled={disabled}>
          <SelectTrigger id={id} aria-label={label} aria-invalid={invalid} data-testid="select-color"
            className={`w-full min-h-12${invalid ? ' ring-2 ring-destructive ring-offset-1' : ''}`}>
            {selected ? <span className="flex items-center gap-2">{swatch(selected)}{selected.name}</span> : <SelectValue placeholder="Select a color" />}
          </SelectTrigger>
          <SelectContent>
            {colors.map(color => <SelectItem key={color.name} value={color.name} disabled={color.available === false} data-testid={testId(color.name)}>
              <span className="flex items-center gap-2">{swatch(color)}{color.name}</span>
            </SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <div role="group" aria-label={label} aria-invalid={invalid} className="flex flex-wrap gap-2">
          {colors.map(color => <button key={color.name} type="button" title={color.name}
            aria-label={color.name} aria-pressed={selected?.name === color.name}
            disabled={disabled || color.available === false} onClick={() => selectColor(color.name)}
            data-testid={testId(color.name)}
            className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${selected?.name === color.name ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
            style={{ backgroundColor: getColorHex(color) }}>
            {selected?.name === color.name && <Check className="h-5 w-5" style={{ color: getContrastQRColor(getColorHex(color)) }} />}
          </button>)}
        </div>
      )}
      {displayType === 'swatches' && selected && <p className="text-sm">Selected: {selected.name}</p>}
      {selectedColor && !selected && <p role="alert" className="text-sm text-destructive">Choose an available color.</p>}
    </div>
  );
}
