import { describe, expect, it } from 'vitest';
import { buildPacketMockupRequest, packetMockupSourceId } from '../../../../shared/builderSnapshot';

const packet = (artwork: string) => ({
  builderSnapshot: {
    graphics: { content: { graphicLayoutMode: 'zone' } },
    qrConfig: { selectedColor: { name: 'Black', hex: '#000000' } },
    metadata: { selectedProductDocId: 'qrg_11111' },
    layoutConfig: { selectedPlacements: ['front'], providerLayouts: {
      front: { provider: 'printful', providerPlacementId: 'front', dimensions: { widthPx: 1800, heightPx: 2400, dpi: 150 } },
    } },
  },
  placementGraphicUrls: { front: artwork },
  compositeUrl: 'wrong-legacy-art', artworkUrl: 'wrong-generic-art',
});
const master = { qrgPrintSpecs: { printful: { locations: [{ id: 'front', provider: 'printful', providerPlacementId: 'front', dimensions: { widthPx: 1800, heightPx: 2400, dpi: 150 }, verifiedVariantIds: [100,200] }] } }, qrgVariants: {
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
  it('resolves a legacy DTG front name only for the same verified physical print area', () => {
    const legacy = packet('saved-front.png');
    const layout = legacy.builderSnapshot.layoutConfig.providerLayouts.front;
    layout.providerPlacementId = 'front_large';
    layout.dimensions = {widthPx:3600,heightPx:4800,dpi:300};
    expect(buildPacketMockupRequest(legacy,master,'front','Red').printArea).toEqual({width:3600,height:4800,placement:'front'});
    expect(layout.providerPlacementId).toBe('front_large');
    for (const dimensions of [{widthPx:4200,heightPx:5400,dpi:300}, {widthPx:1200,heightPx:1600,dpi:100}]) {
      layout.dimensions=dimensions;
      expect(() => buildPacketMockupRequest(legacy,master,'front','Red')).toThrow('verified Printful');
    }
    layout.dimensions={widthPx:3600,heightPx:4800,dpi:300};
    for (const providerPlacementId of ['back','default','front_dtf','front_dtf_hat']) {
      layout.providerPlacementId=providerPlacementId;
      expect(() => buildPacketMockupRequest(legacy,master,'front','Red')).toThrow();
    }
    layout.providerPlacementId='front_large';
    const unverified=structuredClone(master);
    unverified.qrgPrintSpecs.printful.locations[0].verifiedVariantIds=[100];
    expect(() => buildPacketMockupRequest(legacy,unverified,'front','Red')).toThrow('verified Printful');
    Object.assign(layout,{technique:'DTFILM'});
    expect(() => buildPacketMockupRequest(legacy,master,'front','Red')).toThrow('verified Printful');
    Object.assign(layout,{technique:undefined,printfileIds:{'200':999}});
    expect(() => buildPacketMockupRequest(legacy,master,'front','Red')).toThrow('verified Printful');
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
