import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buildWorkingSnapshot } from '../../../../shared/builderSnapshot';
const saved = vi.hoisted(() => ({ packet: null as any }));
vi.mock('../../core', () => ({
  db: { collection: () => ({ add: async (data: any) => { saved.packet = data; return { id: 'packet' }; } }) },
  admin: { firestore: { FieldValue: { serverTimestamp: () => 'now' } } },
  QR_GEAR_BRANDED_TAG_URL: 'https://storage/label.png',
  stripUndef: (x: any) => x, sanitizeStyleForFirestore: (x: any) => x,
}));
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../services/printful', () => ({}));
vi.mock('../../services/printify', () => ({}));
vi.mock('../../services/storage-helpers', () => ({}));
vi.mock('../../services/pricing', () => ({ priceNewPacket: async (_db: any, value: any) => { const { requireBuilderSnapshot } = await import('../../../../shared/builderSnapshot'); return { builderSnapshot: requireBuilderSnapshot(value), pricing: { customerPrice: 21, subtotal: 15 }, placementGraphicUrls: {} }; } }));
vi.mock('../../services/mockup-generator', () => ({}));
vi.mock('../../services/email', () => ({}));
vi.mock('../../services/composite-image', () => ({}));
import { register } from '../../routes/pp-pricing-packets';
const app = express(); app.use(express.json()); register(app);
function snapshot() {
  return buildWorkingSnapshot({ content: { graphicLayoutMode: 'freeform', qrSizePercent: 40, qrPositionX: 20, qrPositionY: 80, headerStyle: { enabled: true, text: 'Saved words' } },
    selectedProduct: { docId: 'qrg_11001' }, selectedPlacements: ['back'], placementMethods: { back: 'dtf' }, placementConfig: {}, placementSizes: {},
    providerLayout: { dimensions: { widthPx: 3600, heightPx: 4200 } }, qrProductState: 'qr_basics',
  }, { selectedRole: 'internal', selectedStore: null, selectedChannel: null, selectedCollection: null });
}
describe('production builder packet POST', () => {
  it('persists the canonical snapshot and projects it over conflicting top-level layout values', async () => {
    const res = await request(app).post('/admin/packets').send({ builderSnapshot: snapshot(), graphicLayoutMode: 'zone', qrPositionX: 99, selectedPlacements: ['front'], compositeUrl: '', pricing: {customerPrice: 1} });
    expect(res.status).toBe(200);
    expect(saved.packet).toMatchObject({ graphicLayoutMode: 'freeform', qrPositionX: 20, qrPositionY: 80, qrSizePercent: 40, placements: ['back'], placementMethods: { back: 'dtf' }, providerLayout: { dimensions: { widthPx: 3600, heightPx: 4200 } } });
    expect(saved.packet.pricing.customerPrice).toBe(21);expect(res.body.pricing.customerPrice).toBe(21);
    expect(saved.packet.builderSnapshot.graphics.content.headerStyle.text).toBe('Saved words');
  });
  it('rejects an incomplete build snapshot before creating a packet', async () => {
    saved.packet = null;
    const res = await request(app).post('/admin/packets').send({ builderSnapshot: { content: {} } });
    expect(res.status).toBe(400); expect(saved.packet).toBeNull();
  });
});
