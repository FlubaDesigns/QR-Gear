import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockFirestoreData: Record<string, Record<string, any>> = {};
let batchOps: Array<{ type: string; collection: string; docId: string; data: any }> = [];
let docIdCounter = 0;

function resetMockDb() {
  Object.keys(mockFirestoreData).forEach(k => delete mockFirestoreData[k]);
  batchOps = [];
  docIdCounter = 0;
}

function seedDoc(collection: string, id: string, data: any) {
  if (!mockFirestoreData[collection]) mockFirestoreData[collection] = {};
  mockFirestoreData[collection][id] = data;
}

function getAllDocs(collection: string): Array<{ id: string; data: any }> {
  return Object.entries(mockFirestoreData[collection] || {}).map(([id, data]) => ({ id, data }));
}

const makeMockDoc = (collection: string, docId: string) => ({
  _path: `${collection}/${docId}`,
  id: docId,
  get: vi.fn(async () => {
    const data = mockFirestoreData[collection]?.[docId];
    return {
      exists: !!data,
      id: docId,
      data: () => data,
      ref: makeMockDoc(collection, docId),
    };
  }),
  update: vi.fn(async (updateData: any) => {
    if (mockFirestoreData[collection]?.[docId]) {
      mockFirestoreData[collection][docId] = { ...mockFirestoreData[collection][docId], ...updateData };
    }
  }),
  set: vi.fn(async (data: any) => {
    if (!mockFirestoreData[collection]) mockFirestoreData[collection] = {};
    mockFirestoreData[collection][docId] = data;
  }),
});

const mockCollection = (name: string) => ({
  doc: (id?: string) => {
    const docId = id || `auto_${++docIdCounter}`;
    return makeMockDoc(name, docId);
  },
  add: vi.fn(async (data: any) => {
    const docId = `auto_${++docIdCounter}`;
    if (!mockFirestoreData[name]) mockFirestoreData[name] = {};
    mockFirestoreData[name][docId] = data;
    return { id: docId };
  }),
  where: vi.fn((field: string, _op: string, value: any) => {
    const makeQuery = (filters: Array<{ field: string; value: any }>) => ({
      where: vi.fn((f2: string, _o2: string, v2: any) => {
        return makeQuery([...filters, { field: f2, value: v2 }]);
      }),
      limit: vi.fn((n: number) => ({
        get: vi.fn(async () => {
          const allFilters = filters;
          const docs = Object.entries(mockFirestoreData[name] || {})
            .filter(([_, d]) => allFilters.every(f => d[f.field] === f.value))
            .slice(0, n)
            .map(([id, d]) => ({
              id,
              data: () => d,
              ref: makeMockDoc(name, id),
            }));
          return { empty: docs.length === 0, docs };
        }),
      })),
      get: vi.fn(async () => {
        const allFilters = filters;
        const docs = Object.entries(mockFirestoreData[name] || {})
          .filter(([_, d]) => allFilters.every(f => d[f.field] === f.value))
          .map(([id, d]) => ({ id, data: () => d, ref: makeMockDoc(name, id) }));
        return { empty: docs.length === 0, docs };
      }),
    });
    return makeQuery([{ field, value }]);
  }),
});

vi.mock('../../core', () => ({
  db: {
    collection: (name: string) => mockCollection(name),
    batch: () => {
      const ops: typeof batchOps = [];
      return {
        set: vi.fn((ref: any, data: any) => {
          const [collection, docId] = ref._path.split('/');
          ops.push({ type: 'set', collection, docId, data });
        }),
        update: vi.fn((ref: any, data: any) => {
          const [collection, docId] = ref._path.split('/');
          ops.push({ type: 'update', collection, docId, data });
        }),
        commit: vi.fn(async () => {
          for (const op of ops) {
            if (!mockFirestoreData[op.collection]) mockFirestoreData[op.collection] = {};
            if (op.type === 'set') {
              mockFirestoreData[op.collection][op.docId] = op.data;
            } else if (op.type === 'update') {
              mockFirestoreData[op.collection][op.docId] = {
                ...(mockFirestoreData[op.collection][op.docId] || {}),
                ...op.data,
              };
            }
          }
        }),
      };
    },
  },
  admin: { firestore: { FieldValue: { serverTimestamp: vi.fn() } } },
}));

vi.mock('../../../../shared/surfaces', async () => {
  const actual = await vi.importActual('../../../../shared/surfaces');
  return actual;
});

vi.mock('stripe', () => {
  function MockStripe() {
    return {
      checkout: {
        sessions: {
          create: async (params: any) => ({
            id: 'cs_mock_stripe_session',
            url: 'https://checkout.stripe.com/mock',
            ...params,
          }),
        },
      },
    };
  }
  return { default: MockStripe };
});

async function buildApp(): Promise<express.Express> {
  const app = express();
  app.use(express.json());
  const mod = await import('../../routes/external-sites-public');
  mod.registerExternalSitesPublicRoutes(app);
  return app;
}

