import { describe, it, expect } from 'vitest';
import { extractRequestDomain, isDomainAllowed } from '../embed-validation';

function mockRequest(headers: Record<string, string | undefined>): any {
  return { headers, query: {}, body: {} };
}

describe('extractRequestDomain', () => {
  it('extracts hostname from Origin header', () => {
    expect(extractRequestDomain(mockRequest({ origin: 'https://example.com' }))).toBe('example.com');
  });

  it('extracts hostname from Referer header', () => {
    expect(extractRequestDomain(mockRequest({ referer: 'https://shop.example.com/page?q=1' }))).toBe('shop.example.com');
  });

  it('prefers Origin over Referer', () => {
    expect(extractRequestDomain(mockRequest({ origin: 'https://origin.com', referer: 'https://referer.com' }))).toBe('origin.com');
  });

  it('returns null when neither Origin nor Referer is present', () => {
    expect(extractRequestDomain(mockRequest({}))).toBeNull();
  });

  it('does NOT accept domain from query params (anti-spoofing)', () => {
    const req = { headers: {}, query: { domain: 'spoofed.com' }, body: {} };
    expect(extractRequestDomain(req as any)).toBeNull();
  });

  it('does NOT accept domain from request body (anti-spoofing)', () => {
    const req = { headers: {}, query: {}, body: { domain: 'spoofed.com' } };
    expect(extractRequestDomain(req as any)).toBeNull();
  });

  it('returns null for malformed Origin', () => {
    expect(extractRequestDomain(mockRequest({ origin: 'not-a-url' }))).toBeNull();
  });
});

describe('isDomainAllowed', () => {
  it('allows any domain when allowedDomains is empty', () => {
    expect(isDomainAllowed('example.com', [])).toBe(true);
  });

  it('allows null domain when allowedDomains is empty', () => {
    expect(isDomainAllowed(null, [])).toBe(true);
  });

  it('rejects null domain when allowedDomains is non-empty', () => {
    expect(isDomainAllowed(null, ['example.com'])).toBe(false);
  });

  it('exact match succeeds', () => {
    expect(isDomainAllowed('example.com', ['example.com'])).toBe(true);
  });

  it('wrong domain is rejected', () => {
    expect(isDomainAllowed('evil.com', ['example.com'])).toBe(false);
  });

  it('www subdomain is stripped and matched', () => {
    expect(isDomainAllowed('www.example.com', ['example.com'])).toBe(true);
  });

  it('www in allowedDomains is stripped and matched', () => {
    expect(isDomainAllowed('example.com', ['www.example.com'])).toBe(true);
  });

  it('case-insensitive matching', () => {
    expect(isDomainAllowed('Example.COM', ['example.com'])).toBe(true);
  });

  describe('wildcard subdomains', () => {
    it('wildcard matches subdomain', () => {
      expect(isDomainAllowed('shop.example.com', ['*.example.com'])).toBe(true);
    });

    it('wildcard matches deep subdomain', () => {
      expect(isDomainAllowed('deep.shop.example.com', ['*.example.com'])).toBe(true);
    });

    it('wildcard matches bare domain', () => {
      expect(isDomainAllowed('example.com', ['*.example.com'])).toBe(true);
    });

    it('wildcard does not match unrelated domain', () => {
      expect(isDomainAllowed('evil.com', ['*.example.com'])).toBe(false);
    });

    it('wildcard does not match partial suffix', () => {
      expect(isDomainAllowed('exampleXcom', ['*.example.com'])).toBe(false);
    });
  });

  describe('multiple domains', () => {
    const domains = ['example.com', 'partner.co', '*.vendor.io'];

    it('matches one of multiple allowed domains', () => {
      expect(isDomainAllowed('partner.co', domains)).toBe(true);
    });

    it('matches wildcard in multiple allowed domains', () => {
      expect(isDomainAllowed('app.vendor.io', domains)).toBe(true);
    });

    it('rejects domain not in allowed list', () => {
      expect(isDomainAllowed('hacker.org', domains)).toBe(false);
    });
  });
});
