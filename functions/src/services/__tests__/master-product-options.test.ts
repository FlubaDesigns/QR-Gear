import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
import { QRG_BLANK_CATEGORIES, qrgProductSchema } from '../../../../shared/masterCatalog';
const m = vi.hoisted(() => ({ db: null as any, files: vi.fn(), product: vi.fn() }));
vi.mock('../../core', async () => ({ get db() { return m.db; }, ...(await import('../../../../shared/placements')) }));
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../master-catalog', () => ({ MASTER_CATALOG_COLLECTION: 'master_catalog' }));
vi.mock('../printify', () => ({ printifyClient: { isConfigured: false } }));
vi.mock('../printful', () => ({ printfulClient: { getPrintfiles: m.files, getProduct: m.product } }));
import { register } from '../../routes/master-catalog';
const app = express(); register(app);
let store: Map<string, any>;
beforeEach(() => {
  vi.resetAllMocks();
  const fixture = database({ 'master_catalog/qrg_13101': { printfulProductId: 864, qrgCategory: 'Hats', qrgVariants: {
    '0001': { colorLabel: 'Black', sizeLabel: 'One size', providerVariants: { printful: { productId: 864, variantId: 1 } } },
  } } });
  m.db = fixture.db; store = fixture.store;
  m.product.mockResolvedValue({ product: { id: 864, techniques: [{ key: 'EMBROIDERY', is_default: true }, { key: 'DTFILM', is_default: false }] },
    variants: [{ id: 1, color: 'Black', size: 'One size', in_stock: true }, { id: 2, color: 'Royal', size: 'One size', in_stock: false }] });
  m.files.mockImplementation(async (_id, technique) => ({ printfiles: [{ printfile_id: 9, width: 1500, height: 600, dpi: 300 }],
    variant_printfiles: [1,2].map(variant_id => ({ variant_id, placements: { [technique ? 'front_dtf_hat' : 'embroidery_front']: 9 } })) }));
});
describe('Admin product options from the QRG master', () => {
  it('uses assigned category identities for hats and tees without changing ranges', () => {
    expect(qrgProductSchema('qrg_13166')).toMatchObject({ category: 'Hats', schemaType: 'hat', canonicalProfilePath: 'layout_profiles/apparel/hats' });
    expect(qrgProductSchema('qrg_11101')).toMatchObject({ category: 'T-Shirts', schemaType: 'tshirt' });
    expect(QRG_BLANK_CATEGORIES.find(c => c.name === 'Hats')?.rangeStart).toBe(13101);
  });
  it('forwards the advertised technique, refreshes master variants, and returns only available cap options', async () => {
    const result = await request(app).get('/admin/master-catalog/products/qrg_13101/options?provider=printful&refreshPrintSpecs=true');
    expect(result.status).toBe(200);
    expect(m.files.mock.calls).toEqual([[864, undefined], [864, 'DTFILM']]);
    expect(result.body).toMatchObject({ schemaType: 'hat', layoutSource: 'qrg_verified_printfiles',
      provider: { printfulProductId: '864' }, availableSizes: [{ label: 'One Size' }], availableColors: [{ name: 'Black' }],
      printLocations: [{ id: 'front', providerPlacementId: 'front_dtf_hat', methods: [{ method: 'dtf', technique: 'DTFILM', dimensions: { widthIn: 5, heightIn: 2 } }] }] });
    expect(store.get('master_catalog/qrg_13101').qrgPrintSpecs.printful).toMatchObject({ version: 2, productId: 864, technique: 'DTFILM' });
    await request(app).get('/admin/master-catalog/products/qrg_13101/options?provider=printful');
    expect(m.files).toHaveBeenCalledTimes(2);
  });
  it('fails visibly for an embroidery-only product without inventing front geometry', async () => {
    m.product.mockResolvedValue({ product: { id: 864, techniques: [{ key: 'EMBROIDERY', is_default: true }] } });
    const result = await request(app).get('/admin/master-catalog/products/qrg_13101/options?provider=printful');
    expect(result.status).toBe(500); expect(result.body.error).toContain('no compatible placement');
    expect(store.get('master_catalog/qrg_13101').qrgPrintSpecs).toBeUndefined();
  });
});
