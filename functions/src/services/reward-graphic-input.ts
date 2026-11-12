import { getCanvas } from './composite-image';
import { getGraphicLayout } from '../../../shared/graphics/graphicLayout';

/** Populate the existing QR Plus slots using the selected QRG print area. */
export function rewardGraphicInput(placement: any, websiteUrl: string, logoUrl: string, brandUrl: string) {
  const dims = placement.dimensions, dpi = placement.dpi || dims?.dpi;
  if (!(dpi > 0 && dims.widthPx > 150 && dims.heightPx > 150)) throw new Error('The verified print area needs dimensions and DPI.');
  const qrSizePercent = Math.min(75, Math.max(35, 1.1 * dpi / (Math.min(dims.widthPx, dims.heightPx) - 150) * 100));
  const layout = getGraphicLayout({ canvasWidth: dims.widthPx, canvasHeight: dims.heightPx, headerActive: true, footerActive: true,
    subBottomActive: false, layoutMode: 'freeform', qrSizePercent });
  const fontSize = dims.widthPx < 2400 ? '8' : '12';
  const measure = getCanvas().createCanvas(1, 1).getContext('2d');
  measure.font = `bold ${Math.round(Number(fontSize) * dims.widthPx / 1200 * 2.5)}px Arial`;
  const width = Math.min(layout.safeRect.width * .25, layout.qr.background.x - layout.safeRect.x - 20);
  const lines: string[] = []; let line = '';
  for (const character of new URL(websiteUrl).hostname) {
    if (line && measure.measureText(line + character).width > width) { lines.push(line); line = ''; }
    line += character;
  }
  if (line) lines.push(line);
  if (lines.length > 4) throw new Error('The website domain is too long for this print area.');
  return { qrBasicContent: websiteUrl, graphicLayoutMode: 'freeform', qrPositionX: 50, qrPositionY: 50, qrSizePercent,
    areaImageUrl: logoUrl, areaImageMode: 'behind-qr', areaImageOffsetX: 0, areaImageOffsetY: 0, areaImageScale: 25,
    headerStyle: { enabled: true, mode: 'text', text: lines.join('\n'), fontFamily: 'Arial', fontSize, colorMode: 'auto', color: '#000000', horizontalOffset: 0, verticalOffset: 38 },
    footerStyle: { enabled: true, mode: 'image', text: '', imageUrl: brandUrl, fontFamily: 'Arial', fontSize, color: '#000000', horizontalOffset: 100, verticalOffset: 100, imageScale: 15 } };
}
