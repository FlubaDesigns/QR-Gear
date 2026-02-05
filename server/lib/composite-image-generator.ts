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

  // Only fill background if it's not transparent
  // Canvas is transparent by default for PNG output
  if (backgroundColor && backgroundColor !== "transparent") {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  const padding = 60;
  const textColor = "#000000";
  
  let currentY = padding;

  if (topText && topText.text) {
    const fontSize = parseInt(topText.fontSize) * 3;
    const fontFamily = FONT_MAP[topText.fontFamily] || "Arial";
    const fillColor = topText.color || textColor;
    
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    // Apply stroke if configured
    if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
      ctx.strokeStyle = topText.strokeColor;
      ctx.lineWidth = topText.strokeWidth * 3;
    }
    
    const lines = wrapText(ctx, topText.text, width - padding * 2);
    for (const line of lines) {
      if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
        ctx.strokeText(line, width / 2, currentY);
      }
      ctx.fillText(line, width / 2, currentY);
      currentY += fontSize * 1.3;
    }
    currentY += padding;
  }

  // Support black or white QR codes for different shirt colors
  const qrDark = qrColor === 'white' ? "#FFFFFF" : "#000000";
  // Use hex with alpha (00 = fully transparent) - qrcode library requires hex format
  const qrLight = "#FFFFFF00";
  
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: qrSize,
    margin: 2,
    color: { dark: qrDark, light: qrLight },
  });
  
  const qrImage = await loadImage(qrDataUrl);
  const qrX = (width - qrSize) / 2;
  const qrY = topText ? currentY : (height - qrSize) / 2 - (bottomText ? 100 : 0);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  
  currentY = qrY + qrSize + padding;

  if (bottomText && bottomText.text) {
    const fontSize = parseInt(bottomText.fontSize) * 3;
    const fontFamily = FONT_MAP[bottomText.fontFamily] || "Arial";
    const fillColor = bottomText.color || textColor;
    
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    // Apply stroke if configured
    if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
      ctx.strokeStyle = bottomText.strokeColor;
      ctx.lineWidth = bottomText.strokeWidth * 3;
    }
    
    const lines = wrapText(ctx, bottomText.text, width - padding * 2);
    for (const line of lines) {
      if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
        ctx.strokeText(line, width / 2, currentY);
      }
      ctx.fillText(line, width / 2, currentY);
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

export async function generatePrintifyComposite(
  qrUrl: string,
  topText: TextStyle | null,
  bottomText: TextStyle | null,
  printWidth: number = 1200,
  printHeight: number = 1800,
  qrColor: 'black' | 'white' = 'black'
): Promise<string> {
  // Use transparent background so the shirt color shows through
  return generateCompositeImage({
    width: printWidth,
    height: printHeight,
    backgroundColor: "transparent",
    qrSize: Math.min(printWidth, printHeight) * 0.4,
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
