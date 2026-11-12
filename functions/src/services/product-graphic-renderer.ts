import { createProductGraphicRenderer } from '../../../shared/graphics/productGraphicRenderer';
import { getCanvas, getQRCode } from './composite-image';
import { createFontLoader } from './font-loader';
import { resolveRuntimeConfig } from '../runtime-config';
import { productGraphicOptions, requireBuilderSnapshot } from '../../../shared/builderSnapshot';
import jsQR from 'jsqr';

const ensureFont = createFontLoader((path, options) => getCanvas().registerFont(path, options));
/** The browser and server share every layout and drawing calculation. */
export async function renderSavedProductGraphic(snapshot: any, qrContent: string, placement: string) {
  const saved = requireBuilderSnapshot(snapshot);
  const dimensions = saved.layoutConfig.providerLayouts?.[placement]?.dimensions;
  if (!(dimensions?.widthPx > 0 && dimensions?.heightPx > 0)) throw new Error('Refresh the saved print area before rendering.');
  const renderer = createProductGraphicRenderer({
    createCanvas: (w, h) => getCanvas().createCanvas(w, h),
    loadImage: async url => {
      if (!url.startsWith('data:image/png;base64,') && !url.startsWith('data:image/jpeg;base64,') && !url.startsWith('data:image/webp;base64,')) {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
            !['storage.googleapis.com', 'firebasestorage.googleapis.com', new URL(resolveRuntimeConfig().origin).hostname].includes(parsed.hostname)) throw new Error('Artwork must use a saved image.');
      }
      return getCanvas().loadImage(url);
    },
    loadFonts: names => Promise.all(names.map(ensureFont)),
    qrImage: (content, size, color) => getQRCode().toDataURL(content, { width: size, margin: 0, errorCorrectionLevel: 'H', color: { dark: color === 'white' ? '#ffffff' : '#000000', light: color === 'white' ? '#000000' : '#ffffff' } }),
    logoUrl: `${resolveRuntimeConfig().origin}/img/qr-gear-mark.png`,
  });
  const image = await renderer.renderProductGraphic(productGraphicOptions(saved, qrContent, placement) as any);
  const original = await getCanvas().loadImage(image);
  const scale = Math.min(1, 1800 / Math.max(original.width, original.height));
  const canvas = getCanvas().createCanvas(Math.round(original.width * scale), Math.round(original.height * scale));
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
  if (jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data !== qrContent) throw new Error('The personalized print QR did not pass its scan check.');
  return image;
}
