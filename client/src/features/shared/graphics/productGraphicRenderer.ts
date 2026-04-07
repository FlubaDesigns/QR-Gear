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
    qrPositionX = 50,
    qrPositionY = 50,
    qrSizePercent = 50,
    headerImageUrl,
    footerImageUrl,
    areaImageUrl,
    areaImageMode = "behind-qr",
  } = options;

  const dims = (placement && PLACEMENT_DIMENSIONS[placement]) || {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
  const W = dims.width;
  const H = dims.height;

  const subBottomEnabled = options.subBottomEnabled ?? false;
  const subBottomText = options.subBottomText || "Scan Me";
  const subBottomColor = options.subBottomColor || "#666666";
  const subBottomFontSizeStr = options.subBottomFontSize || "14px";

  const headerZoneTop = 0;
  const headerZoneHeight = H * ZONE_LAYOUT.HEADER_PERCENT;
  const qrZoneTop = headerZoneHeight;
  const qrZoneHeight = subBottomEnabled
    ? H * ZONE_LAYOUT.MIDDLE_PERCENT
    : H * (ZONE_LAYOUT.MIDDLE_PERCENT + ZONE_LAYOUT.SUB_BOTTOM_PERCENT);
  const subBottomZoneTop = qrZoneTop + qrZoneHeight;
  const subBottomZoneHeight = subBottomEnabled ? H * ZONE_LAYOUT.SUB_BOTTOM_PERCENT : 0;
  const footerZoneTop = subBottomZoneTop + subBottomZoneHeight;
  const footerZoneHeight = H * ZONE_LAYOUT.FOOTER_PERCENT;

  const qrInnerMargin = subBottomEnabled
    ? ZONE_LAYOUT.QR_INNER_MARGIN
    : ZONE_LAYOUT.QR_INNER_MARGIN_EXPANDED;

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
    const marginPct = 0.005;
    const marginY = zoneHeight * marginPct;
    const marginX = W * marginPct;
    const usableW = W - 2 * marginX;
    const topEdge = zoneTop + marginY;
    const bottomEdge = zoneTop + zoneHeight - marginY - totalTextHeight;
    let currentY = topEdge + (vOff / 100) * (bottomEdge - topEdge);
    if (currentY < topEdge) currentY = topEdge;
    const textX = marginX + (hOff / 100) * usableW;

    for (const line of lines) {
      if (style.strokeColor && style.strokeWidth && style.strokeWidth > 0) {
        ctx.strokeText(line, textX, currentY);
      }
      ctx.fillText(line, textX, currentY);
      currentY += fontSize * 1.3;
    }
  };

  const drawImageInZone = async (
    imgUrl: string,
    zoneX: number,
    zoneY: number,
    zoneW: number,
    zoneH: number,
    padding: number = 0.05,
    offsetX: number = 50,
    offsetY: number = 50,
    scale: number = 100
  ) => {
    try {
      const img = await loadImage(imgUrl);
      const padX = zoneW * padding;
      const padY = zoneH * padding;
      const availW = zoneW - 2 * padX;
      const availH = zoneH - 2 * padY;
      const imgAspect = img.width / img.height;
      const zoneAspect = availW / availH;
      let baseW: number, baseH: number;
      if (imgAspect > zoneAspect) {
        baseW = availW;
        baseH = availW / imgAspect;
      } else {
        baseH = availH;
        baseW = availH * imgAspect;
      }
      const scaleFactor = scale / 100;
      const drawW = baseW * scaleFactor;
      const drawH = baseH * scaleFactor;
      const clampedX = Math.max(0, Math.min(100, offsetX));
      const clampedY = Math.max(0, Math.min(100, offsetY));
      const margin = zoneH * 0.02;
      const marginX = zoneW * 0.02;
      const rangeY = zoneH - drawH;
      const topEdge = zoneY + margin;
      const bottomEdge = zoneY + rangeY - margin;
      const minTravelY = zoneH * 0.15;
      const actualRangeY = Math.max(minTravelY, bottomEdge - topEdge);
      const centerY = zoneY + (zoneH - drawH) / 2;
      const drawY = centerY + (clampedY / 100 - 0.5) * actualRangeY;
      const rangeX = zoneW - drawW;
      const leftEdge = zoneX + marginX;
      const rightEdge = zoneX + rangeX - marginX;
      const minTravelX = zoneW * 0.15;
      const actualRangeX = Math.max(minTravelX, rightEdge - leftEdge);
      const centerX = zoneX + (zoneW - drawW) / 2;
      const drawX = centerX + (clampedX / 100 - 0.5) * actualRangeX;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } catch (e) {
      console.warn("[productGraphicRenderer] Image load failed:", e);
    }
  };

  const headerIsImage = headerStyle?.mode === "image" && headerStyle?.imageUrl;
  const headerIsText = headerStyle && headerStyle.enabled !== false && headerStyle.text && headerStyle.mode !== "image";
  const resolvedHeaderImageUrl = headerImageUrl || (headerIsImage ? headerStyle!.imageUrl : undefined);

  if (resolvedHeaderImageUrl) {
    await drawImageInZone(resolvedHeaderImageUrl, 0, headerZoneTop, W, headerZoneHeight, 0.05,
      headerStyle?.imageOffsetX ?? 50, headerStyle?.imageOffsetY ?? 50, headerStyle?.imageScale ?? 100);
  } else if (headerIsText) {
    drawTextInZone(headerStyle!, headerZoneTop, headerZoneHeight);
  }

  const safeMarginX = W * 0.03;
  const safeMarginY = qrZoneHeight * qrInnerMargin;
  const safeW = W - 2 * safeMarginX;
  const safeH = qrZoneHeight - 2 * safeMarginY;

  const clampedSize = Math.max(20, Math.min(100, qrSizePercent));
  const maxQrDimension = Math.min(safeW, safeH);
  const qrContentWidth = maxQrDimension * (clampedSize / 100);
  const qrContentHeight = qrContentWidth;

  const clampedX = Math.max(0, Math.min(100, qrPositionX));
  const clampedY = Math.max(0, Math.min(100, qrPositionY));
  const availableX = safeW - qrContentWidth;
  const availableY = safeH - qrContentHeight;
  const qrX = safeMarginX + (clampedX / 100) * availableX;
  const qrY = qrZoneTop + safeMarginY + (clampedY / 100) * availableY;

  const bgPadding = 20;
  const bgRadius = 16;
  const qrBgX = qrX - bgPadding;
  const qrBgY2 = qrY - bgPadding;
  const qrBgWidth = qrContentWidth + bgPadding * 2;
  const qrBgHeight = qrContentHeight + bgPadding * 2;

  const qrLight = qrColor === "white" ? "#000000" : "#FFFFFF";

  const areaOffX = options.areaImageOffsetX ?? 50;
  const areaOffY = options.areaImageOffsetY ?? 50;
  const areaSc = options.areaImageScale ?? 100;

  if (areaImageUrl && areaImageMode === "replace-qr") {
    await drawImageInZone(areaImageUrl, 0, qrZoneTop, W, qrZoneHeight, 0.03, areaOffX, areaOffY, areaSc);
  } else {
    if (areaImageUrl && areaImageMode === "behind-qr") {
      await drawImageInZone(areaImageUrl, 0, qrZoneTop, W, qrZoneHeight, 0.03, areaOffX, areaOffY, areaSc);
    }

    if (!transparent) {
      ctx.fillStyle = qrLight;
      ctx.beginPath();
      ctx.roundRect(qrBgX, qrBgY2, qrBgWidth, qrBgHeight, bgRadius);
      ctx.fill();
    }

    try {
      const qrImgSize = Math.round(qrContentWidth);
      const qrUrl = generateQRCodeUrl(qrContent, qrImgSize, qrColor);
      const qrImg = await loadImage(qrUrl);
      ctx.drawImage(qrImg, qrX, qrY, qrContentWidth, qrContentHeight);

      try {
        const logoSize = qrContentWidth * 0.22;
        const logoBgSize = logoSize * 1.3;
        const logoBgX = qrX + (qrContentWidth - logoBgSize) / 2;
        const logoBgY = qrY + (qrContentHeight - logoBgSize) / 2;
        const logoBgRadius = logoBgSize * 0.12;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(logoBgX, logoBgY, logoBgSize, logoBgSize, logoBgRadius);
        ctx.fill();

        const { default: qLogoPath } = await import("@assets/file_000000002248722f8de433ffa27b321e~2_1775452887346.png");
        const qLogo = await loadImage(qLogoPath);
        const logoX = qrX + (qrContentWidth - logoSize) / 2;
        const logoY = qrY + (qrContentHeight - logoSize) / 2;
        ctx.drawImage(qLogo, logoX, logoY, logoSize, logoSize);
      } catch (logoErr) {
        console.warn("[productGraphicRenderer] Q logo overlay failed:", logoErr);
      }
    } catch (e) {
      console.warn("[productGraphicRenderer] QR load failed:", e);
    }
  }

  if (subBottomEnabled && subBottomText) {
    const subFontSize = Math.round(parseFontSize(subBottomFontSizeStr) * (W / 360));
    ctx.font = `${subFontSize}px "Arial"`;
    ctx.fillStyle = subBottomColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const subCenterX = W / 2;
    const subCenterY = subBottomZoneTop + subBottomZoneHeight / 2;
    ctx.fillText(subBottomText, subCenterX, subCenterY);
  }

  const footerIsImage = footerStyle?.mode === "image" && footerStyle?.imageUrl;
  const footerIsText = footerStyle && footerStyle.enabled !== false && footerStyle.text && footerStyle.mode !== "image";
  const resolvedFooterImageUrl = footerImageUrl || (footerIsImage ? footerStyle!.imageUrl : undefined);

  if (resolvedFooterImageUrl) {
    await drawImageInZone(resolvedFooterImageUrl, 0, footerZoneTop, W, footerZoneHeight, 0.05,
      footerStyle?.imageOffsetX ?? 50, footerStyle?.imageOffsetY ?? 50, footerStyle?.imageScale ?? 100);
  } else if (footerIsText) {
    drawTextInZone(footerStyle!, footerZoneTop, footerZoneHeight);
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
