import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computePricingSnapshot } from '../../../../shared/surfaces';

const mockFirestoreData: Record<string, Record<string, any>> = {};
let batchOps: Array<{ type: string; path: string; data: any }> = [];

const mockBatch = () => ({
  set: vi.fn((ref: any, data: any) => {
    batchOps.push({ type: 'set', path: ref._path, data });
  }),
  update: vi.fn((ref: any, data: any) => {
    batchOps.push({ type: 'update', path: ref._path, data });
  }),
  commit: vi.fn(async () => {
    for (const op of batchOps) {
      const [collection, docId] = op.path.split('/');
      if (!mockFirestoreData[collection]) mockFirestoreData[collection] = {};
      if (op.type === 'set') {
        mockFirestoreData[collection][docId] = op.data;
      } else if (op.type === 'update') {
        mockFirestoreData[collection][docId] = {
          ...(mockFirestoreData[collection][docId] || {}),
          ...op.data,
        };
      }
    }
    batchOps = [];
  }),
});

let docIdCounter = 0;
const mockCollection = (name: string) => ({
  doc: (id?: string) => {
    const docId = id || `auto_${++docIdCounter}`;
    return {
      _path: `${name}/${docId}`,
      id: docId,
      get: vi.fn(async () => {
        const data = mockFirestoreData[name]?.[docId];
        return { exists: !!data, id: docId, data: () => data, ref: { _path: `${name}/${docId}`, update: vi.fn() } };
      }),
    };
  },
  add: vi.fn(async (data: any) => {
    const docId = `auto_${++docIdCounter}`;
    if (!mockFirestoreData[name]) mockFirestoreData[name] = {};
    mockFirestoreData[name][docId] = data;
    return { id: docId };
  }),
  where: vi.fn((_field: string, _op: string, value: any) => ({
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(async () => {
          const docs = Object.entries(mockFirestoreData[name] || {})
            .filter(([_, d]) => {
              return d[_field] === value;
            })
            .map(([id, d]) => ({
              id,
              data: () => d,
              ref: {
                _path: `${name}/${id}`,
                update: vi.fn(async (updateData: any) => {
                  mockFirestoreData[name][id] = { ...d, ...updateData };
                }),
              },
            }));
          return { empty: docs.length === 0, docs };
        }),
      })),
    })),
    limit: vi.fn(() => ({
      get: vi.fn(async () => {
        const docs = Object.entries(mockFirestoreData[name] || {})
          .filter(([_, d]) => d[_field] === value)
          .map(([id, d]) => ({
            id,
            data: () => d,
            ref: {
              _path: `${name}/${id}`,
              update: vi.fn(async (updateData: any) => {
                mockFirestoreData[name][id] = { ...d, ...updateData };
              }),
            },
          }));
        return { empty: docs.length === 0, docs };
      }),
    })),
  })),
});

vi.mock('../../core', () => ({
  db: {
    collection: (name: string) => mockCollection(name),
    batch: () => mockBatch(),
  },
  admin: { firestore: { FieldValue: { serverTimestamp: vi.fn() } } },
}));

vi.mock('../../../../shared/surfaces', async () => {
  const actual = await vi.importActual('../../../../shared/surfaces');
  return actual;
});

describe('PricingSnapshot computation', () => {
  it('computes correct snapshot for basic inputs', () => {
    const snap = computePricingSnapshot({
      salePrice: 29.99,
      productCost: 12.00,
      affiliatePercent: 25,
      currency: 'USD',
    });
    expect(snap.baseSalePrice).toBe(29.99);
    expect(snap.displaySalePrice).toBe(29.99);
    expect(snap.productCost).toBe(12.00);
    expect(snap.grossProfitAmount).toBe(29.99 - 12.00);
    expect(snap.affiliatePercent).toBe(25);
    expect(snap.affiliateAmount).toBeGreaterThan(0);
    expect(snap.currency).toBe('USD');
    expect(snap.pricingSnapshotVersion).toBe('1.0');
  });

  it('handles zero profit', () => {
    const snap = computePricingSnapshot({ salePrice: 10, productCost: 10, affiliatePercent: 25 });
    expect(snap.grossProfitAmount).toBe(0);
    expect(snap.affiliateAmount).toBe(0);
  });

  it('handles negative margin', () => {
    const snap = computePricingSnapshot({ salePrice: 8, productCost: 12, affiliatePercent: 25 });
    expect(snap.grossProfitAmount).toBeLessThan(0);
    expect(snap.affiliateAmount).toBe(0);
  });

  it('deducts fees and shipping from gross profit', () => {
    const snap = computePricingSnapshot({
      salePrice: 30, productCost: 10, platformFeeAmount: 2, shippingCostBurden: 4.95, affiliatePercent: 25,
    });
    expect(snap.grossProfitAmount).toBe(30 - 10 - 2 - 4.95);
    expect(snap.affiliateAmount).toBe(Math.round((snap.grossProfitAmount * 0.25) * 100) / 100);
  });
});

