import { describe, expect, it } from 'vitest';
import { getGraphicLayout } from '@/features/shared/graphics/graphicLayout';

describe('QR-anchored zone spacing', () => {
  it.each([1200, 3600])('keeps top art and a large CTA outside the visible QR at width %i', (width) => {
    const lineHeight = Math.round(29 * (width / 1200) * 2.5) * 1.3;
    const layout = getGraphicLayout({ canvasWidth: width, canvasHeight: width * 4 / 3,
      headerActive: true, footerActive: true, subBottomActive: true,
      subBottomLineHeight: lineHeight, qrSizePercent: 70 });
    const { header, subBottom, footer } = layout.zones;
    const qr = layout.qr.background;
    expect(header.y + header.height).toBeLessThan(qr.y);
    expect(subBottom.height).toBeGreaterThanOrEqual(lineHeight);
    expect(subBottom.y + subBottom.height / 2 - lineHeight / 2).toBeGreaterThan(qr.y + qr.height);
    expect(footer.y).toBeGreaterThan(subBottom.y + subBottom.height);
    expect(footer.height).toBeGreaterThan(0);
  });
  it('reserves no CTA strip when disabled', () => {
    const layout = getGraphicLayout({ canvasWidth: 3600, canvasHeight: 4800,
      headerActive: true, footerActive: true, subBottomActive: false,
      subBottomLineHeight: 300, qrSizePercent: 70 });
    expect(layout.zones.subBottom.height).toBe(0);
  });
});
