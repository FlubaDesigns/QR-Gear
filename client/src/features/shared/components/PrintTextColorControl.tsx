import { createContext, useContext } from 'react';
import { resolvePrintTextColor, printTextContrastWarning, type PrintTextBackground, type PrintTextStyle, type PrintTextColorMode } from '@shared/printTextColor';

/** Controllers supply the selected canonical color, including the Admin fabric exception. */
export const PrintTextBackgroundContext = createContext<PrintTextBackground | null | undefined>(undefined);

export function usePrintTextPreview(style?: PrintTextStyle | null, backgroundHex?: string) {
  const selected = useContext(PrintTextBackgroundContext);
  const background = selected === undefined ? { hex: backgroundHex } : selected;
  try { return { background, color: style ? resolvePrintTextColor(style, background) : undefined, error: null }; }
  catch (error) { return { background, color: undefined, error: (error as Error).message }; }
}

export function PrintTextColorControl({ style, onChange, id }: {
  style: PrintTextStyle;
  onChange: (value: Pick<PrintTextStyle, 'color' | 'colorMode'>) => void;
  id: string;
}) {
  const preview = usePrintTextPreview(style);
  const warning = printTextContrastWarning(style, preview.background);
  return <div className="space-y-2">
    <label htmlFor={`${id}-color-mode`} className="text-sm">Text color</label>
    <select id={`${id}-color-mode`} data-testid={`${id}-color-mode`}
      className="w-full min-h-12 rounded-md border border-input bg-background px-3 text-foreground"
      value={style.colorMode ?? 'custom'} onChange={event => {
        const colorMode = event.target.value as PrintTextColorMode;
        onChange({ colorMode, ...(colorMode === 'light' ? { color: '#FFFFFF' } : colorMode === 'dark' ? { color: '#000000' } : {}) });
      }}>
      <option value="auto">Automatic</option>
      <option value="light">Light text (white)</option>
      <option value="dark">Dark text (black)</option>
      <option value="custom">Custom color</option>
    </select>
    {style.colorMode === 'auto' && <p className="text-xs text-muted-foreground" role={preview.error ? 'alert' : undefined}>
      {preview.error || `Automatic uses ${preview.color === '#FFFFFF' ? 'white' : 'black'} text for this product color.`}
    </p>}
    {warning && !preview.error && <p role="alert" className="text-sm text-amber-600 dark:text-amber-300">{warning}</p>}
  </div>;
}
