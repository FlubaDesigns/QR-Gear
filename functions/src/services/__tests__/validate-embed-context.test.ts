import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockData: Record<string, Record<string, any>> = {};

function setDoc(collection: string, id: string, data: any) {
  if (!mockData[collection]) mockData[collection] = {};
  mockData[collection][id] = data;
}

vi.mock('../../core', () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        id,
        get: vi.fn(async () => {
          const data = mockData[name]?.[id];
          return { exists: !!data, id, data: () => data };
        }),
      }),
      where: vi.fn((_field: string, _op: string, value: any) => ({
        get: vi.fn(async () => {
          const docs = Object.entries(mockData[name] || {})
            .filter(([_, d]) => d[_field] === value)
            .map(([docId, d]) => ({ id: docId, data: () => d }));
          return { docs };
        }),
      })),
    }),
  },
}));

vi.mock('../../../../shared/surfaces', async () => {
  const actual = await vi.importActual('../../../../shared/surfaces');
  return actual;
});

function mockReq(headers: Record<string, string> = {}): any {
  return { headers, query: {}, body: {} };
}

describe('validateEmbedContext', () => {
  beforeEach(() => {
    Object.keys(mockData).forEach(k => delete mockData[k]);
  });

  it('rejects when placement not found', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    const result = await validateEmbedContext('nonexistent', mockReq());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects when placement is not active', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'disabled', builderHostId: 'h1' });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not active');
  });

  it('rejects when host not found', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'missing-host' });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Host not found');
  });

  it('rejects when host is not active', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
    setDoc('builderHosts', 'h1', { status: 'suspended' });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not active');
  });

  it('rejects wrong domain when host has allowedDomains', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
    setDoc('builderHosts', 'h1', { status: 'active', allowedDomains: ['allowed.com'] });
    const result = await validateEmbedContext('p1', mockReq({ origin: 'https://evil.com' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('rejects missing Origin+Referer when host has allowedDomains', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
    setDoc('builderHosts', 'h1', { status: 'active', allowedDomains: ['allowed.com'] });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('could not be determined');
  });

  it('allows correct domain from Origin header', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
    setDoc('builderHosts', 'h1', { status: 'active', allowedDomains: ['allowed.com'] });
    const result = await validateEmbedContext('p1', mockReq({ origin: 'https://allowed.com' }));
    expect(result.valid).toBe(true);
  });

  it('allows wildcard subdomain matching', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
    setDoc('builderHosts', 'h1', { status: 'active', allowedDomains: ['*.mysite.com'] });
    const result = await validateEmbedContext('p1', mockReq({ origin: 'https://shop.mysite.com' }));
    expect(result.valid).toBe(true);
  });

  it('allows any domain when host has no allowedDomains', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
    setDoc('builderHosts', 'h1', { status: 'active' });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(true);
  });

  it('resolves affiliate from placement first', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1', affiliateUserId: 'p-aff' });
    setDoc('builderHosts', 'h1', { status: 'active', ownerUserId: 'h-owner' });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(true);
    expect(result.affiliateUserId).toBe('p-aff');
    expect(result.affiliateSource).toBe('placement');
  });

  it('falls back to host owner for affiliate', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1' });
    setDoc('builderHosts', 'h1', { status: 'active', ownerUserId: 'h-owner' });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(true);
    expect(result.affiliateUserId).toBe('h-owner');
    expect(result.affiliateSource).toBe('host_owner');
  });

  it('falls back to profile for affiliate', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1', builderProfileId: 'prof1' });
    setDoc('builderHosts', 'h1', { status: 'active' });
    setDoc('builderProfiles', 'prof1', { status: 'active', affiliateUserId: 'prof-aff' });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(true);
    expect(result.affiliateUserId).toBe('prof-aff');
    expect(result.affiliateSource).toBe('profile');
  });

  it('normalizes affiliateSharePercent to affiliatePercent on revenueSplit', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1', revenueSplitId: 'rs1', affiliateUserId: 'aff1' });
    setDoc('builderHosts', 'h1', { status: 'active' });
    setDoc('revenueSplits', 'rs1', { affiliateSharePercent: 30 });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(true);
    expect(result.revenueSplit?.affiliatePercent).toBe(30);
  });

  it('rejects when revenue sharing enabled but no affiliate resolved', async () => {
    const { validateEmbedContext } = await import('../embed-validation');
    setDoc('builderPlacements', 'p1', { status: 'active', builderHostId: 'h1', revenueSplitId: 'rs1' });
    setDoc('builderHosts', 'h1', { status: 'active' });
    setDoc('revenueSplits', 'rs1', { affiliateSharePercent: 25, requireAffiliate: true });
    const result = await validateEmbedContext('p1', mockReq());
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no affiliate user could be resolved');
  });
});
