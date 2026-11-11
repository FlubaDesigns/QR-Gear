import { describe, expect, it, vi } from 'vitest';
import { printArtworkFrame } from '@shared/printSizing';
import { projectQrgPrintfiles, qrgPrintfulProductId, resolveQrgPrintSpecs } from '../../../../functions/src/services/qrg-print-specs';
import { normalizePlacement, detectPrintMethod, toProviderPlacement } from '@shared/placements';
import { catalogSaleVariants } from '../../../../functions/src/services/catalog-sale-variants';

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

describe('Printed caps with an embroidery default', () => {
  const capFiles = (placement: string) => ({ printfiles: [{ printfile_id: 10, width: 1500, height: 600, dpi: 300 }],
    variant_printfiles: [1, 2].map(variant_id => ({ variant_id, placements: { [placement]: 10 } })) });
  it('requests the advertised DTF technique and preserves its exact supplier placement', async () => {
    const getFiles = vi.fn(async (_id, technique) => capFiles(technique ? 'front_dtf_hat' : 'embroidery_front_large'));
    const getProduct = vi.fn(async () => ({ product: { id: 71, techniques: [{key:'EMBROIDERY',is_default:true},{key:'DTFILM',is_default:false}] } }));
    const update = vi.fn(), fresh = structuredClone(product);
    const locations = await resolveQrgPrintSpecs(fresh, {update}, getFiles, false, getProduct);
    expect(getFiles.mock.calls).toEqual([[71], [71, 'DTFILM']]);
    expect(locations[0]).toMatchObject({ id:'front', providerPlacementId:'front_dtf_hat', technique:'DTFILM', dimensions:{widthIn:5,heightIn:2} });
    expect(update).toHaveBeenCalledOnce();
    expect(await resolveQrgPrintSpecs(fresh, {update}, getFiles, false, getProduct)).toEqual(locations);
    expect(getFiles).toHaveBeenCalledTimes(2);
    expect(normalizePlacement('printful','front_dtf_hat')).toBe('front');
    expect(detectPrintMethod('front_dtf_hat')).toBe('dtf');
    expect(toProviderPlacement('printful','front',['front_dtf_hat'],'dtf')).toBe('front_dtf_hat');
  });
  it('does not guess an unadvertised technique or persist incomplete variant coverage', async () => {
    const update = vi.fn();
    await expect(resolveQrgPrintSpecs(structuredClone(product),{update},async()=>capFiles('embroidery_front_large'),false,
      async()=>({product:{id:71,techniques:[{key:'EMBROIDERY',is_default:true}]}}))).rejects.toThrow('shared verified');
    await expect(resolveQrgPrintSpecs(structuredClone(product),{update},async(_id,technique)=> {
      const files=capFiles(technique?'front_dtf_hat':'embroidery_front_large');
      if(technique) files.variant_printfiles.pop();
      return files;
    },false,async()=>({product:{id:71,techniques:[{key:'DTFILM',is_default:false}]}}))).rejects.toThrow('all QRG variants');
    expect(update).not.toHaveBeenCalled();
  });
  it('keeps known out-of-stock supplier variants out of selectable offers', () => {
    const master={qrgVariants:{black:{sizeLabel:'One size',colorLabel:'Black',providerVariants:{printful:{productId:864,variantId:22663,inStock:true}}},
      royal:{sizeLabel:'One size',colorLabel:'Royal',providerVariants:{printful:{productId:864,variantId:22668,inStock:false}}}}};
    expect(catalogSaleVariants({enabledColors:['Black','Royal'],enabledSizes:['One size']},master,'printful').map(v=>v.color)).toEqual(['Black']);
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

it('keeps method-specific geometry and upgrades an old print cache', async () => {
  const data = response(); data.printfiles.push({ printfile_id: 11, width: 1500, height: 600, dpi: 300 });
  for (const row of data.variant_printfiles) (row.placements as any).front_dtf_hat = 11;
  const fresh: any = structuredClone(product);
  fresh.qrgPrintSpecs = { printful: { productId: 71, variantIds: [1,2], locations: [{ id: 'front', dimensions: { widthPx: 999 } }] } };
  const fetch = vi.fn(async () => data), update = vi.fn();
  const [location] = await resolveQrgPrintSpecs(fresh, { update }, fetch);
  expect(location.methods).toMatchObject([
    { method: 'dtg', providerName: 'front', dimensions: { widthIn: 12, heightIn: 16 } },
    { method: 'dtf', providerName: 'front_dtf_hat', dimensions: { widthIn: 5, heightIn: 2 }, printfileIds: { '1': 11, '2': 11 } },
  ]);
  expect(fetch).toHaveBeenCalledOnce(); expect(update).toHaveBeenCalledOnce();
});
