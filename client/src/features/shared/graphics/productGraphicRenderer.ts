import { ZONE_LAYOUT } from "@/features/shared/constants/zoneLayout";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps/wizardTypes";
import { DEFAULT_FONT_SIZE_NUM } from "@/features/shared/components/TextStyleEditor";

export interface TextStyle {
  text: string;
  enabled?: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  letterSpacing?: number;
  strokeColor?: string;
  strokeWidth?: number;
  verticalOffset?: number;
  horizontalOffset?: number;
  warpPreset?: string;
}

export interface RenderOptions {
  qrContent: string;
  qrColor?: "black" | "white";
  headerStyle?: TextStyle | null;
  footerStyle?: TextStyle | null;
  backgroundColor?: string;
  transparent?: boolean;
  placement?: string;
}

const PLACEMENT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "front": { width: 3600, height: 4800 },
  "front_large": { width: 3600, height: 4800 },
  "back": { width: 3600, height: 4200 },
  "front_small": { width: 2400, height: 1800 },
  "pocket": { width: 1200, height: 1200 },
  "left_sleeve": { width: 1200, height: 1500 },
  "right_sleeve": { width: 1200, height: 1500 },
};

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 1800;


function parseFontSize(fontSize: string): number {
  const num = parseInt(fontSize, 10);
  if (!isNaN(num) && num > 0) return num;
  return DEFAULT_FONT_SIZE_NUM;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
    const absoluteSrc = src.startsWith("/")
      ? `${window.location.origin}${src}`
      : src;
    img.src = absoluteSrc;
  });
}

export async function renderProductGraphic(
  options: RenderOptions
): Promise<string> {
  const {
    qrContent,
    qrColor = "black",
    headerStyle,
    footerStyle,
    backgroundColor,
    transparent = true,
    placement,
  } = options;

  const dims = (placement && PLACEMENT_DIMENSIONS[placement]) || {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
  const W = dims.width;
  const H = dims.height;

  const headerZoneTop = 0;
  const headerZoneHeight = H * ZONE_LAYOUT.HEADER_PERCENT;
  const qrZoneTop = headerZoneHeight;
  const qrZoneHeight = H * ZONE_LAYOUT.MIDDLE_PERCENT;
  const footerZoneTop = qrZoneTop + qrZoneHeight;
  const footerZoneHeight = H * ZONE_LAYOUT.FOOTER_PERCENT;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Canvas not supported");

  ctx.clearRect(0, 0, W, H);

  if (!transparent && backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, W, H);
  }

  const drawTextInZone = (
    style: TextStyle,
    zoneTop: number,
    zoneHeight: number
  ) => {
    if (!style.text) return;

    const baseFontSize = parseFontSize(style.fontSize);
    const fontSize = Math.round(baseFontSize * (W / 360));
    const fontFamily = style.fontFamily || "Arial";
    const fillColor = style.color || "#000000";

    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (style.strokeColor && style.strokeWidth && style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth * (W / 360);
    }

    const lines = wrapText(ctx, style.text, W - 120);
    const totalTextHeight = lines.length * fontSize * 1.3;
    const vOff = style.verticalOffset ?? 50;
    const hOff = style.horizontalOffset ?? 50;
    const marginPct = 0.01;
    const marginY = zoneHeight * marginPct;
    const marginX = W * marginPct;
    const usableH = zoneHeight - 2 * marginY;
    const usableW = W - 2 * marginX;
    let currentY =
      zoneTop + marginY + (vOff / 100) * (usableH - totalTextHeight);
    const textX = marginX + (hOff / 100) * usableW;

    for (const line of lines) {
      if (style.strokeColor && style.strokeWidth && style.strokeWidth > 0) {
        ctx.strokeText(line, textX, currentY);
      }
      ctx.fillText(line, textX, currentY);
      currentY += fontSize * 1.3;
    }
  };

  if (headerStyle && headerStyle.enabled !== false && headerStyle.text) {
    drawTextInZone(headerStyle, headerZoneTop, headerZoneHeight);
  }

  const qrMarginY = qrZoneHeight * ZONE_LAYOUT.QR_MARGIN_PERCENT;
  const qrAreaHeight = qrZoneHeight * ZONE_LAYOUT.QR_AREA_PERCENT;
  const bgPadding = 20;
  const bgRadius = 16;
  const qrContentHeight = qrAreaHeight - bgPadding * 2;
  const qrContentWidth = qrContentHeight;
  const qrBgWidth = qrContentWidth + bgPadding * 2;
  const qrBgX = (W - qrBgWidth) / 2;
  const qrBgY = qrZoneTop + qrMarginY;
  const qrX = (W - qrContentWidth) / 2;
  const qrY = qrBgY + bgPadding;

  const qrLight = qrColor === "white" ? "#000000" : "#FFFFFF";

  if (!transparent) {
    ctx.fillStyle = qrLight;
    ctx.beginPath();
    ctx.roundRect(qrBgX, qrBgY, qrBgWidth, qrAreaHeight, bgRadius);
    ctx.fill();
  }

  try {
    const qrSize = Math.round(qrContentWidth);
    const qrUrl = generateQRCodeUrl(qrContent, qrSize, qrColor);
    const qrImg = await loadImage(qrUrl);
    ctx.drawImage(qrImg, qrX, qrY, qrContentWidth, qrContentHeight);
  } catch (e) {
    console.warn("[productGraphicRenderer] QR load failed:", e);
  }

  if (footerStyle && footerStyle.enabled !== false && footerStyle.text) {
    drawTextInZone(footerStyle, footerZoneTop, footerZoneHeight);
  }

  return canvas.toDataURL("image/png");
}

export function getDimensions(placement?: string): {
  width: number;
  height: number;
} {
  if (placement && PLACEMENT_DIMENSIONS[placement]) {
    return PLACEMENT_DIMENSIONS[placement];
  }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}
