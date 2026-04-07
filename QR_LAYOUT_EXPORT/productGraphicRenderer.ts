import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps/wizardTypes";
import { DEFAULT_FONT_SIZE_NUM } from "@/features/shared/components/TextStyleEditor";
import { GRAPHIC_LAYOUT } from "./graphicLayoutConstants";

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
  mode?: "text" | "image";
  imageUrl?: string;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
}

export interface RenderOptions {
  qrContent: string;
  qrColor?: "black" | "white";
  headerStyle?: TextStyle | null;
  footerStyle?: TextStyle | null;
  backgroundColor?: string;
  transparent?: boolean;
  placement?: string;
  qrPositionX?: number;
  qrPositionY?: number;
  qrSizePercent?: number;
  headerImageUrl?: string;
  footerImageUrl?: string;
  areaImageUrl?: string;
  areaImageMode?: "replace-qr" | "behind-qr";
  areaImageOffsetX?: number;
  areaImageOffsetY?: number;
  areaImageScale?: number;
  subBottomEnabled?: boolean;
  subBottomText?: string;
  subBottomColor?: string;
  subBottomFontSize?: string;
}

const PLACEMENT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  front: { width: 3600, height: 4800 },
  front_large: { width: 3600, height: 4800 },
  back: { width: 3600, height: 4200 },
  front_small: { width: 2400, height: 1800 },
  pocket: { width: 1200, height: 1200 },
  left_sleeve: { width: 1200, height: 1500 },
  right_sleeve: { width: 1200, height: 1500 },
};

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 1800;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseFontSize(fontSize: string): number {
  const num = parseInt(fontSize, 10);
  return !isNaN(num) && num > 0 ? num : DEFAULT_FONT_SIZE_NUM;
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
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    const absoluteSrc = src.startsWith("/")
      ? `${window.location.origin}${src}`
      : src;
    img.src = absoluteSrc;
  });
}

async function drawImageInZone(
  ctx: CanvasRenderingContext2D,
  imgUrl: string,
  zoneX: number,
  zoneY: number,
  zoneW: number,
  zoneH: number,
  padding: number = 0.05,
  offsetX: number = 50,
  offsetY: number = 50,
  scale: number = 100
) {
  try {
    const img = await loadImage(imgUrl);

    const padX = zoneW * padding;
    const padY = zoneH * padding;
    const availW = zoneW - 2 * padX;
    const availH = zoneH - 2 * padY;

    const imgAspect = img.width / img.height;
    const zoneAspect = availW / availH;

    let baseW: number;
    let baseH: number;

    if (imgAspect > zoneAspect) {
      baseW = availW;
      baseH = baseW / imgAspect;
    } else {
      baseH = availH;
      baseW = baseH * imgAspect;
    }

    const scaleFactor = scale / 100;
    let drawW = baseW * scaleFactor;
    let drawH = baseH * scaleFactor;

    if (drawW > availW || drawH > availH) {
      const fitScale = Math.min(availW / drawW, availH / drawH);
      drawW *= fitScale;
      drawH *= fitScale;
    }

    const clampedOX = Math.max(0, Math.min(100, offsetX));
    const clampedOY = Math.max(0, Math.min(100, offsetY));

    const marginX = zoneW * 0.02;
    const marginY = zoneH * 0.02;

    const minX = zoneX + padX + marginX;
    const maxX = zoneX + zoneW - padX - marginX - drawW;
    const minY = zoneY + padY + marginY;
    const maxY = zoneY + zoneH - padY - marginY - drawH;

    const drawX = minX + (clampedOX / 100) * Math.max(0, maxX - minX);
    const drawY = minY + (clampedOY / 100) * Math.max(0, maxY - minY);

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  } catch (err) {
    console.warn("[productGraphicRenderer] Image load failed:", err);
  }
}

