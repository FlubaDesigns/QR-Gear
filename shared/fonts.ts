import { GOOGLE_FONT_FAMILIES } from './googleFonts';
export { GOOGLE_FONT_FAMILIES } from './googleFonts';
export const DEFAULT_FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Impact', 'Comic Sans MS', 'Trebuchet MS', 'Palatino Linotype'];
export const SYSTEM_FONTS = [...DEFAULT_FONTS, 'Tahoma', 'Lucida Console'];
export const FONT_SETTINGS = { collection: 'config', document: 'fonts' } as const;
export const FONTS_QUERY_KEY = ['/api/fonts'] as const;
export const AVAILABLE_FONTS = Array.from(new Set([...SYSTEM_FONTS, ...GOOGLE_FONT_FAMILIES]));
export const SYSTEM_FONT_MAP: Record<string, string> = Object.fromEntries([...SYSTEM_FONTS, 'serif', 'sans-serif', 'monospace'].map(name => [name, name]));
const supported = new Map(AVAILABLE_FONTS.map(name => [name.toLowerCase(), name]));
export function normalizeFontList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length) throw new Error('At least one font is required');
  const fonts = value.map(name => {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Each font must have a name');
    const canonical = supported.get(name.trim().toLowerCase());
    if (!canonical) throw new Error(`Unsupported font: ${name}`);
    return canonical;
  });
  return Array.from(new Set(fonts));
}
