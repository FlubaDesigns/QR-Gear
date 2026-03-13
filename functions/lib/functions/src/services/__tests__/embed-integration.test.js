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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const mockFirestoreData = {};
let batchOps = [];
let docIdCounter = 0;
function resetMockDb() {
    Object.keys(mockFirestoreData).forEach(k => delete mockFirestoreData[k]);
    batchOps = [];
    docIdCounter = 0;
}
function seedDoc(collection, id, data) {
    if (!mockFirestoreData[collection])
        mockFirestoreData[collection] = {};
    mockFirestoreData[collection][id] = data;
}
function getAllDocs(collection) {
    return Object.entries(mockFirestoreData[collection] || {}).map(([id, data]) => ({ id, data }));
}
const makeMockDoc = (collection, docId) => ({
    _path: `${collection}/${docId}`,
    id: docId,
    get: vitest_1.vi.fn(async () => {
        const data = mockFirestoreData[collection]?.[docId];
        return {
            exists: !!data,
            id: docId,
            data: () => data,
            ref: makeMockDoc(collection, docId),
        };
    }),
    update: vitest_1.vi.fn(async (updateData) => {
        if (mockFirestoreData[collection]?.[docId]) {
            mockFirestoreData[collection][docId] = { ...mockFirestoreData[collection][docId], ...updateData };
        }
    }),
    set: vitest_1.vi.fn(async (data) => {
        if (!mockFirestoreData[collection])
            mockFirestoreData[collection] = {};
        mockFirestoreData[collection][docId] = data;
    }),
});
const mockCollection = (name) => ({
    doc: (id) => {
        const docId = id || `auto_${++docIdCounter}`;
        return makeMockDoc(name, docId);
    },
    add: vitest_1.vi.fn(async (data) => {
        const docId = `auto_${++docIdCounter}`;
        if (!mockFirestoreData[name])
            mockFirestoreData[name] = {};
        mockFirestoreData[name][docId] = data;
        return { id: docId };
    }),
    where: vitest_1.vi.fn((field, _op, value) => {
        const makeQuery = (filters) => ({
            where: vitest_1.vi.fn((f2, _o2, v2) => {
                return makeQuery([...filters, { field: f2, value: v2 }]);
            }),
            limit: vitest_1.vi.fn((n) => ({
                get: vitest_1.vi.fn(async () => {
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
            get: vitest_1.vi.fn(async () => {
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
vitest_1.vi.mock('../../core', () => ({
    db: {
        collection: (name) => mockCollection(name),
        batch: () => {
            const ops = [];
            return {
                set: vitest_1.vi.fn((ref, data) => {
                    const [collection, docId] = ref._path.split('/');
                    ops.push({ type: 'set', collection, docId, data });
                }),
                update: vitest_1.vi.fn((ref, data) => {
                    const [collection, docId] = ref._path.split('/');
                    ops.push({ type: 'update', collection, docId, data });
                }),
                commit: vitest_1.vi.fn(async () => {
                    for (const op of ops) {
                        if (!mockFirestoreData[op.collection])
                            mockFirestoreData[op.collection] = {};
                        if (op.type === 'set') {
                            mockFirestoreData[op.collection][op.docId] = op.data;
                        }
                        else if (op.type === 'update') {
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
    admin: { firestore: { FieldValue: { serverTimestamp: vitest_1.vi.fn() } } },
}));
vitest_1.vi.mock('../../../../shared/surfaces', async () => {
    const actual = await vitest_1.vi.importActual('../../../../shared/surfaces');
    return actual;
});
vitest_1.vi.mock('stripe', () => {
    function MockStripe() {
        return {
            checkout: {
                sessions: {
                    create: async (params) => ({
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
async function buildApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    const mod = await Promise.resolve().then(() => __importStar(require('../../routes/external-sites-public')));
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
(0, vitest_1.describe)('Embed Integration: session → cart → buy → confirm', () => {
    let app;
    (0, vitest_1.beforeEach)(async () => {
        resetMockDb();
        seedStandardFixtures();
        process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
        app = await buildApp();
    });
    (0, vitest_1.it)('rejects session creation from wrong domain', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/public/embed/session')
            .set('Origin', 'https://evil.com')
            .send({ builderPlacementId: 'placement-1' });
        (0, vitest_1.expect)(res.status).toBe(403);
        (0, vitest_1.expect)(res.body.error).toContain('not allowed');
    });
    (0, vitest_1.it)('rejects session creation with no Origin/Referer when host has allowedDomains', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/public/embed/session')
            .send({ builderPlacementId: 'placement-1' });
        (0, vitest_1.expect)(res.status).toBe(403);
    });
    (0, vitest_1.it)('creates session from allowed domain', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/public/embed/session')
            .set('Origin', 'https://testsite.com')
            .send({ builderPlacementId: 'placement-1' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.id).toBeDefined();
        (0, vitest_1.expect)(res.body.builderPlacementId).toBe('placement-1');
        (0, vitest_1.expect)(res.body.affiliateUserId).toBe('aff-user-1');
        (0, vitest_1.expect)(res.body.pricingSnapshot).toBeDefined();
        (0, vitest_1.expect)(res.body.pricingSnapshot.baseSalePrice).toBe(29.99);
        (0, vitest_1.expect)(res.body.pricingSnapshot.affiliateAmount).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('creates session from wildcard-matched subdomain', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/public/embed/session')
            .set('Origin', 'https://shop.partner.io')
            .send({ builderPlacementId: 'placement-1' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.id).toBeDefined();
    });
    (0, vitest_1.it)('full flow: session → cart → buy creates attribution + payout', async () => {
        const sessionRes = await (0, supertest_1.default)(app)
            .post('/public/embed/session')
            .set('Origin', 'https://testsite.com')
            .send({ builderPlacementId: 'placement-1' });
        (0, vitest_1.expect)(sessionRes.status).toBe(200);
        const sessionId = sessionRes.body.id;
        const cartRes = await (0, supertest_1.default)(app)
            .post(`/public/embed/session/${sessionId}/cart`)
            .set('Origin', 'https://testsite.com')
            .send({
            surfaceId: 'surface-1',
            variantId: 'variant-1',
            quantity: 2,
            designSelections: { front: { text: 'Hello' } },
        });
        (0, vitest_1.expect)(cartRes.status).toBe(200);
        (0, vitest_1.expect)(cartRes.body.pricingSnapshot).toBeDefined();
        (0, vitest_1.expect)(cartRes.body.quantity).toBe(2);
        (0, vitest_1.expect)(cartRes.body.affiliateUserId).toBe('aff-user-1');
        const buyRes = await (0, supertest_1.default)(app)
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
        (0, vitest_1.expect)(buyRes.status).toBe(200);
        (0, vitest_1.expect)(buyRes.body.checkoutUrl).toBeDefined();
        (0, vitest_1.expect)(buyRes.body.stripeSessionId).toBe('cs_mock_stripe_session');
        const attributions = getAllDocs('embeddedOrderAttributions');
        (0, vitest_1.expect)(attributions.length).toBe(1);
        const attrib = attributions[0].data;
        (0, vitest_1.expect)(attrib.stripeCheckoutSessionId).toBe('cs_mock_stripe_session');
        (0, vitest_1.expect)(attrib.status).toBe('pending_payment');
        (0, vitest_1.expect)(attrib.affiliateUserId).toBe('aff-user-1');
        (0, vitest_1.expect)(attrib.builderHostId).toBe('host-1');
        (0, vitest_1.expect)(attrib.quantity).toBe(2);
        const payouts = getAllDocs('affiliatePayoutLedger');
        (0, vitest_1.expect)(payouts.length).toBe(1);
        const payout = payouts[0].data;
        (0, vitest_1.expect)(payout.orderId).toBe('cs_mock_stripe_session');
        (0, vitest_1.expect)(payout.affiliateUserId).toBe('aff-user-1');
        (0, vitest_1.expect)(payout.status).toBe('pending');
        (0, vitest_1.expect)(payout.affiliateAmount).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('confirm payout transitions attribution and payout to paid/approved', async () => {
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
        const { confirmEmbedOrderPayout } = await Promise.resolve().then(() => __importStar(require('../order-service')));
        await confirmEmbedOrderPayout('cs_confirm_test');
        const attrib = mockFirestoreData['embeddedOrderAttributions']['att-1'];
        (0, vitest_1.expect)(attrib.status).toBe('paid');
        (0, vitest_1.expect)(attrib.paidAt).toBeDefined();
        const payout = mockFirestoreData['affiliatePayoutLedger']['pay-1'];
        (0, vitest_1.expect)(payout.status).toBe('approved');
        (0, vitest_1.expect)(payout.approvedAt).toBeDefined();
    });
    (0, vitest_1.it)('confirm payout creates legacy backfill for pre-patch attributions', async () => {
        seedDoc('embeddedOrderAttributions', 'att-legacy', {
            stripeCheckoutSessionId: 'cs_legacy_test',
            orderItemId: 'item-legacy',
            affiliateUserId: 'aff-legacy',
            affiliateAmount: 3.00,
            quantity: 1,
            currency: 'USD',
            status: 'pending_payment',
        });
        const { confirmEmbedOrderPayout } = await Promise.resolve().then(() => __importStar(require('../order-service')));
        await confirmEmbedOrderPayout('cs_legacy_test');
        const payouts = getAllDocs('affiliatePayoutLedger');
        const legacyPayout = payouts.find(p => p.data.orderId === 'cs_legacy_test');
        (0, vitest_1.expect)(legacyPayout).toBeDefined();
        (0, vitest_1.expect)(legacyPayout.data.status).toBe('approved');
        (0, vitest_1.expect)(legacyPayout.data.legacyBackfill).toBe(true);
        (0, vitest_1.expect)(legacyPayout.data.affiliateUserId).toBe('aff-legacy');
    });
    (0, vitest_1.it)('revenue split uses affiliateSharePercent field (schema normalization)', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/public/embed/session')
            .set('Origin', 'https://testsite.com')
            .send({ builderPlacementId: 'placement-1' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.pricingSnapshot.affiliatePercent).toBe(25);
        (0, vitest_1.expect)(res.body.pricingSnapshot.affiliateAmount).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('buy rejects when no affiliate user is resolved', async () => {
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
        const sessionRes = await (0, supertest_1.default)(app)
            .post('/public/embed/session')
            .set('Origin', 'https://anywhere.com')
            .send({ builderPlacementId: 'placement-no-aff' });
        (0, vitest_1.expect)(sessionRes.status).toBe(200);
        const sessionId = sessionRes.body.id;
        (0, vitest_1.expect)(sessionRes.body.affiliateUserId).toBeFalsy();
        const buyRes = await (0, supertest_1.default)(app)
            .post(`/public/embed/session/${sessionId}/buy`)
            .set('Origin', 'https://anywhere.com')
            .send({
            surfaceId: 'surface-1',
            quantity: 1,
        });
        (0, vitest_1.expect)(buyRes.status).toBe(422);
        (0, vitest_1.expect)(buyRes.body.error).toContain('no affiliate user resolved');
        const attributions = getAllDocs('embeddedOrderAttributions');
        (0, vitest_1.expect)(attributions.length).toBe(0);
        const payouts = getAllDocs('affiliatePayoutLedger');
        (0, vitest_1.expect)(payouts.length).toBe(0);
    });
});
//# sourceMappingURL=embed-integration.test.js.map