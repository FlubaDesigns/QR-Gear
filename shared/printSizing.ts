/** Physical placement sizing shared by the builder preview and print export. */
export const PRINT_SIZE_SCALES = { small: 2 / 3, medium: 5 / 6, large: 1 } as const;
export type PrintSize = keyof typeof PRINT_SIZE_SCALES;
export interface PrintLayout {
  dimensions?: { widthPx: number; heightPx: number; dpi?: number; widthIn?: number; heightIn?: number } | null;
  printArea?: { widthPx: number; heightPx: number } | null;
  safeArea?: { widthPx: number; heightPx: number } | null;
  dpi?: number;
}
export function printArtworkFrame(layout: PrintLayout, size: PrintSize = 'medium') {
  const width = layout.dimensions?.widthPx, height = layout.dimensions?.heightPx;
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('QRG print-area dimensions are missing. Refresh the placement before generating.');
  }
  if (!(size in PRINT_SIZE_SCALES)) throw new Error('Unknown print size');
  let scale = PRINT_SIZE_SCALES[size];
  for (const area of [layout.printArea, layout.safeArea]) {
    if (area) {
      if (!(area.widthPx > 0) || !(area.heightPx > 0)) throw new Error('QRG print-area limits are invalid.');
      scale = Math.min(scale, area.widthPx / width * PRINT_SIZE_SCALES[size], area.heightPx / height * PRINT_SIZE_SCALES[size]);
    }
  }
  const artworkWidth = Math.round(width * scale), artworkHeight = Math.round(height * scale);
  const dpi = layout.dpi || layout.dimensions?.dpi;
  const widthIn = layout.dimensions?.widthIn || (dpi && dpi > 0 ? width / dpi : null);
  const heightIn = layout.dimensions?.heightIn || (dpi && dpi > 0 ? height / dpi : null);
  return { width, height, artworkWidth, artworkHeight, scale,
    left: (width - artworkWidth) / 2, top: (height - artworkHeight) / 2,
    widthIn, heightIn, artworkWidthIn: widthIn ? widthIn * artworkWidth / width : null,
    artworkHeightIn: heightIn ? heightIn * artworkHeight / height : null };
}
