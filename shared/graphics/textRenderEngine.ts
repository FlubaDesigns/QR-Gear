/**
 * textRenderEngine.ts
 *
 * Shared text layout engine for all text rendering areas in the application.
 *
 * Architecture:
 *  - TextZoneContext  describes the rules for a specific area (canvas size,
 *    bleed boundaries, max wrap width).  Each area has its own factory that
 *    encodes the area-specific rules.
 *  - A COMMON base config is shared by all product-graphic zones so rule
 *    changes propagate everywhere automatically.
 *  - The compute* functions are pure math — identical results regardless of
 *    whether the caller renders to SVG or Canvas.  Changing the output format
 *    never touches this file.
 *  - wrapTextApprox  is used by SVG renderers (no measureText available).
 *  - wrapTextMeasured is used by Canvas renderers for pixel-accurate wrapping.
 *
 * Print-layout guarantee: every formula here matches the inline math that was
 * previously spread across UnifiedGraphic, productGraphicRenderer and
 * landingPageRenderer.  No visual output changes — only the logic is unified.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextZoneContext {
  canvasWidth: number;
  canvasHeight: number;
  zoneX: number;
  zoneY: number;
  zoneWidth: number;
  zoneHeight: number;
  /** Left X boundary — text left edge reaches here at hOffset = 0 */
  bleedLeft: number;
  /** Right X boundary — text right edge reaches here at hOffset = 100 */
  bleedRight: number;
  /** Maximum line width for word-wrapping */
  maxTextWidth: number;
}

// ---------------------------------------------------------------------------
// Common base config — shared across all product-graphic zones.
// Changing these values updates header, footer, and any future zones at once.
// ---------------------------------------------------------------------------

const PRODUCT_GRAPHIC_BASE = {
  bleedRatio: 0.06,         // 6 % inset from each edge
  maxTextWidthRatio: 0.90,  // wrap at 90 % of canvas width
} as const;

// ---------------------------------------------------------------------------
// Zone context factories
// Each factory encodes the rules that belong to that specific area.
// Zones that share the same rules use the common product-graphic base.
// ---------------------------------------------------------------------------

/**
 * Product-graphic zone (header or footer).
 * Both zones share the same bleed and wrap rules from PRODUCT_GRAPHIC_BASE.
 * Pass the zone's own y / height from the graphic layout.
 */
export function productGraphicZoneContext(
  zoneX: number,
  zoneY: number,
  zoneWidth: number,
  zoneHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): TextZoneContext {
  return {
    canvasWidth,
    canvasHeight,
    zoneX,
    zoneY,
    zoneWidth,
    zoneHeight,
    bleedLeft:    canvasWidth * PRODUCT_GRAPHIC_BASE.bleedRatio,
    bleedRight:   canvasWidth * (1 - PRODUCT_GRAPHIC_BASE.bleedRatio),
    maxTextWidth: canvasWidth * PRODUCT_GRAPHIC_BASE.maxTextWidthRatio,
  };
}

/** Alias — header zone uses the same product-graphic rules. */
export const headerZoneContext = productGraphicZoneContext;

/** Alias — footer zone uses the same product-graphic rules. */
export const footerZoneContext = productGraphicZoneContext;

/**
 * Landing-page text block.
 * Different canvas size (9:16 phone ratio) and slightly tighter bleed.
 */
export function landingPageBlockContext(): TextZoneContext {
  const W = 2700;
  const H = 4800;
  return {
    canvasWidth:  W,
    canvasHeight: H,
    zoneX:        0,
    zoneY:        0,
    zoneWidth:    W,
    zoneHeight:   H,
    bleedLeft:    W * 0.05,
    bleedRight:   W * 0.95,
    maxTextWidth: W * 0.90,
  };
}

// ---------------------------------------------------------------------------
// Core layout functions — pure math, format-agnostic
// ---------------------------------------------------------------------------

/**
 * Compute the horizontal center X for text.
 * Caller should use textAlign="center" / textAnchor="middle".
 *
 * hOffset = 0   → left  edge of text sits at context.bleedLeft
 * hOffset = 100 → right edge of text sits at context.bleedRight
 * Very wide text (halfTextWidth large) is clamped to stay centered
 * rather than reversing direction.
 */
export function computeTextX(
  hOffset: number,
  halfTextWidth: number,
  context: Pick<TextZoneContext, 'bleedLeft' | 'bleedRight' | 'canvasWidth'>,
): number {
  const { bleedLeft, bleedRight, canvasWidth } = context;
  const leftCenter  = Math.min(bleedLeft  + halfTextWidth, canvasWidth / 2);
  const rightCenter = Math.max(bleedRight - halfTextWidth, canvasWidth / 2);
  return leftCenter + (hOffset / 100) * (rightCenter - leftCenter);
}

/**
 * Compute the Y position of the first line's top edge.
 * vOffset = 0   → text sits at top of zone
 * vOffset = 100 → text sits at bottom of zone
 */
export function computeTextStartY(
  vOffset: number,
  totalTextHeight: number,
  context: Pick<TextZoneContext, 'zoneY' | 'zoneHeight'>,
): number {
  const { zoneY, zoneHeight } = context;
  const marginY    = zoneHeight * 0.01;
  const usableH    = zoneHeight - 2 * marginY;
  return zoneY + marginY + (vOffset / 100) * Math.max(0, usableH - totalTextHeight);
}

// ---------------------------------------------------------------------------
// Text wrapping
// ---------------------------------------------------------------------------

/**
 * Wrap text using character-width approximation.
 * Suitable for SVG renderers where canvas measureText is unavailable.
 * Respects explicit '\n' line breaks (Enter key in the text editor).
 */
export function wrapTextApprox(
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const charWidth = 0.55 * fontSize;
  const lines: string[] = [];

  for (const seg of text.split('\n')) {
    if (!seg) { lines.push(''); continue; }
    const words = seg.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (test.length * charWidth > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }

  return lines;
}

/**
 * Wrap text using canvas measureText for pixel-accurate glyph widths.
 * Suitable for Canvas 2D renderers.
 * Respects explicit '\n' line breaks (Enter key in the text editor).
 */
export function wrapTextMeasured(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];

  for (const seg of text.split('\n')) {
    if (!seg) { lines.push(''); continue; }
    const words = seg.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }

  return lines;
}
