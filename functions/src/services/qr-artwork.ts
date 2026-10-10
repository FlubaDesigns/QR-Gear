import jsQR from 'jsqr';

/** Replace the QR found in the saved artwork, never guess its location from current defaults. */
export async function personalizeQrArtwork(source: string | Buffer, expectedPayload: string, newPayload: string): Promise<Buffer> {
  const { createCanvas, loadImage } = require('canvas');
  const QRCode = require('qrcode');
  const original = await loadImage(source);
  const width = original.width, height = original.height;
  const probeScale = Math.min(1, 1800 / Math.max(width, height));
  const probe = createCanvas(Math.round(width * probeScale), Math.round(height * probeScale));
  const p = probe.getContext('2d');
  const decode = (image: any) => {
    p.fillStyle = '#fff'; p.fillRect(0, 0, probe.width, probe.height);
    p.drawImage(image, 0, 0, probe.width, probe.height);
    return jsQR(p.getImageData(0, 0, probe.width, probe.height).data, probe.width, probe.height, { inversionAttempts: 'dontInvert' });
  };
  const code = decode(original);
  if (!code || code.data !== expectedPayload) throw new Error('Saved print artwork does not scan to its recorded QR destination. Reconcile this product before printing.');
  const { topLeftCorner: tl, topRightCorner: tr, bottomLeftCorner: bl, bottomRightCorner: br } = code.location;
  const side = ((tr.x - tl.x) + (br.x - bl.x) + (bl.y - tl.y) + (br.y - tr.y)) / 4;
  if (side < 50 || Math.max(Math.abs(tl.y - tr.y), Math.abs(bl.y - br.y), Math.abs(tl.x - bl.x), Math.abs(tr.x - br.x), Math.abs(tr.x - tl.x - side), Math.abs(bl.y - tl.y - side)) > side * .015) throw new Error('Saved QR geometry needs review before individual-item production.');
  const sx = width / probe.width, sy = height / probe.height;
  const left = Math.min(tl.x, bl.x) * sx, top = Math.min(tl.y, tr.y) * sy;
  const right = Math.max(tr.x, br.x) * sx, bottom = Math.max(bl.y, br.y) * sy;
  const pad = Math.max(3, Math.ceil(Math.max(sx, sy) * 2));
  const x = Math.floor(left) - pad, y = Math.floor(top) - pad;
  const w = Math.ceil(right) + pad - x, h = Math.ceil(bottom) + pad - y;
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  ctx.drawImage(original, 0, 0);
  const qr = await loadImage(await QRCode.toBuffer(newPayload, { type: 'png', width: w, margin: 0, errorCorrectionLevel: 'H' }));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, x, y, w, h);
  // The existing QR Gear mark occupies 9% of the code inside a 22.5% white box.
  // Copy only its center, avoiding any old QR modules at the box's rounded corners.
  const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
  const logo = Math.min(right - left, bottom - top) * .18;
  ctx.drawImage(original, centerX - logo / 2, centerY - logo / 2, logo, logo,
    centerX - logo / 2, centerY - logo / 2, logo, logo);
  if (decode(canvas)?.data !== newPayload) throw new Error('Individual-item print QR failed its scan check. Nothing was sent to production.');
  return canvas.toBuffer('image/png');
}
