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

  // Logo spec: container = 26% of QR, logo = 70% of container (18.2% of QR)
  // logoBgScale = 0.26 / 0.182 ≈ 1.43 — single source of truth, imported by all renderers
  logoSizePct: 0.182,
  logoBgScale: 1.43,
  logoBgRadiusPct: 0.10,

  // Gap below the QR background box before the sub-bottom zone starts
  subBottomGapPct: 0.04,
  subBottomGapMin: 16,

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

  // ── ZONE MODE: QR-anchored ──────────────────────────────────────────────
  if (layoutMode === "zone") {
    // 1. QR size in Zone mode is driven by qrSizePercent / 2 so the same
    //    slider value spans both modes. Default 75 → 37.5% ≈ prior hardcoded 38%.
    const zoneQrPct = clamp(qrSizePercent / 2, 15, 55);
    const qrSize = clamp(SW * (zoneQrPct / 100), 180, SW);

    // 2. QR always at canvas center — consistent position across all shirt types
    const qrCenterX = SX + SW / 2;
    const qrCenterY = SY + SH / 2;
    const qrLeft   = qrCenterX - qrSize / 2;
    const qrTop    = qrCenterY - qrSize / 2;
    const qrBottom = qrTop + qrSize;

    // 3. Fixed gap between QR and surrounding zones (print-safe, minimal)
    const zonePadding = 8;

    // 3a. QR background padding — must be computed before zones so sub-bottom
    //     can start at the actual bottom of the white QR background box, not
    //     just the bottom of the raw QR square (which sits inside the white box).
    const bgPadding = Math.max(cfg.qrBgPaddingMin, qrSize * cfg.qrBgPaddingPct);
    const qrBgBottom = qrBottom + bgPadding; // true visual bottom of the white box

    // 4. Sub-bottom strip sits below QR background box + a clear gap (no edge overlap)
    const subBottomGap    = Math.max(cfg.subBottomGapMin, qrSize * cfg.subBottomGapPct);
    const subBottomTop    = qrBgBottom + subBottomGap;
    const subBottomHeight = subBottomActive ? Math.max(20, qrSize * 0.08) : 0;

    // 5. Header zone: fills from bleed top down to just above QR
    const headerZone: Rect = {
      x: SX, y: SY,
      width: SW,
      height: Math.max(0, qrTop - SY - zonePadding),
    };

    // 6. Middle zone: exactly the QR square area
    const middleZone: Rect = {
      x: SX, y: qrTop,
      width: SW,
      height: qrSize,
    };

    // 7. Sub-bottom zone: below the QR background box + gap
    const subBottomZone: Rect = {
      x: SX, y: subBottomTop,
      width: SW,
      height: subBottomHeight,
    };

    // 8. Footer zone: below sub-bottom (or QR bg + gap) down to bleed bottom
    const footerPad = subBottomActive ? 6 : zonePadding;
    const footerY   = subBottomTop + subBottomHeight + footerPad;
    const footerZone: Rect = {
      x: SX, y: footerY,
      width: SW,
      height: Math.max(0, (SY + SH) - footerY),
    };

    // 9. QR geometry (bgPadding already computed above)
    const bgRadius  = Math.max(cfg.qrBgRadiusMin,  qrSize * cfg.qrBgRadiusPct);

    const qrSquare: Rect     = { x: qrLeft, y: qrTop, width: qrSize, height: qrSize };
    const qrBackground: Rect = {
      x: qrLeft - bgPadding,
      y: qrTop  - bgPadding,
      width:  qrSize + bgPadding * 2,
      height: qrSize + bgPadding * 2,
    };

    const logoImgSize = qrSize * cfg.logoSizePct;
    const logoBgSize  = logoImgSize * cfg.logoBgScale;

    const logoBg: Rect = {
      x: qrLeft + (qrSize - logoBgSize) / 2,
      y: qrTop  + (qrSize - logoBgSize) / 2,
      width: logoBgSize, height: logoBgSize,
    };
    const logoImg: Rect = {
      x: qrLeft + (qrSize - logoImgSize) / 2,
      y: qrTop  + (qrSize - logoImgSize) / 2,
      width: logoImgSize, height: logoImgSize,
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

  // ── FREEFORM MODE: full-canvas, position-driven ─────────────────────────
  const headerZone:    Rect = { x: SX, y: SY, width: SW, height: SH };
  const middleZone:    Rect = { x: SX, y: SY, width: SW, height: SH };
  const subBottomZone: Rect = { x: SX, y: SY, width: SW, height: 0  };
  const footerZone:    Rect = { x: SX, y: SY, width: SW, height: SH };
  const qrRegion:      Rect = { x: SX, y: SY, width: SW, height: SH };

  const qrMaxDim = Math.min(qrRegion.width, qrRegion.height);
  const qrSize   = clamp(qrMaxDim * (qrSizePercent / 100), 180, qrMaxDim);

  const clampedX = clamp(qrPositionX, 0, 100);
  const clampedY = clamp(qrPositionY, 0, 100);

  const availX = Math.max(0, qrRegion.width  - qrSize);
  const availY = Math.max(0, qrRegion.height - qrSize);

  const qrSquare: Rect = {
    x: qrRegion.x + (clampedX / 100) * availX,
    y: qrRegion.y + (clampedY / 100) * availY,
    width: qrSize,
    height: qrSize,
  };

  const bgPadding = Math.max(cfg.qrBgPaddingMin, qrSize * cfg.qrBgPaddingPct);
  const bgRadius  = Math.max(cfg.qrBgRadiusMin,  qrSize * cfg.qrBgRadiusPct);

  const qrBackground: Rect = {
    x: qrSquare.x - bgPadding,
    y: qrSquare.y - bgPadding,
    width:  qrSize + bgPadding * 2,
    height: qrSize + bgPadding * 2,
  };

  const logoImgSize = qrSize * cfg.logoSizePct;
  const logoBgSize  = logoImgSize * cfg.logoBgScale;

  const logoBg: Rect = {
    x: qrSquare.x + (qrSize - logoBgSize) / 2,
    y: qrSquare.y + (qrSize - logoBgSize) / 2,
    width: logoBgSize, height: logoBgSize,
  };
  const logoImg: Rect = {
    x: qrSquare.x + (qrSize - logoImgSize) / 2,
    y: qrSquare.y + (qrSize - logoImgSize) / 2,
    width: logoImgSize, height: logoImgSize,
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
