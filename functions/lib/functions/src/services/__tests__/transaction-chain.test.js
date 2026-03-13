"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const surfaces_1 = require("../../../../shared/surfaces");
const mockFirestoreData = {};
let batchOps = [];
const mockBatch = () => ({
    set: vitest_1.vi.fn((ref, data) => {
        batchOps.push({ type: 'set', path: ref._path, data });
    }),
    update: vitest_1.vi.fn((ref, data) => {
        batchOps.push({ type: 'update', path: ref._path, data });
    }),
    commit: vitest_1.vi.fn(async () => {
        for (const op of batchOps) {
            const [collection, docId] = op.path.split('/');
            if (!mockFirestoreData[collection])
                mockFirestoreData[collection] = {};
            if (op.type === 'set') {
                mockFirestoreData[collection][docId] = op.data;
            }
            else if (op.type === 'update') {
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
const mockCollection = (name) => ({
    doc: (id) => {
        const docId = id || `auto_${++docIdCounter}`;
        return {
            _path: `${name}/${docId}`,
            id: docId,
            get: vitest_1.vi.fn(async () => {
                const data = mockFirestoreData[name]?.[docId];
                return { exists: !!data, id: docId, data: () => data, ref: { _path: `${name}/${docId}`, update: vitest_1.vi.fn() } };
            }),
        };
    },
    add: vitest_1.vi.fn(async (data) => {
        const docId = `auto_${++docIdCounter}`;
        if (!mockFirestoreData[name])
            mockFirestoreData[name] = {};
        mockFirestoreData[name][docId] = data;
        return { id: docId };
    }),
    where: vitest_1.vi.fn((_field, _op, value) => ({
        where: vitest_1.vi.fn(() => ({
            limit: vitest_1.vi.fn(() => ({
                get: vitest_1.vi.fn(async () => {
                    const docs = Object.entries(mockFirestoreData[name] || {})
                        .filter(([_, d]) => {
                        return d[_field] === value;
                    })
                        .map(([id, d]) => ({
                        id,
                        data: () => d,
                        ref: {
                            _path: `${name}/${id}`,
                            update: vitest_1.vi.fn(async (updateData) => {
                                mockFirestoreData[name][id] = { ...d, ...updateData };
                            }),
                        },
                    }));
                    return { empty: docs.length === 0, docs };
                }),
            })),
        })),
        limit: vitest_1.vi.fn(() => ({
            get: vitest_1.vi.fn(async () => {
                const docs = Object.entries(mockFirestoreData[name] || {})
                    .filter(([_, d]) => d[_field] === value)
                    .map(([id, d]) => ({
                    id,
                    data: () => d,
                    ref: {
                        _path: `${name}/${id}`,
                        update: vitest_1.vi.fn(async (updateData) => {
                            mockFirestoreData[name][id] = { ...d, ...updateData };
                        }),
                    },
                }));
                return { empty: docs.length === 0, docs };
            }),
        })),
    })),
});
vitest_1.vi.mock('../../core', () => ({
    db: {
        collection: (name) => mockCollection(name),
        batch: () => mockBatch(),
    },
    admin: { firestore: { FieldValue: { serverTimestamp: vitest_1.vi.fn() } } },
}));
vitest_1.vi.mock('../../../../shared/surfaces', async () => {
    const actual = await vitest_1.vi.importActual('../../../../shared/surfaces');
    return actual;
});
(0, vitest_1.describe)('PricingSnapshot computation', () => {
    (0, vitest_1.it)('computes correct snapshot for basic inputs', () => {
        const snap = (0, surfaces_1.computePricingSnapshot)({
            salePrice: 29.99,
            productCost: 12.00,
            affiliatePercent: 25,
            currency: 'USD',
        });
        (0, vitest_1.expect)(snap.baseSalePrice).toBe(29.99);
        (0, vitest_1.expect)(snap.displaySalePrice).toBe(29.99);
        (0, vitest_1.expect)(snap.productCost).toBe(12.00);
        (0, vitest_1.expect)(snap.grossProfitAmount).toBe(29.99 - 12.00);
        (0, vitest_1.expect)(snap.affiliatePercent).toBe(25);
        (0, vitest_1.expect)(snap.affiliateAmount).toBeGreaterThan(0);
        (0, vitest_1.expect)(snap.currency).toBe('USD');
        (0, vitest_1.expect)(snap.pricingSnapshotVersion).toBe('1.0');
    });
    (0, vitest_1.it)('handles zero profit', () => {
        const snap = (0, surfaces_1.computePricingSnapshot)({ salePrice: 10, productCost: 10, affiliatePercent: 25 });
        (0, vitest_1.expect)(snap.grossProfitAmount).toBe(0);
        (0, vitest_1.expect)(snap.affiliateAmount).toBe(0);
    });
    (0, vitest_1.it)('handles negative margin', () => {
        const snap = (0, surfaces_1.computePricingSnapshot)({ salePrice: 8, productCost: 12, affiliatePercent: 25 });
        (0, vitest_1.expect)(snap.grossProfitAmount).toBeLessThan(0);
        (0, vitest_1.expect)(snap.affiliateAmount).toBe(0);
    });
    (0, vitest_1.it)('deducts fees and shipping from gross profit', () => {
        const snap = (0, surfaces_1.computePricingSnapshot)({
            salePrice: 30, productCost: 10, platformFeeAmount: 2, shippingCostBurden: 4.95, affiliatePercent: 25,
        });
        (0, vitest_1.expect)(snap.grossProfitAmount).toBe(30 - 10 - 2 - 4.95);
        (0, vitest_1.expect)(snap.affiliateAmount).toBe(Math.round((snap.grossProfitAmount * 0.25) * 100) / 100);
    });
});
(0, vitest_1.describe)('Embed order transaction chain', () => {
    (0, vitest_1.beforeEach)(() => {
        Object.keys(mockFirestoreData).forEach(k => delete mockFirestoreData[k]);
        batchOps = [];
        docIdCounter = 0;
    });
    (0, vitest_1.it)('createEmbedOrder writes attribution and payout atomically', async () => {
        const { createCanonicalOrder } = await Promise.resolve().then(() => __importStar(require('../order-service')));
        const pricingSnapshot = (0, surfaces_1.computePricingSnapshot)({
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
        (0, vitest_1.expect)(result.orderId).toBe('cs_test_atomic_1');
        (0, vitest_1.expect)(result.alreadyExisted).toBe(false);
        const attributions = mockFirestoreData['embeddedOrderAttributions'] || {};
        const payouts = mockFirestoreData['affiliatePayoutLedger'] || {};
        const attribEntries = Object.values(attributions);
        const payoutEntries = Object.values(payouts);
        (0, vitest_1.expect)(attribEntries.length).toBe(1);
        (0, vitest_1.expect)(payoutEntries.length).toBe(1);
        const attrib = attribEntries[0];
        (0, vitest_1.expect)(attrib.stripeCheckoutSessionId).toBe('cs_test_atomic_1');
        (0, vitest_1.expect)(attrib.status).toBe('pending_payment');
        (0, vitest_1.expect)(attrib.affiliateUserId).toBe('affiliate-user-1');
        (0, vitest_1.expect)(attrib.quantity).toBe(2);
        const payout = payoutEntries[0];
        (0, vitest_1.expect)(payout.orderId).toBe('cs_test_atomic_1');
        (0, vitest_1.expect)(payout.affiliateUserId).toBe('affiliate-user-1');
        (0, vitest_1.expect)(payout.status).toBe('pending');
        (0, vitest_1.expect)(payout.affiliateAmount).toBe(pricingSnapshot.affiliateAmount * 2);
    });
    (0, vitest_1.it)('createEmbedOrder is idempotent — second call returns existing', async () => {
        const { createCanonicalOrder } = await Promise.resolve().then(() => __importStar(require('../order-service')));
        const pricingSnapshot = (0, surfaces_1.computePricingSnapshot)({
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
        (0, vitest_1.expect)(result.alreadyExisted).toBe(true);
        (0, vitest_1.expect)(result.orderItemId).toBe('existing-item');
    });
    (0, vitest_1.it)('confirmEmbedOrderPayout transitions both docs atomically', async () => {
        const { confirmEmbedOrderPayout } = await Promise.resolve().then(() => __importStar(require('../order-service')));
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
        (0, vitest_1.expect)(attrib.status).toBe('paid');
        (0, vitest_1.expect)(attrib.paidAt).toBeDefined();
        (0, vitest_1.expect)(payout.status).toBe('approved');
        (0, vitest_1.expect)(payout.approvedAt).toBeDefined();
    });
    (0, vitest_1.it)('confirmEmbedOrderPayout creates legacy payout for pre-patch attributions', async () => {
        const { confirmEmbedOrderPayout } = await Promise.resolve().then(() => __importStar(require('../order-service')));
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
        const payoutEntries = Object.values(mockFirestoreData['affiliatePayoutLedger'] || {});
        (0, vitest_1.expect)(payoutEntries.length).toBe(1);
        (0, vitest_1.expect)(payoutEntries[0].affiliateUserId).toBe('aff-legacy');
        (0, vitest_1.expect)(payoutEntries[0].status).toBe('approved');
        (0, vitest_1.expect)(payoutEntries[0].legacyBackfill).toBe(true);
    });
    (0, vitest_1.it)('confirmEmbedOrderPayout is idempotent — paid attribution is skipped', async () => {
        const { confirmEmbedOrderPayout } = await Promise.resolve().then(() => __importStar(require('../order-service')));
        mockFirestoreData['embeddedOrderAttributions'] = {
            'attrib-paid': {
                stripeCheckoutSessionId: 'cs_test_paid',
                status: 'paid',
                paidAt: '2025-01-01T00:00:00Z',
            },
        };
        await confirmEmbedOrderPayout('cs_test_paid');
        (0, vitest_1.expect)(mockFirestoreData['embeddedOrderAttributions']['attrib-paid'].status).toBe('paid');
    });
});
(0, vitest_1.describe)('Affiliate resolution chain priority', () => {
    (0, vitest_1.it)('placement affiliate takes priority', () => {
        const result = resolveAffiliate({ affiliateUserId: 'p-user' }, { ownerUserId: 'h-user' }, { affiliateUserId: 'pr-user' });
        (0, vitest_1.expect)(result).toEqual({ userId: 'p-user', source: 'placement' });
    });
    (0, vitest_1.it)('host owner is second in chain', () => {
        const result = resolveAffiliate({}, { ownerUserId: 'h-user' }, { affiliateUserId: 'pr-user' });
        (0, vitest_1.expect)(result).toEqual({ userId: 'h-user', source: 'host_owner' });
    });
    (0, vitest_1.it)('profile affiliate is third in chain', () => {
        const result = resolveAffiliate({}, {}, { affiliateUserId: 'pr-user' });
        (0, vitest_1.expect)(result).toEqual({ userId: 'pr-user', source: 'profile' });
    });
    (0, vitest_1.it)('returns none when all sources empty', () => {
        const result = resolveAffiliate({}, {}, {});
        (0, vitest_1.expect)(result).toEqual({ userId: '', source: 'none' });
    });
    (0, vitest_1.it)('handles null profile gracefully', () => {
        const result = resolveAffiliate({}, {}, null);
        (0, vitest_1.expect)(result).toEqual({ userId: '', source: 'none' });
    });
});
function resolveAffiliate(placement, host, profile) {
    if (placement.affiliateUserId)
        return { userId: placement.affiliateUserId, source: 'placement' };
    if (host.ownerUserId)
        return { userId: host.ownerUserId, source: 'host_owner' };
    if (profile?.affiliateUserId)
        return { userId: profile.affiliateUserId, source: 'profile' };
    return { userId: '', source: 'none' };
}
//# sourceMappingURL=transaction-chain.test.js.map