function seedStandardFixtures() {
  seedDoc('builderPlacements', 'placement-1', {
    status: 'active',
    builderHostId: 'host-1',
    builderProfileId: 'profile-1',
    surfaceId: 'surface-1',
    pricingPolicyId: 'policy-1',
    revenueSplitId: 'split-1',
    affiliateUserId: 'aff-user-1',
    embedMode: 'builder',
  });
  seedDoc('builderHosts', 'host-1', {
    status: 'active',
    name: 'Test Host',
    storeId: 'store-1',
    ownerUserId: 'host-owner-1',
    allowedDomains: ['testsite.com', '*.partner.io'],
  });
  seedDoc('builderProfiles', 'profile-1', {
    status: 'active',
    name: 'Test Profile',
    permissions: {
      allowHeaderText: true, allowHeaderImage: false,
      allowFooterText: true, allowFooterImage: false,
      allowCenterGraphic: true, allowQrModeSwitch: false,
      allowUpload: false, allowAssetLibrary: true,
      allowProductChange: false, allowVariantChange: true,
      allowSaveDraft: false, allowBuyNow: true,
    },
  });
  seedDoc('surfaces', 'surface-1', {
    title: 'Test T-Shirt',
    description: 'A test t-shirt for integration tests',
    status: 'active',
    retailPrice: 29.99,
    baseCost: 12.00,
    baseCostSource: 'printify',
    sku: 'TSHIRT-001',
    printAreas: [{ key: 'front', label: 'Front', width: 300, height: 400 }],
    images: ['https://example.com/shirt.png'],
    supportsEmbedBuilder: true,
  });
  seedDoc('surfaceVariants', 'variant-1', {
    surfaceId: 'surface-1',
    enabled: true,
    title: 'Black / M',
    size: 'M',
    color: 'Black',
    sku: 'TSHIRT-BLK-M',
  });
  seedDoc('pricingPolicies', 'policy-1', {
    name: 'Standard',
    currency: 'USD',
    platformFeeAmount: 2.00,
  });
  seedDoc('revenueSplits', 'split-1', {
    name: 'Standard Split',
    affiliateSharePercent: 25,
    platformSharePercent: 75,
    requireAffiliate: true,
  });
}

