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
const mockData = {};
function setDoc(collection, id, data) {
    if (!mockData[collection])
        mockData[collection] = {};
    mockData[collection][id] = data;
}
vitest_1.vi.mock('../../core', () => ({
    db: {
        collection: (name) => ({
            doc: (id) => ({
                id,
                get: vitest_1.vi.fn(async () => {
                    const data = mockData[name]?.[id];
                    return { exists: !!data, id, data: () => data };
                }),
            }),
            where: vitest_1.vi.fn((_field, _op, value) => ({
                get: vitest_1.vi.fn(async () => {
                    const docs = Object.entries(mockData[name] || {})
                        .filter(([_, d]) => d[_field] === value)
                        .map(([docId, d]) => ({ id: docId, data: () => d }));
                    return { docs };
                }),
            })),
        }),
    },
}));
vitest_1.vi.mock('../../../../shared/surfaces', async () => {
    const actual = await vitest_1.vi.importActual('../../../../shared/surfaces');
    return actual;
});
function mockReq(headers = {}) {
    return { headers, query: {}, body: {} };
}
(0, vitest_1.describe)('validateEmbedContext', () => {
    (0, vitest_1.beforeEach)(() => {
        Object.keys(mockData).forEach(k => delete mockData[k]);
    });
    (0, vitest_1.it)('rejects when placement not found', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        const result = await validateEmbedContext('nonexistent', mockReq());
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('not found');
    });
    (0, vitest_1.it)('rejects when placement is not active', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'disabled', builderHostId: 'h1' });
        const result = await validateEmbedContext('p1', mockReq());
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('not active');
    });
    (0, vitest_1.it)('rejects when host not found', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'missing-host' });
        const result = await validateEmbedContext('p1', mockReq());
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('Host not found');
    });
    (0, vitest_1.it)('rejects when host is not active', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
        setDoc('builderHosts', 'h1', { status: 'suspended' });
        const result = await validateEmbedContext('p1', mockReq());
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('not active');
    });
    (0, vitest_1.it)('rejects wrong domain when host has allowedDomains', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
        setDoc('builderHosts', 'h1', { status: 'active', allowedDomains: ['allowed.com'] });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://evil.com' }));
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('not allowed');
    });
    (0, vitest_1.it)('rejects missing Origin+Referer when host has allowedDomains', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
        setDoc('builderHosts', 'h1', { status: 'active', allowedDomains: ['allowed.com'] });
        const result = await validateEmbedContext('p1', mockReq());
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('could not be determined');
    });
    (0, vitest_1.it)('allows correct domain from Origin header', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
        setDoc('builderHosts', 'h1', { status: 'active', allowedDomains: ['allowed.com'] });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://allowed.com' }));
        (0, vitest_1.expect)(result.valid).toBe(true);
    });
    (0, vitest_1.it)('allows wildcard subdomain matching', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
        setDoc('builderHosts', 'h1', { status: 'active', allowedDomains: ['*.mysite.com'] });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://shop.mysite.com' }));
        (0, vitest_1.expect)(result.valid).toBe(true);
    });
    (0, vitest_1.it)('allows any domain when host has no allowedDomains', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
        setDoc('builderHosts', 'h1', { status: 'active' });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://anything.com' }));
        (0, vitest_1.expect)(result.valid).toBe(true);
    });
    (0, vitest_1.it)('rejects missing Origin+Referer even without allowedDomains', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
        setDoc('builderHosts', 'h1', { status: 'active' });
        const result = await validateEmbedContext('p1', mockReq());
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('could not be determined');
    });
    (0, vitest_1.it)('resolves affiliate from placement first', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1', affiliateUserId: 'p-aff' });
        setDoc('builderHosts', 'h1', { status: 'active', ownerUserId: 'h-owner' });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://test.com' }));
        (0, vitest_1.expect)(result.valid).toBe(true);
        (0, vitest_1.expect)(result.affiliateUserId).toBe('p-aff');
        (0, vitest_1.expect)(result.affiliateSource).toBe('placement');
    });
    (0, vitest_1.it)('falls back to host owner for affiliate', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
        setDoc('builderHosts', 'h1', { status: 'active', ownerUserId: 'h-owner' });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://test.com' }));
        (0, vitest_1.expect)(result.valid).toBe(true);
        (0, vitest_1.expect)(result.affiliateUserId).toBe('h-owner');
        (0, vitest_1.expect)(result.affiliateSource).toBe('host_owner');
    });
    (0, vitest_1.it)('falls back to profile for affiliate', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1', builderProfileId: 'prof1' });
        setDoc('builderHosts', 'h1', { status: 'active' });
        setDoc('builderProfiles', 'prof1', { status: 'active', affiliateUserId: 'prof-aff' });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://test.com' }));
        (0, vitest_1.expect)(result.valid).toBe(true);
        (0, vitest_1.expect)(result.affiliateUserId).toBe('prof-aff');
        (0, vitest_1.expect)(result.affiliateSource).toBe('profile');
    });
    (0, vitest_1.it)('normalizes affiliateSharePercent to affiliatePercent on revenueSplit', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1', revenueSplitId: 'rs1', affiliateUserId: 'aff1' });
        setDoc('builderHosts', 'h1', { status: 'active' });
        setDoc('revenueSplits', 'rs1', { affiliateSharePercent: 30 });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://test.com' }));
        (0, vitest_1.expect)(result.valid).toBe(true);
        (0, vitest_1.expect)(result.revenueSplit?.affiliatePercent).toBe(30);
    });
    (0, vitest_1.it)('rejects when revenue sharing enabled but no affiliate resolved', async () => {
        const { validateEmbedContext } = await Promise.resolve().then(() => __importStar(require('../embed-validation')));
        setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1', revenueSplitId: 'rs1' });
        setDoc('builderHosts', 'h1', { status: 'active' });
        setDoc('revenueSplits', 'rs1', { affiliateSharePercent: 25, requireAffiliate: true });
        const result = await validateEmbedContext('p1', mockReq({ origin: 'https://test.com' }));
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('no affiliate user could be resolved');
    });
});
//# sourceMappingURL=validate-embed-context.test.js.map