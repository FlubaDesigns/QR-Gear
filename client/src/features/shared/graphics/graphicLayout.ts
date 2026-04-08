export type GraphicLayoutMode = "zone" | "freeform";

export interface GraphicLayoutInput {
  canvasWidth: number;
  canvasHeight: number;
  headerActive: boolean;
  footerActive: boolean;
  subBottomActive: boolean;
  qrPositionX?: number;
  qrPositionY?: number;
  qrSizePercent?: number;
  layoutMode?: GraphicLayoutMode;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphicLayoutResult {
  canvas: { width: number; height: number };
  safeRect: Rect;
  zones: {
    header: Rect;
    middle: Rect;
    subBottom: Rect;
    footer: Rect;
  };
  qr: {
    square: Rect;
    background: Rect;
    size: number;
    bgPadding: number;
    bgRadius: number;
    logoBg: Rect;
    logoImg: Rect;
  };
}

export const BLEED_SAFE_PX = 75;

export const GRAPHIC_LAYOUT_DEFAULTS = {
  headerPct: 0.30,
  footerPct: 0.30,
  middlePct: 0.40,
  subBottomPct: 0.05,

  qrBgPaddingPct: 0.07,
  qrBgPaddingMin: 14,
  qrBgRadiusPct: 0.06,
  qrBgRadiusMin: 12,

  logoSizePct: 0.22,
  logoBgScale: 1.3,
  logoBgRadiusPct: 0.12,

  defaultQrPositionX: 50,
  defaultQrPositionY: 50,
  defaultQrSizePercent: 75,
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getGraphicLayout(input: GraphicLayoutInput): GraphicLayoutResult {
  const {
    canvasWidth: W,
    canvasHeight: H,
    headerActive,
    footerActive,
    subBottomActive,
    qrPositionX = GRAPHIC_LAYOUT_DEFAULTS.defaultQrPositionX,
    qrPositionY = GRAPHIC_LAYOUT_DEFAULTS.defaultQrPositionY,
    qrSizePercent = GRAPHIC_LAYOUT_DEFAULTS.defaultQrSizePercent,
    layoutMode = "zone",
  } = input;

  const cfg = GRAPHIC_LAYOUT_DEFAULTS;

  const bleed = BLEED_SAFE_PX;
  const safeRect: Rect = {
    x: bleed,
    y: bleed,
    width: Math.max(1, W - 2 * bleed),
    height: Math.max(1, H - 2 * bleed),
  };

  const SX = safeRect.x;
  const SY = safeRect.y;
  const SW = safeRect.width;
  const SH = safeRect.height;

  let headerZone: Rect;
  let middleZone: Rect;
  let subBottomZone: Rect;
  let footerZone: Rect;
  let qrRegion: Rect;

  if (layoutMode === "freeform") {
    headerZone = { x: SX, y: SY, width: SW, height: SH };
    middleZone = { x: SX, y: SY, width: SW, height: SH };
    subBottomZone = { x: SX, y: SY, width: SW, height: 0 };
    footerZone = { x: SX, y: SY, width: SW, height: SH };
    qrRegion = { x: SX, y: SY, width: SW, height: SH };
  } else {
    const subBottomHeight = subBottomActive ? SH * cfg.subBottomPct : 0;
    const headerHeight = SH * cfg.headerPct;
    const footerPct = subBottomActive ? (cfg.footerPct - cfg.subBottomPct) : cfg.footerPct;
    const footerHeight = SH * footerPct;
    const middleHeight = Math.max(1, SH - headerHeight - footerHeight - subBottomHeight);

    headerZone = { x: SX, y: SY, width: SW, height: headerHeight };
    middleZone = { x: SX, y: SY + headerHeight, width: SW, height: middleHeight };
    subBottomZone = { x: SX, y: SY + headerHeight + middleHeight, width: SW, height: subBottomHeight };
    footerZone = { x: SX, y: SY + headerHeight + middleHeight + subBottomHeight, width: SW, height: footerHeight };
    qrRegion = middleZone;
  }

  const qrMaxDim = Math.min(qrRegion.width, qrRegion.height);
  const qrSize = clamp(qrMaxDim * (qrSizePercent / 100), 180, qrMaxDim);

  const clampedX = clamp(qrPositionX, 0, 100);
  const clampedY = clamp(qrPositionY, 0, 100);

  const availX = Math.max(0, qrRegion.width - qrSize);
  const availY = Math.max(0, qrRegion.height - qrSize);

  const qrSquare: Rect = {
    x: qrRegion.x + (clampedX / 100) * availX,
    y: qrRegion.y + (clampedY / 100) * availY,
    width: qrSize,
    height: qrSize,
  };

  const bgPadding = Math.max(cfg.qrBgPaddingMin, qrSize * cfg.qrBgPaddingPct);
  const bgRadius = Math.max(cfg.qrBgRadiusMin, qrSize * cfg.qrBgRadiusPct);

  const qrBackground: Rect = {
    x: qrSquare.x - bgPadding,
    y: qrSquare.y - bgPadding,
    width: qrSize + bgPadding * 2,
    height: qrSize + bgPadding * 2,
  };

  const logoImgSize = qrSize * cfg.logoSizePct;
  const logoBgSize = logoImgSize * cfg.logoBgScale;

  const logoBg: Rect = {
    x: qrSquare.x + (qrSize - logoBgSize) / 2,
    y: qrSquare.y + (qrSize - logoBgSize) / 2,
    width: logoBgSize,
    height: logoBgSize,
  };

  const logoImg: Rect = {
    x: qrSquare.x + (qrSize - logoImgSize) / 2,
    y: qrSquare.y + (qrSize - logoImgSize) / 2,
    width: logoImgSize,
    height: logoImgSize,
  };

  return {
    canvas: { width: W, height: H },
    safeRect,
    zones: { header: headerZone, middle: middleZone, subBottom: subBottomZone, footer: footerZone },
    qr: {
      square: qrSquare,
      background: qrBackground,
      size: qrSize,
      bgPadding,
      bgRadius,
      logoBg: { ...logoBg, height: logoBgSize },
      logoImg,
    },
  };
}
