import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
import { parseGrfId } from '../../../../shared/GRF_engine';
const m = vi.hoisted(() => ({ db: null as any, composition: vi.fn() }));
vi.mock('../../core', () => ({ get db() { return m.db; }, admin: {} }));
vi.mock('../assembly-store', () => ({ validatePacketComposition: m.composition }));
import { printfulClient, PrintfulApiError } from '../printful';
import { fulfillOrder, syncFulfillment } from '../order-fulfillment';
import { prepareCartOrder, finalizeCartPayment } from '../order-service';
let store: Map<string, any>;
const grfId = 'GRF-11442-000001';
const cart = { userId: 'buyer', quantity: 2, price: '0.01', customization: { productId: 'instance', productSize: 'M', productColor: 'Navy', printifyVariantId: 999, productName: 'Untrusted name' } };
const layout = { provider: 'printful', providerPlacementId: 'back', dimensions: { widthPx: 3600, heightPx: 4800, dpi: 300 } };
const insideLayout={provider:'printful',providerPlacementId:'label_inside',dimensions:{widthPx:900,heightPx:900,dpi:300}};
const insideId='GRF-11442-000002';
const payment = (id: string, extra = {}) => ({ id: 'cs_test', metadata: { source: 'direct_cart', orderId: id, userId: 'buyer' }, payment_status: 'paid', amount_total: 6800, currency: 'usd', payment_intent: 'pi_test',
  customer_details: { email: 'buyer@example.test', name: 'Test Buyer' }, shipping_details: { name: 'Test Buyer', address: { line1: '1 Test St', city: 'Test City', state: 'CA', postal_code: '90001', country: 'US' } }, ...extra } as any);
