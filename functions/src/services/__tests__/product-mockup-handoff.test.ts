import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const m = vi.hoisted(() => ({ rows: {} as Record<string, any>, generate: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (collection: string) => ({ doc: (id: string) => ({ get: async () => ({ exists: !!m.rows[collection]?.[id], data: () => m.rows[collection]?.[id] }) }) }) } }));
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../services/printful', () => ({}));
vi.mock('../../services/printify', () => ({}));
vi.mock('../../services/storage-helpers', () => ({}));
vi.mock('../../services/pricing', () => ({}));
vi.mock('../../services/mockup-generator', () => ({ generateMockupFromPrintful: m.generate }));
vi.mock('../../services/email', () => ({}));
vi.mock('../../services/composite-image', () => ({}));
import { register } from '../../routes/pp-builder';
const app = express(); app.use(express.json()); register(app);
beforeEach(() => {
  m.generate.mockReset().mockResolvedValue({ mockupUrl: 'returned-navy-back', lifestyleMockupUrl: 'returned-lifestyle', fromCache: false });
  m.rows = {
    productPackets: { saved: { placementGraphicUrls: { front: 'front-art', back: 'back-art' }, builderSnapshot: {
      graphics: { content: { graphicLayoutMode: 'zone', qrSizePercent: 70 } },
      qrConfig: { selectedColor: { name: 'Navy', hex: '#1F2E5C' } },
      metadata: { selectedProductDocId: 'qrg_11111', fulfillmentProvider: 'printful' },
      layoutConfig: { selectedPlacements: ['front','back'], providerLayouts: { back: { provider: 'printful', providerPlacementId: 'back', dimensions: { widthPx: 3600, heightPx: 4800 } } } },
    } } },
    master_catalog: { qrg_11111: { qrgVariants: { '0403': { colorLabel: 'Navy', providerVariants: { printful: { productId: '71', variantId: '123' } } } } } },
  };
});
describe('Saved build to provider handoff', () => {
  it('uses the saved placement artwork and QRG Navy mapping, ignoring conflicting client fields', async () => {
    const response = await request(app).post('/admin/mockup/priority').send({ packetId: 'saved', placement: 'back', colorName: 'Black', artworkUrl: 'wrong', blueprintId: 999 });
    expect(response.status).toBe(200);
    expect(m.generate).toHaveBeenCalledWith(expect.objectContaining({ blueprintId: 71, colorName: 'Navy', placement: 'back', artworkUrl: 'back-art', printfulVariantId: 123, printArea: { width: 3600, height: 4800, placement: 'back' } }));
    expect(response.body.lifestyleMockupUrl).toBe('returned-lifestyle');
  });
  it('rejects a missing Navy variant without substituting a different color', async () => {
    m.rows.master_catalog.qrg_11111.qrgVariants['0403'].colorLabel = 'Black';
    const response = await request(app).post('/admin/mockup/priority').send({ packetId: 'saved', placement: 'back' });
    expect(response.status).toBe(502); expect(m.generate).not.toHaveBeenCalled(); expect(response.body.error).toContain('no Printful variant for Navy');
  });
  it('does not substitute primary artwork when the selected placement file is missing', async () => {
    delete m.rows.productPackets.saved.placementGraphicUrls.back;
    const response = await request(app).post('/admin/mockup/priority').send({ packetId: 'saved', placement: 'back' });
    expect(response.status).toBe(502); expect(m.generate).not.toHaveBeenCalled();
  });
  it('returns provider failure rather than claiming the task is in progress', async () => {
    m.generate.mockRejectedValue(new Error('Printful API error: 401'));
    const response = await request(app).post('/admin/mockup/priority').send({ packetId: 'saved', placement: 'back' });
    expect(response.status).toBe(502); expect(response.body.error).toBe('Printful API error: 401'); expect(response.body.success).toBe(false);
  });
});
