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
  } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

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

  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: qrSize,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
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
  printHeight: number = 1800
): Promise<string> {
  return generateCompositeImage({
    width: printWidth,
    height: printHeight,
    backgroundColor: "#FFFFFF",
    qrSize: Math.min(printWidth, printHeight) * 0.4,
    topText,
    bottomText,
    qrUrl,
  });
}
