import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps/wizardTypes";
import { DEFAULT_FONT_SIZE_NUM } from "@/features/shared/components/TextStyleEditor";
import { getGraphicLayout, clamp, GRAPHIC_LAYOUT_DEFAULTS } from "@/features/shared/graphics/graphicLayout";
import qLogoSrc from "@assets/file_000000002248722f8de433ffa27b321e~2_1775452887346.png";

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
  areaImageMode?: "behind-qr";
  areaImageOffsetX?: number;
  areaImageOffsetY?: number;
  areaImageScale?: number;
  subBottomEnabled?: boolean;
  subBottomText?: string;
  subBottomColor?: string;
  subBottomFontSize?: string;
  graphicLayoutMode?: "structured" | "freeform";
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

function parseFontSize(fontSize: string): number {
  const num = parseInt(fontSize, 10);
  return !isNaN(num) && num > 0 ? num : DEFAULT_FONT_SIZE_NUM;
}

function scaledFontSize(fontSize: string, canvasWidth: number): number {
  const base = parseFontSize(fontSize);
  return Math.round(base * (canvasWidth / 1200) * 2.5);
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
  offsetX: number = 50,
  offsetY: number = 50,
  scale: number = 100
) {
  try {
    const img = await loadImage(imgUrl);

    const imgAspect = img.width / img.height;
    const zoneAspect = zoneW / zoneH;

    let baseW = imgAspect > zoneAspect ? zoneW : zoneH * imgAspect;
    let baseH = imgAspect > zoneAspect ? baseW / imgAspect : zoneH;

    const scaleFactor = scale / 100;
    let drawW = baseW * scaleFactor;
    let drawH = baseH * scaleFactor;

    if (drawW > zoneW || drawH > zoneH) {
      const fitScale = Math.min(zoneW / drawW, zoneH / drawH);
      drawW *= fitScale;
      drawH *= fitScale;
    }

    const clampedOX = clamp(offsetX, 0, 100);
    const clampedOY = clamp(offsetY, 0, 100);

    const minX = zoneX;
    const maxX = zoneX + zoneW - drawW;
    const minY = zoneY;
    const maxY = zoneY + zoneH - drawH;

    const drawX = minX + (clampedOX / 100) * Math.max(0, maxX - minX);
    const drawY = minY + (clampedOY / 100) * Math.max(0, maxY - minY);

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  } catch (err) {
    console.warn("[productGraphicRenderer] Image load failed:", err);
  }
}

