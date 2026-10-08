import { describe, expect, it } from 'vitest';
import { buildPacketMockupRequest, packetMockupSourceId } from '../../../../shared/builderSnapshot';

const packet = (artwork: string) => ({
  builderSnapshot: {
    graphics: { content: { graphicLayoutMode: 'zone' } },
    qrConfig: { selectedColor: { name: 'Black', hex: '#000000' } },
    metadata: { selectedProductDocId: 'qrg_11111' },
    layoutConfig: { selectedPlacements: ['front'], providerLayouts: {
      front: { provider: 'printful', providerPlacementId: 'front', dimensions: { widthPx: 1800, heightPx: 2400 } },
    } },
  },
  placementGraphicUrls: { front: artwork },
  compositeUrl: 'wrong-legacy-art', artworkUrl: 'wrong-generic-art',
});
const master = { qrgVariants: {
  black: { colorLabel: 'Black', providerVariants: { printful: { productId: 71, variantId: 100 } } },
  red: { colorLabel: 'Red', providerVariants: { printful: { productId: 71, variantId: 200 } } },
} };

describe('saved-design color mockups', () => {
  it('keeps separate front graphics for two products sharing the same shirt and color', () => {
    const army = buildPacketMockupRequest(packet('army-front.png'), master, 'front', 'Red');
    const coast = buildPacketMockupRequest(packet('coast-front.png'), master, 'front', 'Red');
    expect(army.artworkUrl).toBe('army-front.png');
    expect(coast.artworkUrl).toBe('coast-front.png');
    expect(army.printfulVariantId).toBe(200);
    expect(army.printArea).toEqual({ width: 1800, height: 2400, placement: 'front' });
  });
  it('preserves builder default requests and resolves only canonical QRG blanks', () => {
    expect(buildPacketMockupRequest(packet('art.png'), master, 'front').printfulVariantId).toBe(100);
    expect(packetMockupSourceId(packet('art.png'))).toBe('qrg_11111');
  });
  it('rejects missing front artwork instead of using unrelated legacy artwork', () => {
    expect(() => buildPacketMockupRequest({ ...packet('art.png'), placementGraphicUrls: {} }, master, 'front', 'Red')).toThrow('no generated print artwork');
  });
  it('rejects unknown colors, placements and missing provider dimensions', () => {
    expect(() => buildPacketMockupRequest(packet('art.png'), master, 'front', 'Heather Red')).toThrow('no Printful variant');
    expect(() => buildPacketMockupRequest(packet('art.png'), master, 'back', 'Red')).toThrow('Placement');
    const invalid = packet('art.png');
    invalid.builderSnapshot.layoutConfig.providerLayouts.front.dimensions.widthPx = 0;
    expect(() => buildPacketMockupRequest(invalid, master, 'front', 'Red')).toThrow('print-area dimensions');
  });
});
