import { describe, expect, it } from 'vitest';
import { printArtworkFrame } from '@shared/printSizing';
import { projectQrgPrintfiles, qrgPrintfulProductId } from '../../../../functions/src/services/qrg-print-specs';

describe('Physical print sizing', () => {
  it('centers a 10-inch design within a 12-inch canvas, preserving the full file', () => {
    const frame = printArtworkFrame({ dimensions: { widthPx: 3600, heightPx: 4800, dpi: 300 } });
    expect(frame).toMatchObject({ width: 3600, height: 4800, artworkWidth: 3000, artworkHeight: 4000, left: 300, top: 400, artworkWidthIn: 10 });
    expect(frame.artworkHeightIn).toBeCloseTo(13.3333333);
  });
  it('uses printer DPI instead of assuming 300 and respects a smaller safe area', () => {
    const frame = printArtworkFrame({ dimensions: { widthPx: 1800, heightPx: 2400, dpi: 150 }, safeArea: { widthPx: 1500, heightPx: 2000 } }, 'large');
    expect(frame.artworkWidthIn).toBe(10); expect(frame.left).toBe(150);
    expect(printArtworkFrame({ dimensions: { widthPx: 1200, heightPx: 1600 } }).widthIn).toBeNull();
    expect(() => printArtworkFrame({})).toThrow('missing');
  });
});
const product = { providerMappings: { printful: { productId: 71 } }, qrgVariants: {
  s: { providerVariants: { printful: { productId: 71, variantId: 1 } } },
  l: { providerVariants: { printful: { productId: 71, variantId: 2 } } },
} };
const response = () => ({ printfiles: [{ printfile_id: 10, width: 1800, height: 2400, dpi: 150 }],
  variant_printfiles: [{ variant_id: 1, placements: { front: 10 } }, { variant_id: 2, placements: { front: 10 } }] });
describe('QRG printer import', () => {
  it('joins variant mappings to actual printfiles and retains physical dimensions', () => {
    expect(qrgPrintfulProductId(product)).toBe(71);
    expect(projectQrgPrintfiles(product, response())[0]).toMatchObject({ dimensions: { widthIn: 12, heightIn: 16, dpi: 150 }, verifiedVariantIds: [1,2] });
  });
  it('does not certify a missing size or reuse a large-size print area for a smaller template', () => {
    const missing = response(); missing.variant_printfiles.pop();
    expect(() => projectQrgPrintfiles(product, missing)).toThrow('all QRG variants');
    const smaller = response(); smaller.printfiles.push({ printfile_id: 11, width: 1500, height: 1800, dpi: 150 });
    smaller.variant_printfiles[0].placements.front = 11;
    expect(() => projectQrgPrintfiles(product, smaller)).toThrow('shared verified print area');
  });
});