describe('Embed order transaction chain', () => {
  beforeEach(() => {
    Object.keys(mockFirestoreData).forEach(k => delete mockFirestoreData[k]);
    batchOps = [];
    docIdCounter = 0;
  });

  it('createEmbedOrder writes attribution and payout atomically', async () => {
    const { createCanonicalOrder } = await import('../order-service');
    const pricingSnapshot = computePricingSnapshot({
      salePrice: 24.99, productCost: 11, affiliatePercent: 25, currency: 'USD',
    });

    const result = await createCanonicalOrder({
      source: 'external_embed',
      stripeSessionId: 'cs_test_atomic_1',
      buyerEmail: '',
      buyerName: '',
      shippingAddress: null,
      totalAmount: 24.99 * 2,
      cartItems: [{ surfaceId: 's1', variantId: 'v1', quantity: 2 }],
      pricingSnapshot,
      embedContext: {
        builderHostId: 'host-1',
        builderPlacementId: 'placement-1',
        builderProfileId: 'profile-1',
        affiliateUserId: 'affiliate-user-1',
        surfaceId: 's1',
        variantId: 'v1',
        pricingPolicyId: 'pp-1',
        revenueSplitId: 'rs-1',
      },
    });

    expect(result.orderId).toBe('cs_test_atomic_1');
    expect(result.alreadyExisted).toBe(false);

    const attributions = mockFirestoreData['embeddedOrderAttributions'] || {};
    const payouts = mockFirestoreData['affiliatePayoutLedger'] || {};

    const attribEntries = Object.values(attributions);
    const payoutEntries = Object.values(payouts);

    expect(attribEntries.length).toBe(1);
    expect(payoutEntries.length).toBe(1);

    const attrib = attribEntries[0] as any;
    expect(attrib.stripeCheckoutSessionId).toBe('cs_test_atomic_1');
    expect(attrib.status).toBe('pending_payment');
    expect(attrib.affiliateUserId).toBe('affiliate-user-1');
    expect(attrib.quantity).toBe(2);

    const payout = payoutEntries[0] as any;
    expect(payout.orderId).toBe('cs_test_atomic_1');
    expect(payout.affiliateUserId).toBe('affiliate-user-1');
    expect(payout.status).toBe('pending');
    expect(payout.affiliateAmount).toBe(pricingSnapshot.affiliateAmount * 2);
  });

  it('createEmbedOrder is idempotent — second call returns existing', async () => {
    const { createCanonicalOrder } = await import('../order-service');
    const pricingSnapshot = computePricingSnapshot({
      salePrice: 20, productCost: 10, affiliatePercent: 25, currency: 'USD',
    });

    mockFirestoreData['embeddedOrderAttributions'] = {
      'existing-doc': {
        stripeCheckoutSessionId: 'cs_test_dup',
        orderItemId: 'existing-item',
        status: 'pending_payment',
      },
    };

    const result = await createCanonicalOrder({
      source: 'external_embed',
      stripeSessionId: 'cs_test_dup',
      buyerEmail: '',
      buyerName: '',
      shippingAddress: null,
      totalAmount: 20,
      cartItems: [{ surfaceId: 's1', variantId: 'v1', quantity: 1 }],
      pricingSnapshot,
      embedContext: {
        builderHostId: 'host-1',
        builderPlacementId: 'placement-1',
        affiliateUserId: 'aff-1',
        surfaceId: 's1',
      },
    });

    expect(result.alreadyExisted).toBe(true);
    expect(result.orderItemId).toBe('existing-item');
  });

  it('confirmEmbedOrderPayout transitions both docs atomically', async () => {
    const { confirmEmbedOrderPayout } = await import('../order-service');

    mockFirestoreData['embeddedOrderAttributions'] = {
      'attrib-1': {
        stripeCheckoutSessionId: 'cs_test_confirm',
        orderItemId: 'item-1',
        affiliateUserId: 'aff-1',
        affiliateAmount: 5.00,
        quantity: 1,
        status: 'pending_payment',
      },
    };
    mockFirestoreData['affiliatePayoutLedger'] = {
      'payout-1': {
        orderId: 'cs_test_confirm',
        affiliateUserId: 'aff-1',
        status: 'pending',
      },
    };

    await confirmEmbedOrderPayout('cs_test_confirm');

    const attrib = mockFirestoreData['embeddedOrderAttributions']['attrib-1'];
    const payout = mockFirestoreData['affiliatePayoutLedger']['payout-1'];
    expect(attrib.status).toBe('paid');
    expect(attrib.paidAt).toBeDefined();
    expect(payout.status).toBe('approved');
    expect(payout.approvedAt).toBeDefined();
  });

  it('confirmEmbedOrderPayout creates legacy payout for pre-patch attributions', async () => {
    const { confirmEmbedOrderPayout } = await import('../order-service');

    mockFirestoreData['embeddedOrderAttributions'] = {
      'attrib-legacy': {
        stripeCheckoutSessionId: 'cs_test_legacy',
        orderItemId: 'item-legacy',
        affiliateUserId: 'aff-legacy',
        affiliateAmount: 3.50,
        quantity: 1,
        currency: 'USD',
        status: 'pending_payment',
      },
    };
    mockFirestoreData['affiliatePayoutLedger'] = {};

    await confirmEmbedOrderPayout('cs_test_legacy');

    const payoutEntries = Object.values(mockFirestoreData['affiliatePayoutLedger'] || {}) as any[];
    expect(payoutEntries.length).toBe(1);
    expect(payoutEntries[0].affiliateUserId).toBe('aff-legacy');
    expect(payoutEntries[0].status).toBe('approved');
    expect(payoutEntries[0].legacyBackfill).toBe(true);
  });

  it('confirmEmbedOrderPayout is idempotent — paid attribution is skipped', async () => {
    const { confirmEmbedOrderPayout } = await import('../order-service');

    mockFirestoreData['embeddedOrderAttributions'] = {
      'attrib-paid': {
        stripeCheckoutSessionId: 'cs_test_paid',
        status: 'paid',
        paidAt: '2025-01-01T00:00:00Z',
      },
    };

    await confirmEmbedOrderPayout('cs_test_paid');

    expect(mockFirestoreData['embeddedOrderAttributions']['attrib-paid'].status).toBe('paid');
  });
});