const getOrder = vi.spyOn(printfulClient, 'getOrder'), createOrder = vi.spyOn(printfulClient, 'createOrder'), confirmOrder = vi.spyOn(printfulClient, 'confirmOrder');
const getProduct = vi.spyOn(printfulClient, 'getProduct');
beforeEach(() => {
  vi.stubEnv('QRGEAR_ENVIRONMENT', 'production'); vi.stubEnv('GCLOUD_PROJECT', 'qrgear-c1ffd'); vi.resetAllMocks();
  const f = database({
    'cartItems/cart': cart, 'settings/admin': { defaultFulfillmentProvider: 'printify' },
    'testSettings/pricing': { sizeUpcharges: { M: 4 } },
    'admin_catalog_instances/instance': { currentPacketId: 'packet', enabledSizes: ['M'], enabledColors: ['Navy'], resolved: { title: 'Saved Navy Shirt', pricing: { customerPrice: 30 } } },
    'productPackets/packet': { assemblyId: 'ASM-000001', fulfillmentProvider: 'printful', placementGrfIds: { back: grfId, label_inside:insideId }, placementGraphicUrls: { back: 'https://files.example/art.png', label_inside:'https://files.example/label.png' },
      builderSnapshot: { graphics: { content: { graphicLayoutMode: 'zone', qrSizePercent: 70 } }, qrConfig: { selectedColor: { name: 'Navy' } },
        metadata: { selectedProductDocId: 'qrg_11111', fulfillmentProvider: 'printful' }, layoutConfig: { selectedPlacements: ['back','label_inside'], providerLayouts: { back: layout, label_inside:insideLayout } } } },
    [`grf_assets/${insideId}`]:{...parseGrfId(insideId),grfId:insideId,publicUrl:'https://files.example/label.png'},
    [`grf_assets/${grfId}`]: { ...parseGrfId(grfId), grfId, publicUrl: 'https://files.example/art.png' },
    'master_catalog/qrg_11111': { qrgVariants: { '0403': { colorLabel: 'Navy', sizeLabel: 'M', providerVariants: { printful: { productId: 71, variantId: 123 } } } }, qrgPrintSpecs: { printful: { locations: [{ ...layout, id: 'back', verifiedVariantIds: [123] },{...insideLayout,id:'label_inside',verifiedVariantIds:[123]}] } } },
  }); m.db = f.db; store = f.store;
  getOrder.mockRejectedValue(new PrintfulApiError(404, 'Not found'));
  getProduct.mockResolvedValue({ product: { files: [{ type: 'back' },{type:'label_inside'}] }, variants: [{ id: 123, in_stock: true }] } as any);
  createOrder.mockImplementation(async body => ({ id: 77, external_id: body.external_id, status: 'draft' }));
  confirmOrder.mockImplementation(async () => ({ id: 77, external_id: [...store.keys()].find(k => k.startsWith('orders/'))!.split('/')[1], status: 'pending' }));
});
afterEach(() => vi.unstubAllEnvs());
async function paidOrder() { const prepared = await prepareCartOrder('buyer'); await finalizeCartPayment(payment(prepared.orderId)); return prepared; }
describe('Store sale to Printful production', () => {
  it('freezes real price, exact variant and artwork, pays and submits once despite webhook replay/cart edits', async () => {
    const { orderId, items, amount } = await prepareCartOrder('buyer');
    expect(amount).toBe(6800); expect(items[0].productTitle).toBe('Saved Navy Shirt');
    expect(items[0].fulfillment).toMatchObject({ provider: 'printful', variantId: 123 });
    expect(m.composition).toHaveBeenCalledWith(m.db, 'packet', expect.anything());
    store.get('cartItems/cart').quantity = 9; store.get('productPackets/packet').placementGraphicUrls.back = 'https://files.example/edited.png';
    await finalizeCartPayment(payment(orderId)); await fulfillOrder(orderId);
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ external_id: orderId, items: [{ variant_id: 123, quantity: 2,
      files: [{ type: 'back', url: 'https://files.example/art.png', position: { area_width: 3600, area_height: 4800, width: 3600, height: 4800, top: 0, left: 0 } },{type:'label_inside',url:'https://files.example/label.png',position:{area_width:900,area_height:900,width:900,height:900,top:0,left:0}}] }] }));
    expect(store.get('orders/' + orderId)).toMatchObject({ paymentStatus: 'paid', fulfillmentState: 'submitted', providerOrderId: '77', status: 'routed' });
    await finalizeCartPayment(payment(orderId)); await fulfillOrder(orderId);
    expect(createOrder).toHaveBeenCalledTimes(1); expect(confirmOrder).toHaveBeenCalledTimes(1); expect(store.get('cartItems/cart').quantity).toBe(9);
  });
  it.each([{ payment_status: 'unpaid' }, { amount_total: 1 }, { currency: 'eur' }, { metadata: { source: 'direct_cart', userId: 'other', orderId: 'auto-1' } }])('rejects bad payment %j', async overrides => {
    const { orderId } = await prepareCartOrder('buyer'); await expect(finalizeCartPayment(payment(orderId, overrides))).rejects.toThrow();
    await expect(fulfillOrder(orderId)).rejects.toThrow('verified payment'); expect(createOrder).not.toHaveBeenCalled();
  });
  it('clears purchased rows and preserves new cart rows', async () => {
    const { orderId } = await prepareCartOrder('buyer'); store.set('cartItems/later', { ...cart });
    await finalizeCartPayment(payment(orderId)); expect(store.has('cartItems/cart')).toBe(false); expect(store.has('cartItems/later')).toBe(true);
  });
  it('recovers a draft after confirmation failure without a second create', async () => {
    const { orderId } = await paidOrder(); confirmOrder.mockRejectedValueOnce(new Error('temporary outage'));
    await expect(fulfillOrder(orderId)).rejects.toThrow('temporary outage');
    expect(store.get('orders/' + orderId)).toMatchObject({ fulfillmentState: 'failed', fulfillmentError: 'temporary outage', providerOrderId: '77' });
    getOrder.mockResolvedValue({ id: 77, external_id: orderId, status: 'draft' });
    await fulfillOrder(orderId); expect(createOrder).toHaveBeenCalledTimes(1); expect(confirmOrder).toHaveBeenCalledTimes(2);
  });
  it('recovers a timed-out create by external ID', async () => {
    const { orderId } = await paidOrder(); createOrder.mockRejectedValueOnce(new Error('timeout after create'));
    await expect(fulfillOrder(orderId)).rejects.toThrow('timeout'); getOrder.mockResolvedValue({ id: 77, external_id: orderId, status: 'pending' });
    await fulfillOrder(orderId); expect(createOrder).toHaveBeenCalledTimes(1); expect(confirmOrder).not.toHaveBeenCalled();
  });
  it('does not create after auth/network lookup failure or during an active lease', async () => {
    const { orderId } = await paidOrder(); getOrder.mockRejectedValue(new PrintfulApiError(401, 'Unauthorized'));
    await expect(fulfillOrder(orderId)).rejects.toThrow('Unauthorized'); expect(createOrder).not.toHaveBeenCalled();
    store.get('orders/' + orderId).fulfillmentLeaseUntil = Date.now() + 10000; await expect(fulfillOrder(orderId)).rejects.toThrow('already in progress');
  });
  it('never calls a commerce provider in sandbox', async () => {
    const { orderId } = await paidOrder(); vi.stubEnv('QRGEAR_ENVIRONMENT', 'sandbox');
    await expect(fulfillOrder(orderId)).rejects.toThrow('disabled'); expect(getOrder).not.toHaveBeenCalled();
  });
  it('syncs shipments and status to the same order', async () => {
    const { orderId } = await paidOrder(); await fulfillOrder(orderId);
    getOrder.mockResolvedValue({ id: 77, external_id: orderId, status: 'fulfilled', shipments: [{ carrier: 'USPS', tracking_number: 'track-1', tracking_url: 'https://tracking.example/1' }] });
    await syncFulfillment(orderId); expect(store.get('orders/' + orderId)).toMatchObject({ status: 'shipped', trackingNumber: 'track-1', trackingUrl: 'https://tracking.example/1' });
  });
  it.each(['price', 'variant', 'artwork', 'layout', 'inside-label', 'disabled-color', 'provider', 'composition'])('blocks invalid %s before checkout', async issue => {
    if (issue === 'inside-label') store.get('productPackets/packet').builderSnapshot.layoutConfig.selectedPlacements=['back'];
    if (issue === 'price') store.get('admin_catalog_instances/instance').resolved.pricing = {};
    if (issue === 'variant') store.get('master_catalog/qrg_11111').qrgVariants = {};
    if (issue === 'artwork') store.get('productPackets/packet').placementGraphicUrls = {};
    if (issue === 'layout') store.get('master_catalog/qrg_11111').qrgPrintSpecs.printful.locations = [];
    if (issue === 'disabled-color') store.get('admin_catalog_instances/instance').enabledColors = ['Black'];
    if (issue === 'provider') store.get('productPackets/packet').builderSnapshot.metadata.fulfillmentProvider = 'printify';
    if (issue === 'composition') m.composition.mockRejectedValue(new Error('Assembly is not linked'));
    await expect(prepareCartOrder('buyer')).rejects.toThrow(); expect([...store.keys()].some(key => key.startsWith('orders/'))).toBe(false); expect(createOrder).not.toHaveBeenCalled();
  });
});
