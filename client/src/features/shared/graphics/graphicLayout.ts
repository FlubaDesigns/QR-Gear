export interface GraphicLayoutInput {
  canvasWidth: number;
  canvasHeight: number;
  headerActive: boolean;
  footerActive: boolean;
  subBottomActive: boolean;
  qrPositionX?: number;
  qrPositionY?: number;
  qrSizePercent?: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphicLayoutResult {
  canvas: {
    width: number;
    height: number;
  };
  padding: {
    top: number;
    bottom: number;
    side: number;
  };
  gaps: {
    headerToMiddle: number;
    middleToSubBottom: number;
    subBottomToFooter: number;
  };
  zones: {
    header: Rect;
    middle: Rect;
    subBottom: Rect;
    footer: Rect;
  };
  qr: {
    content: Rect;
    square: Rect;
    background: Rect;
    size: number;
    bgPadding: number;
    bgRadius: number;
  };
}

export const GRAPHIC_LAYOUT_DEFAULTS = {
  topPaddingPct: 0.028,
  bottomPaddingPct: 0.024,
  sidePaddingPct: 0.04,

  headerHeightPct: 0.17,
  footerHeightPct: 0.115,
  subBottomHeightPct: 0.032,

  headerGapPct: 0.012,
  subBottomGapPct: 0.006,
  footerGapPct: 0.004,

  middleMinPct: 0.30,

  qrTopInsetPct: 0.035,
  qrBottomInsetPct: 0.02,
  qrSideInsetPct: 0.03,

  qrMinPercent: 32,
  qrMaxPercent: 48,
  qrMinPixelSize: 220,

  qrBgPaddingPct: 0.07,
  qrBgPaddingMin: 14,
  qrBgRadiusPct: 0.055,
  qrBgRadiusMin: 12,

  defaultQrPositionX: 50,
  defaultQrPositionY: 0,
  defaultQrSizePercent: 42,
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
  } = input;

  const cfg = GRAPHIC_LAYOUT_DEFAULTS;

  const topPadding = H * cfg.topPaddingPct;
  const bottomPadding = H * cfg.bottomPaddingPct;
  const sidePadding = W * cfg.sidePaddingPct;

  const headerHeight = headerActive ? H * cfg.headerHeightPct : 0;
  const footerHeight = footerActive ? H * cfg.footerHeightPct : 0;
  const subBottomHeight = subBottomActive ? H * cfg.subBottomHeightPct : 0;

  const headerGap = headerActive ? H * cfg.headerGapPct : 0;
  const middleToSubBottomGap = subBottomActive ? H * cfg.subBottomGapPct : 0;
  const subBottomToFooterGap = footerActive ? H * cfg.footerGapPct : 0;

  const reservedHeight =
    topPadding +
    bottomPadding +
    headerHeight +
    footerHeight +
    subBottomHeight +
    headerGap +
    middleToSubBottomGap +
    subBottomToFooterGap;

  const middleHeight = Math.max(H * cfg.middleMinPct, H - reservedHeight);

  const headerZone: Rect = {
    x: 0,
    y: topPadding,
    width: W,
    height: headerHeight,
  };

  const middleZone: Rect = {
    x: 0,
    y: headerZone.y + headerZone.height + headerGap,
    width: W,
    height: middleHeight,
  };

  const subBottomZone: Rect = {
    x: 0,
    y: middleZone.y + middleZone.height + middleToSubBottomGap,
    width: W,
    height: subBottomHeight,
  };

  const footerZone: Rect = {
    x: 0,
    y: subBottomZone.y + subBottomZone.height + subBottomToFooterGap,
    width: W,
    height: footerHeight,
  };

  const qrTopInset = Math.max(8, middleZone.height * cfg.qrTopInsetPct);
  const qrBottomInset = Math.max(8, middleZone.height * cfg.qrBottomInsetPct);
  const qrSideInset = Math.max(12, W * cfg.qrSideInsetPct);

  const qrContent: Rect = {
    x: qrSideInset,
    y: middleZone.y + qrTopInset,
    width: Math.max(1, W - qrSideInset * 2),
    height: Math.max(1, middleZone.height - qrTopInset - qrBottomInset),
  };

  const maxQrSquare = Math.min(qrContent.width, qrContent.height);
  const effectiveQrPercent = clamp(
    qrSizePercent,
    cfg.qrMinPercent,
    cfg.qrMaxPercent
  );

  const qrSize = clamp(
    maxQrSquare * (effectiveQrPercent / 100),
    cfg.qrMinPixelSize,
    maxQrSquare
  );

  const clampedX = clamp(qrPositionX, 0, 100);
  const clampedY = clamp(qrPositionY, 0, 100);

  const availableX = Math.max(0, qrContent.width - qrSize);
  const availableY = Math.max(0, qrContent.height - qrSize);

  const qrSquare: Rect = {
    x: qrContent.x + (clampedX / 100) * availableX,
    y: qrContent.y + (clampedY / 100) * availableY,
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

  return {
    canvas: {
      width: W,
      height: H,
    },
    padding: {
      top: topPadding,
      bottom: bottomPadding,
      side: sidePadding,
    },
    gaps: {
      headerToMiddle: headerGap,
      middleToSubBottom: middleToSubBottomGap,
      subBottomToFooter: subBottomToFooterGap,
    },
    zones: {
      header: headerZone,
      middle: middleZone,
      subBottom: subBottomZone,
      footer: footerZone,
    },
    qr: {
      content: qrContent,
      square: qrSquare,
      background: qrBackground,
      size: qrSize,
      bgPadding,
      bgRadius,
    },
  };
}