describe('Embed Integration: session → cart → buy → confirm', () => {
  let app: express.Express;

  beforeEach(async () => {
    resetMockDb();
    seedStandardFixtures();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    app = await buildApp();
  });

  it('rejects session creation from wrong domain', async () => {
    const res = await request(app)
      .post('/public/embed/session')
      .set('Origin', 'https://evil.com')
      .send({ builderPlacementId: 'placement-1' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not allowed');
  });

  it('rejects session creation with no Origin/Referer when host has allowedDomains', async () => {
    const res = await request(app)
      .post('/public/embed/session')
      .send({ builderPlacementId: 'placement-1' });

    expect(res.status).toBe(403);
  });

  it('creates session from allowed domain', async () => {
    const res = await request(app)
      .post('/public/embed/session')
      .set('Origin', 'https://testsite.com')
      .send({ builderPlacementId: 'placement-1' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.builderPlacementId).toBe('placement-1');
    expect(res.body.affiliateUserId).toBe('aff-user-1');
    expect(res.body.pricingSnapshot).toBeDefined();
    expect(res.body.pricingSnapshot.baseSalePrice).toBe(29.99);
    expect(res.body.pricingSnapshot.affiliateAmount).toBeGreaterThan(0);
  });

  it('creates session from wildcard-matched subdomain', async () => {
    const res = await request(app)
      .post('/public/embed/session')
      .set('Origin', 'https://shop.partner.io')
      .send({ builderPlacementId: 'placement-1' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });

  it('full flow: session → cart → buy creates attribution + payout', async () => {
    const sessionRes = await request(app)
      .post('/public/embed/session')
      .set('Origin', 'https://testsite.com')
      .send({ builderPlacementId: 'placement-1' });

    expect(sessionRes.status).toBe(200);
    const sessionId = sessionRes.body.id;

    const cartRes = await request(app)
      .post(`/public/embed/session/${sessionId}/cart`)
      .set('Origin', 'https://testsite.com')
      .send({
        surfaceId: 'surface-1',
        variantId: 'variant-1',
        quantity: 2,
        designSelections: { front: { text: 'Hello' } },
      });

    expect(cartRes.status).toBe(200);
    expect(cartRes.body.pricingSnapshot).toBeDefined();
    expect(cartRes.body.quantity).toBe(2);
    expect(cartRes.body.affiliateUserId).toBe('aff-user-1');

    const buyRes = await request(app)
      .post(`/public/embed/session/${sessionId}/buy`)
      .set('Origin', 'https://testsite.com')
      .send({
        surfaceId: 'surface-1',
        variantId: 'variant-1',
        quantity: 2,
        designSelections: { front: { text: 'Hello' } },
        successUrl: 'https://testsite.com/success',
        cancelUrl: 'https://testsite.com/cancel',
      });

    expect(buyRes.status).toBe(200);
    expect(buyRes.body.checkoutUrl).toBeDefined();
    expect(buyRes.body.stripeSessionId).toBe('cs_mock_stripe_session');

    const attributions = getAllDocs('embeddedOrderAttributions');
    expect(attributions.length).toBe(1);
    const attrib = attributions[0].data;
    expect(attrib.stripeCheckoutSessionId).toBe('cs_mock_stripe_session');
    expect(attrib.status).toBe('pending_payment');
    expect(attrib.affiliateUserId).toBe('aff-user-1');
    expect(attrib.builderHostId).toBe('host-1');
    expect(attrib.quantity).toBe(2);

    const payouts = getAllDocs('affiliatePayoutLedger');
    expect(payouts.length).toBe(1);
    const payout = payouts[0].data;
    expect(payout.orderId).toBe('cs_mock_stripe_session');
    expect(payout.affiliateUserId).toBe('aff-user-1');
    expect(payout.status).toBe('pending');
    expect(payout.affiliateAmount).toBeGreaterThan(0);
  });

  it('confirm payout transitions attribution and payout to paid/approved', async () => {
    seedDoc('embeddedOrderAttributions', 'att-1', {
      stripeCheckoutSessionId: 'cs_confirm_test',
      orderItemId: 'item-1',
      affiliateUserId: 'aff-user-1',
      affiliateAmount: 4.00,
      quantity: 1,
      currency: 'USD',
      status: 'pending_payment',
    });
    seedDoc('affiliatePayoutLedger', 'pay-1', {
      orderId: 'cs_confirm_test',
      affiliateUserId: 'aff-user-1',
      affiliateAmount: 4.00,
      status: 'pending',
    });

    const { confirmEmbedOrderPayout } = await import('../order-service');
    await confirmEmbedOrderPayout('cs_confirm_test');

    const attrib = mockFirestoreData['embeddedOrderAttributions']['att-1'];
    expect(attrib.status).toBe('paid');
    expect(attrib.paidAt).toBeDefined();

    const payout = mockFirestoreData['affiliatePayoutLedger']['pay-1'];
    expect(payout.status).toBe('approved');
    expect(payout.approvedAt).toBeDefined();
  });

  it('confirm payout creates legacy backfill for pre-patch attributions', async () => {
    seedDoc('embeddedOrderAttributions', 'att-legacy', {
      stripeCheckoutSessionId: 'cs_legacy_test',
      orderItemId: 'item-legacy',
      affiliateUserId: 'aff-legacy',
      affiliateAmount: 3.00,
      quantity: 1,
      currency: 'USD',
      status: 'pending_payment',
    });

    const { confirmEmbedOrderPayout } = await import('../order-service');
    await confirmEmbedOrderPayout('cs_legacy_test');

    const payouts = getAllDocs('affiliatePayoutLedger');
    const legacyPayout = payouts.find(p => p.data.orderId === 'cs_legacy_test');
    expect(legacyPayout).toBeDefined();
    expect(legacyPayout!.data.status).toBe('approved');
    expect(legacyPayout!.data.legacyBackfill).toBe(true);
    expect(legacyPayout!.data.affiliateUserId).toBe('aff-legacy');
  });

  it('revenue split uses affiliateSharePercent field (schema normalization)', async () => {
    const res = await request(app)
      .post('/public/embed/session')
      .set('Origin', 'https://testsite.com')
      .send({ builderPlacementId: 'placement-1' });

    expect(res.status).toBe(200);
    expect(res.body.pricingSnapshot.affiliatePercent).toBe(25);
    expect(res.body.pricingSnapshot.affiliateAmount).toBeGreaterThan(0);
  });

  it('buy rejects when no affiliate user is resolved', async () => {
    seedDoc('builderPlacements', 'placement-no-aff', {
      status: 'active',
      builderHostId: 'host-noaff',
      surfaceId: 'surface-1',
      pricingPolicyId: 'policy-1',
      embedMode: 'builder',
    });
    seedDoc('builderHosts', 'host-noaff', {
      status: 'active',
      name: 'No Affiliate Host',
    });

    const sessionRes = await request(app)
      .post('/public/embed/session')
      .set('Origin', 'https://anywhere.com')
      .send({ builderPlacementId: 'placement-no-aff' });

    expect(sessionRes.status).toBe(200);
    const sessionId = sessionRes.body.id;
    expect(sessionRes.body.affiliateUserId).toBeFalsy();

    const buyRes = await request(app)
      .post(`/public/embed/session/${sessionId}/buy`)
      .set('Origin', 'https://anywhere.com')
      .send({
        surfaceId: 'surface-1',
        quantity: 1,
      });

    expect(buyRes.status).toBe(422);
    expect(buyRes.body.error).toContain('no affiliate user resolved');

    const attributions = getAllDocs('embeddedOrderAttributions');
    expect(attributions.length).toBe(0);

    const payouts = getAllDocs('affiliatePayoutLedger');
    expect(payouts.length).toBe(0);
  });
});
