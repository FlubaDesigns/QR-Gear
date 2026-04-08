import { admin, storage } from '../core';

  // ============ COMPOSITE IMAGE GENERATOR (Inlined from server/lib/composite-image-generator.ts) ============

let _canvas: any = null;
let _qrcode: any = null;
function getCanvas() {
  if (!_canvas) {
    try { _canvas = require('canvas'); } catch (e: any) {
      console.error('[Canvas] Failed to load canvas module:', e.message);
      throw new Error('Canvas module not available - ensure canvas is installed');
    }
  }
  return _canvas;
}
function getQRCode() {
  if (!_qrcode) {
    try { _qrcode = require('qrcode'); } catch (e: any) {
      console.error('[QRCode] Failed to load qrcode module:', e.message);
      throw new Error('QRCode module not available');
    }
  }
  return _qrcode;
}

interface TextStyleCF {
  text: string;
  fontFamily: string;
  fontSize: string;
  color?: string;
  letterSpacing?: number;
  warpPreset?: string;
  strokeColor?: string;
  strokeWidth?: number;
  verticalOffset?: number;
  horizontalOffset?: number;
  mode?: "text" | "image";
  imageUrl?: string;
  imageScale?: number;
}

const CF_PLACEMENT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "front": { width: 3600, height: 4800 },
  "front_large": { width: 3600, height: 4800 },
  "back": { width: 3600, height: 4200 },
  "front_small": { width: 2400, height: 1800 },
  "pocket": { width: 1200, height: 1200 },
  "left_sleeve": { width: 1200, height: 1500 },
  "right_sleeve": { width: 1200, height: 1500 },
};

const CF_FONT_MAP: Record<string, string> = {
  "Arial": "Arial", "Helvetica": "Helvetica", "Times New Roman": "Times New Roman",
  "Georgia": "Georgia", "Verdana": "Verdana", "Courier New": "Courier New",
  "Impact": "Impact", "Comic Sans MS": "Comic Sans MS", "Trebuchet MS": "Trebuchet MS",
  "Palatino Linotype": "Palatino Linotype",
};

function cfGetPreviewFontSize(fontSize: string): number {
  if (fontSize === '12px' || fontSize === 'sm') return 10;
  if (fontSize === '24px' || fontSize === 'lg') return 16;
  if (fontSize === '32px' || fontSize === 'xl') return 22;
  return 12;
}

const CF_PREVIEW_CONTAINER_WIDTH = 160;

function cfWrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function cfGenerateCompositeImage(options: {
  width?: number; height?: number; backgroundColor?: string; qrSize?: number;
  topText?: TextStyleCF | null; bottomText?: TextStyleCF | null;
  qrUrl: string; qrColor?: 'black' | 'white'; placement?: string;
  graphicLayoutMode?: 'structured' | 'freeform';
}): Promise<string> {
  const {
    width = 1200, height = 1800, backgroundColor = "#FFFFFF",
    qrSize = 600, topText, bottomText, qrUrl, qrColor = 'black',
    graphicLayoutMode = 'structured',
  } = options;

  const { createCanvas: cc, loadImage: li } = getCanvas();
  const canvas = cc(width, height);
  const ctx = canvas.getContext("2d");

  if (backgroundColor && backgroundColor !== "transparent") {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  const textColor = "#000000";
  const scaleFactor = width / CF_PREVIEW_CONTAINER_WIDTH;

  const BLEED_SAFE_PX = 75;
  const safeX = BLEED_SAFE_PX;
  const safeY = BLEED_SAFE_PX;
  const safeW = Math.max(1, width - 2 * BLEED_SAFE_PX);
  const safeH = Math.max(1, height - 2 * BLEED_SAFE_PX);

  let headerZoneTop: number, headerZoneHeight: number;
  let qrZoneTop: number, qrZoneHeight: number;
  let footerZoneTop: number, footerZoneHeight: number;
  let zoneX: number;
  let zoneW: number;

  if (graphicLayoutMode === 'freeform') {
    zoneX = safeX;
    zoneW = safeW;
    headerZoneTop = safeY;
    headerZoneHeight = safeH;
    qrZoneTop = safeY;
    qrZoneHeight = safeH;
    footerZoneTop = safeY;
    footerZoneHeight = safeH;
  } else {
    zoneX = safeX;
    zoneW = safeW;
    headerZoneTop = safeY;
    headerZoneHeight = safeH * 0.30;
    qrZoneTop = headerZoneTop + headerZoneHeight;
    qrZoneHeight = safeH * 0.40;
    footerZoneTop = qrZoneTop + qrZoneHeight;
    footerZoneHeight = safeH * 0.30;
  }

  const cfDrawImageInZone = async (
    imgUrl: string,
    zoneX: number,
    zoneY: number,
    zoneW: number,
    zoneH: number,
    _padding: number = 0,
    offsetX: number = 50,
    offsetY: number = 50,
    scale: number = 100
  ) => {
    try {
      if (!imgUrl.startsWith("data:") && !imgUrl.startsWith("https://firebasestorage.googleapis.com/") && !imgUrl.startsWith("https://storage.googleapis.com/")) {
        console.warn("[cf-composite] Rejected non-allowed image URL scheme");
        return;
      }
      const { loadImage: li2 } = getCanvas();
      const img = await li2(imgUrl);
      const imgAspect = img.width / img.height;
      const zoneAspect = zoneW / zoneH;
      let baseW: number, baseH: number;
      if (imgAspect > zoneAspect) {
        baseW = zoneW;
        baseH = zoneW / imgAspect;
      } else {
        baseH = zoneH;
        baseW = zoneH * imgAspect;
      }
      const sf = scale / 100;
      let drawW = baseW * sf;
      let drawH = baseH * sf;
      if (drawW > zoneW || drawH > zoneH) {
        const fitScale = Math.min(zoneW / drawW, zoneH / drawH);
        drawW *= fitScale;
        drawH *= fitScale;
      }
      const cx = Math.max(0, Math.min(100, offsetX));
      const cy = Math.max(0, Math.min(100, offsetY));
      const drawX = zoneX + (cx / 100) * Math.max(0, zoneW - drawW);
      const drawY = zoneY + (cy / 100) * Math.max(0, zoneH - drawH);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } catch (e: any) {
      console.warn("[cf-composite] Image load failed:", e?.message);
    }
  };

  const topIsImage = topText?.mode === "image" && topText?.imageUrl;
  if (topIsImage) {
    await cfDrawImageInZone(topText!.imageUrl!, zoneX, headerZoneTop, zoneW, headerZoneHeight, 0,
      topText!.horizontalOffset ?? 50, topText!.verticalOffset ?? 50, topText!.imageScale ?? 100);
  } else if (topText && topText.text) {
    const previewFontSize = cfGetPreviewFontSize(topText.fontSize);
    const fontSize = previewFontSize * scaleFactor;
    const fontFamily = CF_FONT_MAP[topText.fontFamily] || "Arial";
    const fillColor = topText.color || textColor;
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
      ctx.strokeStyle = topText.strokeColor;
      ctx.lineWidth = topText.strokeWidth * scaleFactor;
    }
    const lines = cfWrapText(ctx, topText.text, zoneW - 20);
    const totalTextHeight = lines.length * fontSize * 1.3;
    const vOff = topText.verticalOffset ?? 50;
    const hOff = topText.horizontalOffset ?? 50;
    let currentY = headerZoneTop + (vOff / 100) * Math.max(0, headerZoneHeight - totalTextHeight);
    const textX = zoneX + (hOff / 100) * zoneW;
    for (const line of lines) {
      if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
        ctx.strokeText(line, textX, currentY);
      }
      ctx.fillText(line, textX, currentY);
      currentY += fontSize * 1.3;
    }
  }

  const qrDark = qrColor === 'white' ? "#FFFFFF" : "#000000";
  const qrLight = qrColor === 'white' ? "#000000" : "#FFFFFF";
  const qrMarginY = qrZoneHeight * 0.10;
  const qrAreaHeight = qrZoneHeight * 0.80;
  const bgPadding = 20;
  const bgRadius = 16;
  const qrContentHeight = qrAreaHeight - bgPadding * 2;
  const qrContentWidth = qrContentHeight;
  const qrDataUrl = await getQRCode().toDataURL(qrUrl, {
    width: qrContentWidth, margin: 2,
    color: { dark: qrDark, light: qrLight },
  });
  const qrImage = await li(qrDataUrl);
  const qrBgWidth = qrContentWidth + bgPadding * 2;
  const qrBgX = zoneX + (zoneW - qrBgWidth) / 2;
  const qrBgY = qrZoneTop + qrMarginY;
  const qrX = zoneX + (zoneW - qrContentWidth) / 2;
  const qrY = qrBgY + bgPadding;
  ctx.fillStyle = qrLight;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(qrBgX, qrBgY, qrBgWidth, qrAreaHeight, bgRadius);
  } else {
    ctx.rect(qrBgX, qrBgY, qrBgWidth, qrAreaHeight);
  }
  ctx.fill();
  ctx.drawImage(qrImage, qrX, qrY, qrContentWidth, qrContentHeight);

  const bottomIsImage = bottomText?.mode === "image" && bottomText?.imageUrl;
  if (bottomIsImage) {
    await cfDrawImageInZone(bottomText!.imageUrl!, zoneX, footerZoneTop, zoneW, footerZoneHeight, 0,
      bottomText!.horizontalOffset ?? 50, bottomText!.verticalOffset ?? 50, bottomText!.imageScale ?? 100);
  } else if (bottomText && bottomText.text) {
    const previewFontSize = cfGetPreviewFontSize(bottomText.fontSize);
    const fontSize = previewFontSize * scaleFactor;
    const fontFamily = CF_FONT_MAP[bottomText.fontFamily] || "Arial";
    const fillColor = bottomText.color || textColor;
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
      ctx.strokeStyle = bottomText.strokeColor;
      ctx.lineWidth = bottomText.strokeWidth * scaleFactor;
    }
    const lines = cfWrapText(ctx, bottomText.text, zoneW - 20);
    const totalTextHeight = lines.length * fontSize * 1.3;
    const vOff = bottomText.verticalOffset ?? 50;
    const hOff = bottomText.horizontalOffset ?? 50;
    let currentY = footerZoneTop + (vOff / 100) * Math.max(0, footerZoneHeight - totalTextHeight);
    const textX = zoneX + (hOff / 100) * zoneW;
    for (const line of lines) {
      if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
        ctx.strokeText(line, textX, currentY);
      }
      ctx.fillText(line, textX, currentY);
      currentY += fontSize * 1.3;
    }
  }

  return canvas.toDataURL("image/png");
}

