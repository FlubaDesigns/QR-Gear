/**
 * Shared layout constants for product graphic renderer (canvas) and UnifiedGraphic (SVG preview).
 *
 * RULES:
 * - All values are ratios unless explicitly noted (e.g., minSize in pixels).
 * - Values are relative to canvas HEIGHT unless otherwise specified.
 * - Width-based values are explicitly labeled.
 * - Runtime inputs (qrPositionX, qrPositionY, qrSizePercent) must be clamped in usage code.
 */

export const GRAPHIC_LAYOUT = {
  padding: {
    top: 0.055,      // relative to height
    bottom: 0.05,    // relative to height
    gap: 0.014,      // relative to height
  },

  zones: {
    header: 0.18,     // relative to height
    footer: 0.16,     // relative to height
    subBottom: 0.035, // relative to height
  },

  qr: {
    maxWidth: 0.74,        // relative to canvas WIDTH
    maxHeight: 0.78,       // relative to middle zone height
    minSize: 260,          // pixels

    safeMarginX: 0.08,     // relative to canvas WIDTH
    safeMarginY: 0.05,     // relative to middle zone height

    backgroundScale: 1.08, // multiplier
  },
} as const;
