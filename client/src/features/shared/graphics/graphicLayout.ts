export type GraphicLayoutMode = "structured" | "freeform";

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
    layoutMode = "structured",
  } = input;

  const cfg = GRAPHIC_LAYOUT_DEFAULTS;

  let headerZone: Rect;
  let middleZone: Rect;
  let subBottomZone: Rect;
  let footerZone: Rect;
  let qrRegion: { width: number; height: number; x: number; y: number };

  if (layoutMode === "freeform") {
    headerZone = { x: 0, y: 0, width: W, height: H };
    middleZone = { x: 0, y: 0, width: W, height: H };
    subBottomZone = { x: 0, y: 0, width: W, height: 0 };
    footerZone = { x: 0, y: 0, width: W, height: H };
    qrRegion = { x: 0, y: 0, width: W, height: H };
  } else {
    const subBottomHeight = subBottomActive ? H * cfg.subBottomPct : 0;
    const headerHeight = headerActive ? H * cfg.headerPct : 0;
    const footerHeight = footerActive ? Math.max(0, H * cfg.footerPct - subBottomHeight) : 0;
    const middleHeight = Math.max(1, H - headerHeight - footerHeight - subBottomHeight);

    headerZone = { x: 0, y: 0, width: W, height: headerHeight };
    middleZone = { x: 0, y: headerHeight, width: W, height: middleHeight };
    subBottomZone = { x: 0, y: headerHeight + middleHeight, width: W, height: subBottomHeight };
    footerZone = { x: 0, y: headerHeight + middleHeight + subBottomHeight, width: W, height: footerHeight };
    qrRegion = middleZone;
  }

  const qrMaxDim = Math.min(qrRegion.width, qrRegion.height) * 0.85;
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
  const logoBgRadius = logoBgSize * cfg.logoBgRadiusPct;

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
