import { getColorHexByName } from './colorUtils';

export type PrintTextColorMode = 'auto' | 'light' | 'dark' | 'custom';
export type PrintTextColorOverride = Exclude<PrintTextColorMode, 'custom'>;
export interface PrintTextBackground {
  name?: string;
  hex?: string;
  /** null means unknown; the display swatch must not be used as a substitute. */
  contrastHex?: string | null;
  textColorMode?: PrintTextColorOverride;
}
export interface PrintTextStyle {
  color?: string;
  colorMode?: PrintTextColorMode;
  mode?: string;
  enabled?: boolean;
  text?: string;
}

export function normalizePrintHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hex = value.trim();
  if (/^#[\da-f]{6}$/i.test(hex)) return hex.toUpperCase();
  if (/^#[\da-f]{3}$/i.test(hex)) return `#${hex.slice(1).split('').map(c => c + c).join('')}`.toUpperCase();
  return null;
}

/** Linearize sRGB channels before weighting; no list of light/dark color names. */
export function relativeLuminance(hex: string): number {
  const normalized = normalizePrintHex(hex);
  if (!normalized) throw new Error('A valid background hex color is required for Automatic text.');
  const channels = [1, 3, 5].map(i => parseInt(normalized.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function automaticPrintTextColor(background?: PrintTextBackground | null): '#FFFFFF' | '#000000' {
  const mode = background?.textColorMode ?? 'auto';
  if (mode === 'light') return '#FFFFFF';
  if (mode === 'dark') return '#000000';
  if (mode !== 'auto') throw new Error('Invalid product text color setting.');
  const hex = background && Object.prototype.hasOwnProperty.call(background, 'contrastHex')
    ? normalizePrintHex(background.contrastHex)
    : normalizePrintHex(background?.hex) || normalizePrintHex(getColorHexByName(background?.name || ''));
  if (!hex) throw new Error('Automatic text needs a known product color. Choose Light text or Dark text, or set the blank color in Admin.');
  const luminance = relativeLuminance(hex);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
}

/** Missing mode means a deliberately fixed legacy color, never an implicit migration. */
export function resolvePrintTextColor(style: PrintTextStyle, background?: PrintTextBackground | null): string {
  const mode = style.colorMode ?? 'custom';
  if (mode === 'custom') return style.color || '#000000';
  if (mode === 'light') return '#FFFFFF';
  if (mode === 'dark') return '#000000';
  if (mode === 'auto') return automaticPrintTextColor(background);
  throw new Error('Invalid print text color mode.');
}

export function resolvePrintTextStyle<T extends PrintTextStyle>(style: T, background?: PrintTextBackground | null): T {
  if (!style || !style.colorMode || style.colorMode === 'custom' || style.mode === 'image' || style.enabled === false || !style.text) return style;
  return { ...style, color: resolvePrintTextColor(style, background) };
}

/** A warning, never a silent correction of the user's explicit print color. */
export function printTextContrastWarning(style: PrintTextStyle, background?: PrintTextBackground | null): string | null {
  if (style.mode === 'image' || style.enabled === false || !style.text) return null;
  const hex = background && Object.prototype.hasOwnProperty.call(background, 'contrastHex')
    ? normalizePrintHex(background.contrastHex) : normalizePrintHex(background?.hex) || normalizePrintHex(getColorHexByName(background?.name || ''));
  let foreground: string | null;
  try { foreground = normalizePrintHex(resolvePrintTextColor(style, background)); } catch { foreground = null; }
  if (!hex || !foreground) return 'Text contrast cannot be checked for this color. Review the proof carefully before approving.';
  const a = relativeLuminance(hex), b = relativeLuminance(foreground);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio < 4.5 ? 'This text color may be difficult to read on the selected product. You can keep it, but review the proof carefully before approving.' : null;
}

export function snapshotPrintTextWarnings(snapshot: any): string[] {
  if (!hasFullGraphicPlacement(snapshot)) return [];
  return PRINT_TEXT_STYLE_KEYS.flatMap(key => {
    const style = snapshot?.graphics?.content?.[key];
    if (!style) return [];
    const warning = printTextContrastWarning(style, snapshot.qrConfig?.selectedColor);
    return warning ? [`${key === 'headerStyle' ? 'Header' : key === 'footerStyle' ? 'Footer' : 'Text below QR'}: ${warning}`] : [];
  });
}

export const PRINT_TEXT_STYLE_KEYS = ['headerStyle', 'footerStyle', 'subBottomStyle'] as const;
function hasFullGraphicPlacement(snapshot: any): boolean {
  const layout = snapshot?.layoutConfig;
  if (!Array.isArray(layout?.selectedPlacements)) return true;
  return layout.selectedPlacements.some((placement: string) => !placement.startsWith('label_') &&
    (layout.perPlacementConfigs?.[placement]?.graphicChoice
      ? layout.perPlacementConfigs[placement].graphicChoice !== 'qr-only' : layout.placementConfig?.[placement] !== 'qr'));
}
export function hasAutomaticPrintText(snapshot: any): boolean {
  if (!hasFullGraphicPlacement(snapshot)) return false;
  return PRINT_TEXT_STYLE_KEYS.some(key => {
    const style = snapshot?.graphics?.content?.[key];
    return style?.colorMode === 'auto' && style.enabled !== false && style.mode !== 'image' && !!style.text;
  });
}

/** Captured color and policy stay on the snapshot; Assembly receives only resolved colors. */
export function resolveSnapshotPrintText(snapshot: any) {
  if (!hasFullGraphicPlacement(snapshot)) return snapshot;
  const content = { ...snapshot.graphics.content };
  for (const key of PRINT_TEXT_STYLE_KEYS) if (content[key]) content[key] = resolvePrintTextStyle(content[key], snapshot.qrConfig.selectedColor);
  return { ...snapshot, graphics: { ...snapshot.graphics, content } };
}

/** Use exact QRG color labels. Similar names can represent different physical fabrics. */
export function masterPrintTextBackground(master: any, name: string): PrintTextBackground & { name: string; hex: string } {
  const mappings = Array.isArray(master.providerMappings) ? master.providerMappings : Object.values(master.providerMappings || {});
  const colors = [...(Array.isArray(master.colors) ? master.colors : []), ...mappings.flatMap((p: any) => p?.colors || [])];
  const providerHex = colors.filter((c: any) => c?.name === name).map((c: any) => normalizePrintHex(c.hex)).find(Boolean);
  const contrastHex = providerHex || normalizePrintHex(getColorHexByName(name));
  const override = master.printTextColorOverrides?.[name] ?? 'auto';
  if (!['auto', 'light', 'dark'].includes(override)) throw new Error(`Invalid text color override for ${name}.`);
  return { name, hex: contrastHex || '#CCCCCC', contrastHex, textColorMode: override };
}

export function applyMasterPrintTextBackground(snapshot: any, master: any, name = snapshot.qrConfig.selectedColor?.name) {
  if (!name) {
    if (hasAutomaticPrintText(snapshot)) throw new Error('Choose a product color before rendering Automatic text.');
    return snapshot;
  }
  return resolveSnapshotPrintText({ ...snapshot, qrConfig: { ...snapshot.qrConfig, selectedColor: masterPrintTextBackground(master, name) } });
}