describe('Affiliate resolution chain priority', () => {
  it('placement affiliate takes priority', () => {
    const result = resolveAffiliate({ affiliateUserId: 'p-user' }, { ownerUserId: 'h-user' }, { affiliateUserId: 'pr-user' });
    expect(result).toEqual({ userId: 'p-user', source: 'placement' });
  });

  it('host owner is second in chain', () => {
    const result = resolveAffiliate({}, { ownerUserId: 'h-user' }, { affiliateUserId: 'pr-user' });
    expect(result).toEqual({ userId: 'h-user', source: 'host_owner' });
  });

  it('profile affiliate is third in chain', () => {
    const result = resolveAffiliate({}, {}, { affiliateUserId: 'pr-user' });
    expect(result).toEqual({ userId: 'pr-user', source: 'profile' });
  });

  it('returns none when all sources empty', () => {
    const result = resolveAffiliate({}, {}, {});
    expect(result).toEqual({ userId: '', source: 'none' });
  });

  it('handles null profile gracefully', () => {
    const result = resolveAffiliate({}, {}, null);
    expect(result).toEqual({ userId: '', source: 'none' });
  });
});

function resolveAffiliate(placement: any, host: any, profile: any): { userId: string; source: string } {
  if (placement.affiliateUserId) return { userId: placement.affiliateUserId, source: 'placement' };
  if (host.ownerUserId) return { userId: host.ownerUserId, source: 'host_owner' };
  if (profile?.affiliateUserId) return { userId: profile.affiliateUserId, source: 'profile' };
  return { userId: '', source: 'none' };
}