const CF_PREVIEW_WIDTH = 160;
const CF_PREVIEW_QR_SIZE = 36;

async function cfGeneratePrintifyComposite(
  qrUrl: string, topText: TextStyleCF | null, bottomText: TextStyleCF | null,
  printWidth: number = 1200, printHeight: number = 1800,
  qrColor: 'black' | 'white' = 'black', placement?: string,
  graphicLayoutMode?: 'structured' | 'freeform'
): Promise<string> {
  let finalWidth = printWidth;
  let finalHeight = printHeight;
  if (placement && CF_PLACEMENT_DIMENSIONS[placement]) {
    finalWidth = CF_PLACEMENT_DIMENSIONS[placement].width;
    finalHeight = CF_PLACEMENT_DIMENSIONS[placement].height;
  }
  const scaleFactor = finalWidth / CF_PREVIEW_WIDTH;
  const qrSize = CF_PREVIEW_QR_SIZE * scaleFactor;
  return cfGenerateCompositeImage({
    width: finalWidth, height: finalHeight, backgroundColor: "transparent",
    qrSize, topText, bottomText, qrUrl, qrColor, placement, graphicLayoutMode,
  });
}

async function cfUploadBufferToStorage(buffer: Buffer, mimeType: string, folder: string = 'member-graphics'): Promise<{ publicUrl: string; storagePath: string }> {
  const crypto = require('crypto');
  const extension = mimeType.split('/')[1] || 'png';
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const objectName = `${folder}/${uniqueId}.${extension}`;
  const bucket = storage.bucket();
  const file = bucket.file(objectName);
  await file.save(buffer, { metadata: { contentType: mimeType }, public: true });
  await file.makePublic();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectName}`;
  console.log(`[CF Storage] Uploaded: ${objectName} (${buffer.length} bytes)`);
  return { publicUrl, storagePath: objectName };
}



  export { getCanvas, getQRCode, cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE };
  