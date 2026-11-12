import { loadGoogleFonts } from '@/lib/fontLoader';
import { generateQRCodeUrl } from '@/features/shared/components/wizardSteps/wizardTypes';
import qLogoSrc from '@assets/qr_gear_logo_transparent_1778357953260.png';
import { createProductGraphicRenderer } from '@shared/graphics/productGraphicRenderer';
export type { TextStyle, RenderOptions } from '@shared/graphics/productGraphicRenderer';
const renderer = createProductGraphicRenderer({
  createCanvas(width, height) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; },
  loadImage(src) { return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src.startsWith('/') ? `${window.location.origin}${src}` : src;
  }); },
  loadFonts: loadGoogleFonts, qrImage: generateQRCodeUrl, logoUrl: qLogoSrc,
});
export const { renderProductGraphic, getDimensions } = renderer;
