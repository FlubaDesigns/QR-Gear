import { createCanvas, registerFont, loadImage } from "canvas";
import QRCode from "qrcode";

export interface TextStyle {
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
}

export interface CompositeImageOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  qrSize?: number;
  topText?: TextStyle | null;
  bottomText?: TextStyle | null;
  qrUrl: string;
  qrColor?: 'black' | 'white';
}

const FONT_MAP: Record<string, string> = {
  "Arial": "Arial",
  "Helvetica": "Helvetica", 
  "Times New Roman": "Times New Roman",
  "Georgia": "Georgia",
  "Verdana": "Verdana",
  "Courier New": "Courier New",
  "Impact": "Impact",
  "Comic Sans MS": "Comic Sans MS",
  "Trebuchet MS": "Trebuchet MS",
  "Palatino Linotype": "Palatino Linotype",
};

/**
 * Convert fontSize setting to actual display size (matches frontend PhoneMockup).
 * This ensures print output matches what the user sees in preview.
 * 
 * Frontend getFontSize logic:
 * - '12px' or 'sm' → '10px'
 * - '24px' or 'lg' → '16px'  
 * - default → '12px'
 */
function getPreviewFontSize(fontSize: string): number {
  if (fontSize === '12px' || fontSize === 'sm') return 10;
  if (fontSize === '24px' || fontSize === 'lg') return 16;
  return 12; // Default size shown in preview
}

// WYSIWYG scaling constants
const PREVIEW_CONTAINER_WIDTH = 160;  // PhoneMockup container width in pixels

export async function generateCompositeImage(options: CompositeImageOptions): Promise<string> {
  const {
    width = 1200,
    height = 1800,
    backgroundColor = "#FFFFFF",
    qrSize = 600,
    topText,
    bottomText,
    qrUrl,
    qrColor = 'black',
  } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (backgroundColor && backgroundColor !== "transparent") {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  const textColor = "#000000";
  const scaleFactor = width / PREVIEW_CONTAINER_WIDTH;

  const headerZoneTop = 0;
  const headerZoneHeight = height * 0.25;
  const qrZoneTop = headerZoneHeight;
  const qrZoneHeight = height * 0.50;
  const footerZoneTop = qrZoneTop + qrZoneHeight;
  const footerZoneHeight = height * 0.25;

  if (topText && topText.text) {
    const previewFontSize = getPreviewFontSize(topText.fontSize);
    const fontSize = previewFontSize * scaleFactor;
    const fontFamily = FONT_MAP[topText.fontFamily] || "Arial";
    const fillColor = topText.color || textColor;
    
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
      ctx.strokeStyle = topText.strokeColor;
      ctx.lineWidth = topText.strokeWidth * scaleFactor;
    }
    
    const lines = wrapText(ctx, topText.text, width - 120);
    const totalTextHeight = lines.length * fontSize * 1.3;
    const vOff = topText.verticalOffset ?? 50;
    const hOff = topText.horizontalOffset ?? 50;
    const marginPct = 0.01;
    const marginY = headerZoneHeight * marginPct;
    const marginX = width * marginPct;
    const usableH = headerZoneHeight - 2 * marginY;
    const usableW = width - 2 * marginX;
    let currentY = headerZoneTop + marginY + (vOff / 100) * (usableH - totalTextHeight);
    const textX = marginX + (hOff / 100) * usableW;

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
  
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: qrSize,
    margin: 2,
    color: { dark: qrDark, light: qrLight },
  });
  
  const qrImage = await loadImage(qrDataUrl);
  const qrX = (width - qrSize) / 2;
  const qrY = qrZoneTop + (qrZoneHeight - qrSize) / 2;
  
  const bgPadding = 20;
  const bgRadius = 16;
  ctx.fillStyle = qrLight;
  ctx.beginPath();
  ctx.roundRect(qrX - bgPadding, qrY - bgPadding, qrSize + bgPadding * 2, qrSize + bgPadding * 2, bgRadius);
  ctx.fill();
  
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  if (bottomText && bottomText.text) {
    const previewFontSize = getPreviewFontSize(bottomText.fontSize);
    const fontSize = previewFontSize * scaleFactor;
    const fontFamily = FONT_MAP[bottomText.fontFamily] || "Arial";
    const fillColor = bottomText.color || textColor;
    
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
      ctx.strokeStyle = bottomText.strokeColor;
      ctx.lineWidth = bottomText.strokeWidth * scaleFactor;
    }
    
    const lines = wrapText(ctx, bottomText.text, width - 120);
    const totalTextHeight = lines.length * fontSize * 1.3;
    const vOff = bottomText.verticalOffset ?? 50;
    const hOff = bottomText.horizontalOffset ?? 50;
    const marginPct = 0.01;
    const marginY = footerZoneHeight * marginPct;
    const marginX = width * marginPct;
    const usableH = footerZoneHeight - 2 * marginY;
    const usableW = width - 2 * marginX;
    let currentY = footerZoneTop + marginY + (vOff / 100) * (usableH - totalTextHeight);
    const textX = marginX + (hOff / 100) * usableW;

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

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
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
  
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generate print-ready composite that matches the phone preview.
 * 
 * Preview dimensions (PhoneMockup component):
 * - Container: 160px wide
 * - QR code: 36px (smaller to leave room for text)
 * - Font sizes: 10-16px (via getFontSize function)
 * 
 * Printful actual t-shirt print area: 4500x5400px
 * We generate at 1200x1800 (same 2:3 ratio) for efficiency, Printful scales up.
 * 
 * Scale factor: 1200 / 160 = 7.5x
 */