function drawTextInZone(
  ctx: CanvasRenderingContext2D,
  style: TextStyle,
  zoneX: number,
  zoneY: number,
  zoneW: number,
  zoneHeight: number,
  canvasW: number
) {
  const fSize = scaledFontSize(style.fontSize, canvasW);
  ctx.fillStyle = style.color || "#000";
  ctx.font = `bold ${fSize}px ${style.fontFamily}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  const vOffset = style.verticalOffset ?? 50;
  const hOffset = style.horizontalOffset ?? 50;

  const lines = wrapText(ctx, style.text, zoneW * 0.95);
  const lineHeight = fSize * 1.3;
  const totalTextHeight = lines.length * lineHeight;

  const startY = zoneY + (vOffset / 100) * Math.max(0, zoneHeight - totalTextHeight);
  const textX = zoneX + (hOffset / 100) * zoneW;

  if (style.strokeColor && style.strokeWidth && style.strokeWidth > 0) {
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth * 7.5;
    ctx.lineJoin = "round";
    for (let i = 0; i < lines.length; i++) {
      ctx.strokeText(lines[i], textX, startY + i * lineHeight);
    }
  }

  ctx.fillStyle = style.color || "#000";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, startY + i * lineHeight);
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
    qrPositionX = GRAPHIC_LAYOUT_DEFAULTS.defaultQrPositionX,
    qrPositionY = GRAPHIC_LAYOUT_DEFAULTS.defaultQrPositionY,
    qrSizePercent = GRAPHIC_LAYOUT_DEFAULTS.defaultQrSizePercent,
    headerImageUrl,
    footerImageUrl,
    areaImageUrl,
    areaImageMode = "behind-qr",
    subBottomEnabled = false,
    subBottomText = "Scan Me",
    subBottomColor = "#666666",
    subBottomFontSize = "14px",
    graphicLayoutMode = "structured",
  } = options;

  const dims = PLACEMENT_DIMENSIONS[placement || ""] || {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };

  const W = dims.width;
  const H = dims.height;

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

  const layout = getGraphicLayout({
    canvasWidth: W,
    canvasHeight: H,
    headerActive,
    footerActive,
    subBottomActive,
    qrPositionX,
    qrPositionY,
    qrSizePercent,
    layoutMode: graphicLayoutMode,
  });

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

  const qrX = layout.qr.square.x;
  const qrY = layout.qr.square.y;
  const qrSquareSize = layout.qr.size;

  const qrBgX = layout.qr.background.x;
  const qrBgY = layout.qr.background.y;
  const qrBgWidth = layout.qr.background.width;
  const qrBgHeight = layout.qr.background.height;
  const bgRadius = layout.qr.bgRadius;

  const areaOffX = options.areaImageOffsetX ?? 50;
  const areaOffY = options.areaImageOffsetY ?? 50;
  const areaSc = options.areaImageScale ?? 100;

  if (areaImageUrl && areaImageMode === "behind-qr") {
    await drawImageInZone(
      ctx, areaImageUrl,
      layout.zones.middle.x, layout.zones.middle.y,
      layout.zones.middle.width, layout.zones.middle.height,
      areaOffX, areaOffY, areaSc
    );
  }

  const qrBgColor = qrColor === "white" ? "#000000" : "#FFFFFF";
  ctx.fillStyle = qrBgColor;
  ctx.beginPath();
  ctx.roundRect(qrBgX, qrBgY, qrBgWidth, qrBgHeight, bgRadius);
  ctx.fill();

  ctx.drawImage(qrImg, qrX, qrY, qrSquareSize, qrSquareSize);

  try {
    const logoImg = await loadImage(qLogoSrc);
    const lb = layout.qr.logoBg;
    const li = layout.qr.logoImg;
    const lbRadius = lb.width * 0.12;

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(lb.x, lb.y, lb.width, lb.height, lbRadius);
    ctx.fill();

    ctx.drawImage(logoImg, li.x, li.y, li.width, li.height);
  } catch (_e) {
    // logo load failed, QR still works without it
  }

  if (headerActive) {
    const resolvedHeaderUrl =
      headerImageUrl || (headerStyle?.mode === "image" ? headerStyle?.imageUrl : undefined);

    if (resolvedHeaderUrl) {
      await drawImageInZone(
        ctx, resolvedHeaderUrl,
        layout.zones.header.x, layout.zones.header.y,
        layout.zones.header.width, layout.zones.header.height,
        headerStyle?.horizontalOffset ?? 50,
        headerStyle?.verticalOffset ?? 50,
        headerStyle?.imageScale ?? 100
      );
    } else if (headerStyle) {
      drawTextInZone(ctx, headerStyle, layout.zones.header.x, layout.zones.header.y, layout.zones.header.width, layout.zones.header.height, W);
    }
  }

  if (subBottomActive) {
    const sbFSize = scaledFontSize(subBottomFontSize, W);
    ctx.fillStyle = subBottomColor;
    ctx.font = `${sbFSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      subBottomText.trim(),
      layout.zones.subBottom.x + layout.zones.subBottom.width / 2,
      layout.zones.subBottom.y + layout.zones.subBottom.height / 2
    );
  }

  if (footerActive) {
    const resolvedFooterUrl =
      footerImageUrl || (footerStyle?.mode === "image" ? footerStyle?.imageUrl : undefined);

    if (resolvedFooterUrl) {
      await drawImageInZone(
        ctx, resolvedFooterUrl,
        layout.zones.footer.x, layout.zones.footer.y,
        layout.zones.footer.width, layout.zones.footer.height,
        footerStyle?.horizontalOffset ?? 50,
        footerStyle?.verticalOffset ?? 50,
        footerStyle?.imageScale ?? 100
      );
    } else if (footerStyle) {
      drawTextInZone(ctx, footerStyle, layout.zones.footer.x, layout.zones.footer.y, layout.zones.footer.width, layout.zones.footer.height, W);
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