export async function renderProductGraphic(options: RenderOptions): Promise<string> {
  const {
    qrContent,
    qrColor = "black",
    headerStyle,
    footerStyle,
    backgroundColor,
    transparent = true,
    placement,
    qrPositionX = 50,
    qrPositionY = 45,
    qrSizePercent = 55,
    headerImageUrl,
    footerImageUrl,
    areaImageUrl,
    areaImageMode = "behind-qr",
    subBottomEnabled = false,
    subBottomText = "Scan Me",
    subBottomColor = "#666666",
    subBottomFontSize = "14px",
  } = options;

  const dims = PLACEMENT_DIMENSIONS[placement || ""] || {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };

  const W = dims.width;
  const H = dims.height;

  const topPadding = H * GRAPHIC_LAYOUT.padding.top;
  const bottomPadding = H * GRAPHIC_LAYOUT.padding.bottom;
  const sectionGap = H * GRAPHIC_LAYOUT.padding.gap;

  const headerActive = Boolean(
    (headerStyle?.enabled !== false && headerStyle?.text) ||
      headerImageUrl ||
      (headerStyle?.mode === "image" && headerStyle?.imageUrl)
  );

  const footerActive = Boolean(
    (footerStyle?.enabled !== false && footerStyle?.text) ||
      footerImageUrl ||
      (footerStyle?.mode === "image" && footerStyle?.imageUrl)
  );

  const subBottomActive = Boolean(subBottomEnabled && subBottomText?.trim());

  const headerZoneHeight = headerActive ? H * GRAPHIC_LAYOUT.zones.header : 0;
  const footerZoneHeight = footerActive ? H * GRAPHIC_LAYOUT.zones.footer : 0;
  const subBottomZoneHeight = subBottomActive ? H * GRAPHIC_LAYOUT.zones.subBottom : 0;

  const headerGap = headerActive ? sectionGap : 0;
  const subBottomGap = subBottomActive ? sectionGap * 0.7 : 0;
  const footerGap = footerActive ? sectionGap * 0.7 : 0;

  const reservedHeight =
    topPadding +
    bottomPadding +
    headerZoneHeight +
    subBottomZoneHeight +
    footerZoneHeight +
    headerGap +
    subBottomGap +
    footerGap;

  const middleZoneHeight = Math.max(H * 0.38, H - reservedHeight);
  const middleZoneTop = topPadding + headerZoneHeight + headerGap;
  const subBottomZoneTop = middleZoneTop + middleZoneHeight + subBottomGap;
  const footerZoneTop = subBottomZoneTop + subBottomZoneHeight + footerGap;

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

  const qrImgSize = 1000;
  const qrUrl = generateQRCodeUrl(qrContent, qrImgSize, qrColor);
  const qrImg = await loadImage(qrUrl);

  const qrMaxWidth = W * GRAPHIC_LAYOUT.qr.maxWidth;
  const qrMaxHeight = middleZoneHeight * GRAPHIC_LAYOUT.qr.maxHeight;
  const qrBaseSize = Math.min(qrMaxWidth, qrMaxHeight);

  let qrSize = qrBaseSize * (qrSizePercent / 100);
  qrSize = clamp(qrSize, GRAPHIC_LAYOUT.qr.minSize, qrBaseSize);

  const qrSafeMarginX = W * GRAPHIC_LAYOUT.qr.safeMarginX;
  const qrTravelWidth = Math.max(0, W - qrSize - qrSafeMarginX * 2);
  const qrX = qrSafeMarginX + qrTravelWidth * (qrPositionX / 100);

  const qrSafeMarginY = middleZoneHeight * GRAPHIC_LAYOUT.qr.safeMarginY;
  const qrTravelHeight = Math.max(0, middleZoneHeight - qrSize - qrSafeMarginY * 2);
  const qrY = middleZoneTop + qrSafeMarginY + qrTravelHeight * (qrPositionY / 100);

  const areaOffX = options.areaImageOffsetX ?? 50;
  const areaOffY = options.areaImageOffsetY ?? 50;
  const areaSc = options.areaImageScale ?? 100;

  if (areaImageUrl && areaImageMode === "behind-qr") {
    await drawImageInZone(ctx, areaImageUrl, 0, middleZoneTop, W, middleZoneHeight, 0.03, areaOffX, areaOffY, areaSc);
  }

  if (areaImageUrl && areaImageMode === "replace-qr") {
    await drawImageInZone(ctx, areaImageUrl, 0, middleZoneTop, W, middleZoneHeight, 0.03, areaOffX, areaOffY, areaSc);
  } else {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  if (headerActive) {
    const resolvedHeaderUrl =
      headerImageUrl || (headerStyle?.mode === "image" ? headerStyle?.imageUrl : undefined);

    if (resolvedHeaderUrl) {
      await drawImageInZone(ctx, resolvedHeaderUrl, 0, topPadding, W, headerZoneHeight, 0.05,
        headerStyle?.imageOffsetX ?? 50, headerStyle?.imageOffsetY ?? 50, headerStyle?.imageScale ?? 100);
    } else if (headerStyle) {
      ctx.fillStyle = headerStyle.color || "#000";
      ctx.font = `${parseFontSize(headerStyle.fontSize)}px ${headerStyle.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const lines = wrapText(ctx, headerStyle.text, W * 0.9);
      const lineHeight = parseFontSize(headerStyle.fontSize) * 1.2;
      let y = topPadding + headerZoneHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

      for (const line of lines) {
        ctx.fillText(line, W / 2, y);
        y += lineHeight;
      }
    }
  }

  if (subBottomActive) {
    ctx.fillStyle = subBottomColor;
    ctx.font = `${parseFontSize(subBottomFontSize)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(subBottomText.trim(), W / 2, subBottomZoneTop + subBottomZoneHeight / 2);
  }

  if (footerActive) {
    const resolvedFooterUrl =
      footerImageUrl || (footerStyle?.mode === "image" ? footerStyle?.imageUrl : undefined);

    if (resolvedFooterUrl) {
      await drawImageInZone(ctx, resolvedFooterUrl, 0, footerZoneTop, W, footerZoneHeight, 0.05,
        footerStyle?.imageOffsetX ?? 50, footerStyle?.imageOffsetY ?? 50, footerStyle?.imageScale ?? 100);
    } else if (footerStyle) {
      ctx.fillStyle = footerStyle.color || "#000";
      ctx.font = `${parseFontSize(footerStyle.fontSize)}px ${footerStyle.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const lines = wrapText(ctx, footerStyle.text, W * 0.9);
      const lineHeight = parseFontSize(footerStyle.fontSize) * 1.2;
      let y = footerZoneTop + footerZoneHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

      for (const line of lines) {
        ctx.fillText(line, W / 2, y);
        y += lineHeight;
      }
    }
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