const PREVIEW_WIDTH = 160;  // PhoneMockup container width
const PREVIEW_QR_SIZE = 36; // Smaller QR to leave room for header/footer text

export async function generatePrintifyComposite(
  qrUrl: string,
  topText: TextStyle | null,
  bottomText: TextStyle | null,
  printWidth: number = 1200,
  printHeight: number = 1800,
  qrColor: 'black' | 'white' = 'black'
): Promise<string> {
  // Calculate exact scale to match preview
  const scaleFactor = printWidth / PREVIEW_WIDTH; // 7.5x for 1200px
  const qrSize = PREVIEW_QR_SIZE * scaleFactor;   // 270px - smaller for text room
  
  // Use transparent background so the shirt color shows through
  return generateCompositeImage({
    width: printWidth,
    height: printHeight,
    backgroundColor: "transparent",
    qrSize: qrSize,
    topText,
    bottomText,
    qrUrl,
    qrColor,
  });
}

// Generate both black and white versions of the composite
export async function generateDualColorComposites(
  qrUrl: string,
  topText: TextStyle | null,
  bottomText: TextStyle | null,
  printWidth: number = 1200,
  printHeight: number = 1800
): Promise<{ blackVersion: string; whiteVersion: string }> {
  const [blackVersion, whiteVersion] = await Promise.all([
    generatePrintifyComposite(qrUrl, topText, bottomText, printWidth, printHeight, 'black'),
    generatePrintifyComposite(qrUrl, topText, bottomText, printWidth, printHeight, 'white'),
  ]);
  
  return { blackVersion, whiteVersion };
}

// Calculate luminance of a hex color to determine if it's "dark" or "light"
// Returns true if the color is dark (needs white QR), false if light (needs black QR)
export function isColorDark(hexColor: string): boolean {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate relative luminance using sRGB formula
  // Higher values = lighter color
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // If luminance is below 0.5, color is "dark" and needs white QR
  return luminance < 0.5;
}

// Get the appropriate artwork URL based on shirt color
export function getArtworkForColor(
  hexColor: string, 
  blackArtworkUrl: string, 
  whiteArtworkUrl: string
): string {
  return isColorDark(hexColor) ? whiteArtworkUrl : blackArtworkUrl;
}

export interface OverlayOptions {
  baseImageUrl: string;
  graphicUrl: string;
  position?: 'chest' | 'center' | 'back';
  graphicScale?: number;
  productType?: 'shirt' | 'hat' | 'bag' | 'mug' | 'other';
}

export async function overlayGraphicOnProduct(options: OverlayOptions): Promise<Buffer> {
  const { 
    baseImageUrl, 
    graphicUrl, 
    position = 'chest',
    graphicScale = 0.25,
    productType = 'shirt'
  } = options;

  const baseImage = await loadImage(baseImageUrl);
  const graphicImage = await loadImage(graphicUrl);

  const canvas = createCanvas(baseImage.width, baseImage.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(baseImage, 0, 0);

  const graphicWidth = baseImage.width * graphicScale;
  const graphicHeight = (graphicImage.height / graphicImage.width) * graphicWidth;

  let x: number, y: number;

  if (productType === 'shirt') {
    if (position === 'chest') {
      x = (baseImage.width - graphicWidth) / 2;
      y = baseImage.height * 0.28;
    } else if (position === 'center') {
      x = (baseImage.width - graphicWidth) / 2;
      y = (baseImage.height - graphicHeight) / 2;
    } else {
      x = (baseImage.width - graphicWidth) / 2;
      y = baseImage.height * 0.35;
    }
  } else if (productType === 'hat') {
    x = (baseImage.width - graphicWidth) / 2;
    y = baseImage.height * 0.35;
  } else if (productType === 'bag') {
    x = (baseImage.width - graphicWidth) / 2;
    y = (baseImage.height - graphicHeight) / 2;
  } else {
    x = (baseImage.width - graphicWidth) / 2;
    y = (baseImage.height - graphicHeight) / 2;
  }

  ctx.drawImage(graphicImage, x, y, graphicWidth, graphicHeight);

  return canvas.toBuffer("image/png");
}

export async function overlayGraphicOnProductToDataUrl(options: OverlayOptions): Promise<string> {
  const buffer = await overlayGraphicOnProduct(options);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}
