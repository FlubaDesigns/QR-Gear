import jsQR from 'jsqr';

/** Keep the existing QR Gear label design; personalize its code and printed identity. */
export async function renderUnitBrandLabel(template: string | Buffer, dimensions: any, itemUrl: string, qrgBaseCode: string): Promise<Buffer> {
  if (!/^QRG-[1-6][1-9]\d{3}-O-\d{6}$/.test(qrgBaseCode)) throw new Error('A purchased QRG item identity is required for its label.');
  if (!/^https:\/\//.test(itemUrl)) throw new Error('A public item URL is required for its label.');
  const { widthPx: width, heightPx: height, dpi } = dimensions || {};
  if (![width, height, dpi].every(n => Number.isSafeInteger(n) && n > 0) || Math.min(width, height) < 300) throw new Error('Verified label print dimensions are required.');
  const { createCanvas, loadImage } = require('canvas');
  const QRCode = require('qrcode');
  const original = await loadImage(template);
  if (original.width !== 600 || original.height !== 600) throw new Error('The QR Gear label template dimensions changed.');
  const design = createCanvas(600, 600), ctx = design.getContext('2d');
  ctx.drawImage(original, 0, 0);
  const sourceCode = jsQR(ctx.getImageData(0, 0, 600, 600).data, 600, 600);
  if (sourceCode?.data !== 'https://qrgear.com') throw new Error('The QR Gear label template does not match its recorded design.');
  // This rectangle belongs to the versioned 600px brand template, not a provider print area.
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 180, 600, 420);
  const qr = await loadImage(await QRCode.toBuffer(itemUrl, { width: 330, margin: 4, errorCorrectionLevel: 'M' }));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, 135, 182, 330, 330);
  ctx.fillStyle = '#b3daff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(qrgBaseCode, 300, 550, 550);
  const canvas = createCanvas(width, height), output = canvas.getContext('2d');
  const side = Math.min(width, height);
  output.imageSmoothingEnabled = false;
  output.drawImage(design, (width - side) / 2, (height - side) / 2, side, side);
  const decoded = jsQR(output.getImageData(0, 0, width, height).data, width, height);
  if (decoded?.data !== itemUrl) throw new Error('The individual brand label failed its QR scan check.');
  return canvas.toBuffer('image/png', { resolution: dpi });
}
