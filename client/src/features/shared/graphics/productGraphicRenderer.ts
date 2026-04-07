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

const MIN_QR_PIXEL_SIZE = 280;
const MAX_LOGO_RATIO = 0.16;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}


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
    qrPositionY = 0,
    qrSizePercent = 70,
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
  const subBottomText = (options.subBottomText || "Scan Me").trim();
  const subBottomColor = options.subBottomColor || "#666666";
  const subBottomFontSizeStr = options.subBottomFontSize || "14px";

  const headerIsImage = headerStyle?.mode === "image" && headerStyle?.imageUrl;
  const headerIsText =
    !!headerStyle &&
    headerStyle.enabled !== false &&
    !!headerStyle.text &&
    headerStyle.mode !== "image";
  const resolvedHeaderImageUrl =
    headerImageUrl || (headerIsImage ? headerStyle!.imageUrl : undefined);

  const footerIsImage = footerStyle?.mode === "image" && footerStyle?.imageUrl;
  const footerIsText =
    !!footerStyle &&
    footerStyle.enabled !== false &&
    !!footerStyle.text &&
    footerStyle.mode !== "image";
  const resolvedFooterImageUrl =
    footerImageUrl || (footerIsImage ? footerStyle!.imageUrl : undefined);

  const headerActive = Boolean(resolvedHeaderImageUrl || headerIsText);
  const footerActive = Boolean(resolvedFooterImageUrl || footerIsText);
  const subBottomActive = Boolean(subBottomEnabled && subBottomText);

  const topPadding = H * 0.035;
  const bottomPadding = H * 0.03;
  const sectionGap = H * 0.012;

  const headerZoneTop = topPadding;
  const headerZoneHeight = headerActive ? H * 0.13 : 0;

  const subBottomZoneHeight = subBottomActive ? H * 0.05 : 0;
  const footerZoneHeight = footerActive ? H * 0.06 : 0;

  const headerGap = headerActive ? sectionGap : 0;
  const subBottomGap = subBottomActive ? sectionGap * 0.35 : 0;
  const footerGap = footerActive ? sectionGap * 0.35 : 0;

  const reservedHeight =
    topPadding +
    bottomPadding +
    headerZoneHeight +
    subBottomZoneHeight +
    footerZoneHeight +
    headerGap +
    subBottomGap +
    footerGap;

  const middleZoneTop = headerZoneTop + headerZoneHeight + headerGap;
  const middleZoneHeight = Math.max(H * 0.24, H - reservedHeight);

  const subBottomZoneTop =
    middleZoneTop + middleZoneHeight + (subBottomActive ? subBottomGap : 0);

  const footerZoneTop =
    subBottomZoneTop + subBottomZoneHeight + (footerActive ? footerGap : 0);

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

      const clampedX = Math.max(0, Math.min(100, offsetX));
      const clampedY = Math.max(0, Math.min(100, offsetY));

      const marginX = zoneW * 0.02;
      const marginY = zoneH * 0.02;

      const minX = zoneX + padX + marginX;
      const maxX = zoneX + zoneW - padX - marginX - drawW;

      const minY = zoneY + padY + marginY;
      const maxY = zoneY + zoneH - padY - marginY - drawH;

      const drawX = minX + (clampedX / 100) * Math.max(0, maxX - minX);
      const drawY = minY + (clampedY / 100) * Math.max(0, maxY - minY);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } catch (err) {
      console.warn("[productGraphicRenderer] Image load failed:", err);
    }
  };

  if (resolvedHeaderImageUrl) {
    await drawImageInZone(resolvedHeaderImageUrl, 0, headerZoneTop, W, headerZoneHeight, 0.05,
      headerStyle?.imageOffsetX ?? 50, headerStyle?.imageOffsetY ?? 50, headerStyle?.imageScale ?? 100);
  } else if (headerIsText) {
    drawTextInZone(headerStyle!, headerZoneTop, headerZoneHeight);
  }

  const qrTopInset = Math.max(6, middleZoneHeight * 0.01);
  const qrBottomInset = Math.max(6, middleZoneHeight * 0.01);
  const qrSideInset = Math.max(12, W * 0.03);

  const qrContentRegionTop = middleZoneTop + qrTopInset;
  const qrContentRegionHeight = Math.max(
    1,
    middleZoneHeight - qrTopInset - qrBottomInset
  );
  const qrContentRegionLeft = qrSideInset;
  const qrContentRegionWidth = Math.max(1, W - qrSideInset * 2);

  const maxQrSquare = Math.min(qrContentRegionWidth, qrContentRegionHeight);
  const effectiveQrPercent = clamp(qrSizePercent, 30, 62);
  const qrSquareSize = clamp(maxQrSquare * (effectiveQrPercent / 100), MIN_QR_PIXEL_SIZE, maxQrSquare);

  const clampedX = clamp(qrPositionX, 0, 100);
  const clampedY = clamp(qrPositionY, 0, 100);

  const availableX = Math.max(0, qrContentRegionWidth - qrSquareSize);
  const availableY = Math.max(0, qrContentRegionHeight - qrSquareSize);

  const qrX = qrContentRegionLeft + (clampedX / 100) * availableX;
  const qrY = qrContentRegionTop + (clampedY / 100) * availableY;

  const bgPadding = Math.max(16, qrSquareSize * 0.08);
  const bgRadius = Math.max(12, qrSquareSize * 0.06);

  const qrBgX = qrX - bgPadding;
  const qrBgY2 = qrY - bgPadding;
  const qrBgWidth = qrSquareSize + bgPadding * 2;
  const qrBgHeight = qrSquareSize + bgPadding * 2;

  const areaOffX = options.areaImageOffsetX ?? 50;
  const areaOffY = options.areaImageOffsetY ?? 50;
  const areaSc = options.areaImageScale ?? 100;

  if (areaImageUrl && areaImageMode === "replace-qr") {
    await drawImageInZone(areaImageUrl, 0, middleZoneTop, W, middleZoneHeight, 0.03, areaOffX, areaOffY, areaSc);
  } else {
    if (areaImageUrl && areaImageMode === "behind-qr") {
      await drawImageInZone(areaImageUrl, 0, middleZoneTop, W, middleZoneHeight, 0.03, areaOffX, areaOffY, areaSc);
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(qrBgX, qrBgY2, qrBgWidth, qrBgHeight, bgRadius);
    ctx.fill();

    try {
      const qrImgSize = Math.max(512, Math.round(qrSquareSize * 2));
      const qrUrl = generateQRCodeUrl(qrContent, qrImgSize, qrColor);
      const qrImg = await loadImage(qrUrl);

      ctx.drawImage(qrImg, qrX, qrY, qrSquareSize, qrSquareSize);

      try {
        const logoSize = qrSquareSize * MAX_LOGO_RATIO;
        const logoBgSize = logoSize * 1.35;
        const logoBgX = qrX + (qrSquareSize - logoBgSize) / 2;
        const logoBgY = qrY + (qrSquareSize - logoBgSize) / 2;
        const logoBgRadius = logoBgSize * 0.14;

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(logoBgX, logoBgY, logoBgSize, logoBgSize, logoBgRadius);
        ctx.fill();

        const { default: qLogoPath } = await import("@assets/file_000000002248722f8de433ffa27b321e~2_1775452887346.png");
        const qLogo = await loadImage(qLogoPath);

        const logoX = qrX + (qrSquareSize - logoSize) / 2;
        const logoY = qrY + (qrSquareSize - logoSize) / 2;
        ctx.drawImage(qLogo, logoX, logoY, logoSize, logoSize);
      } catch (logoErr) {
        console.warn("[productGraphicRenderer] Q logo overlay failed:", logoErr);
      }
    } catch (e) {
      console.warn("[productGraphicRenderer] QR load failed:", e);
    }
  }

  if (subBottomActive) {
    const captionPadX = Math.max(12, W * 0.03);
    const subFontSize = Math.round(parseFontSize(subBottomFontSizeStr) * (W / 360));

    ctx.font = `${subFontSize}px "Arial"`;
    ctx.fillStyle = subBottomColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxCaptionWidth = W - captionPadX * 2;
    const captionCenterX = W / 2;
    const captionCenterY = subBottomZoneTop + subBottomZoneHeight / 2;

    const measured = ctx.measureText(subBottomText);
    if (measured.width > maxCaptionWidth) {
      const scale = maxCaptionWidth / measured.width;
      ctx.font = `${Math.max(10, Math.round(subFontSize * scale))}px "Arial"`;
    }

    ctx.fillText(subBottomText, captionCenterX, captionCenterY);
  }

  if (resolvedFooterImageUrl) {
    await drawImageInZone(resolvedFooterImageUrl, 0, footerZoneTop, W, footerZoneHeight, 0.05,
      footerStyle?.imageOffsetX ?? 50, footerStyle?.imageOffsetY ?? 50, footerStyle?.imageScale ?? 100);
  } else if (footerIsText) {
    const footerText = footerStyle!.text || "";
    const footerFontFamily = footerStyle!.fontFamily || "Arial";
    const footerColor = footerStyle!.color || "#000000";
    const footerFontSizeStr = footerStyle!.fontSize || "16px";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxFooterWidth = W * 0.85;

    let footerFontSize = Math.round(parseFontSize(footerFontSizeStr) * (W / 360));
    ctx.font = `bold ${footerFontSize}px "${footerFontFamily}", "Arial", sans-serif`;

    let measured = ctx.measureText(footerText);

    if (measured.width > maxFooterWidth) {
      const scale = maxFooterWidth / measured.width;
      footerFontSize = Math.max(14, Math.round(footerFontSize * scale));
      ctx.font = `bold ${footerFontSize}px "${footerFontFamily}", "Arial", sans-serif`;
    }

    ctx.fillStyle = footerColor;

    const footerCenterX = W / 2;
    const footerCenterY = footerZoneTop + footerZoneHeight / 2;

    if (footerStyle!.strokeColor && footerStyle!.strokeWidth && footerStyle!.strokeWidth > 0) {
      ctx.strokeStyle = footerStyle!.strokeColor;
      ctx.lineWidth = footerStyle!.strokeWidth * (W / 360);
      ctx.strokeText(footerText, footerCenterX, footerCenterY);
    }

    ctx.fillText(footerText, footerCenterX, footerCenterY);
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
