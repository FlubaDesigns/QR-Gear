"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const embed_validation_1 = require("../embed-validation");
function mockRequest(headers) {
    return { headers, query: {}, body: {} };
}
(0, vitest_1.describe)('extractRequestDomain', () => {
    (0, vitest_1.it)('extracts hostname from Origin header', () => {
        (0, vitest_1.expect)((0, embed_validation_1.extractRequestDomain)(mockRequest({ origin: 'https://example.com' }))).toBe('example.com');
    });
    (0, vitest_1.it)('extracts hostname from Referer header', () => {
        (0, vitest_1.expect)((0, embed_validation_1.extractRequestDomain)(mockRequest({ referer: 'https://shop.example.com/page?q=1' }))).toBe('shop.example.com');
    });
    (0, vitest_1.it)('prefers Origin over Referer', () => {
        (0, vitest_1.expect)((0, embed_validation_1.extractRequestDomain)(mockRequest({ origin: 'https://origin.com', referer: 'https://referer.com' }))).toBe('origin.com');
    });
    (0, vitest_1.it)('returns null when neither Origin nor Referer is present', () => {
        (0, vitest_1.expect)((0, embed_validation_1.extractRequestDomain)(mockRequest({}))).toBeNull();
    });
    (0, vitest_1.it)('does NOT accept domain from query params (anti-spoofing)', () => {
        const req = { headers: {}, query: { domain: 'spoofed.com' }, body: {} };
        (0, vitest_1.expect)((0, embed_validation_1.extractRequestDomain)(req)).toBeNull();
    });
    (0, vitest_1.it)('does NOT accept domain from request body (anti-spoofing)', () => {
        const req = { headers: {}, query: {}, body: { domain: 'spoofed.com' } };
        (0, vitest_1.expect)((0, embed_validation_1.extractRequestDomain)(req)).toBeNull();
    });
    (0, vitest_1.it)('returns null for malformed Origin', () => {
        (0, vitest_1.expect)((0, embed_validation_1.extractRequestDomain)(mockRequest({ origin: 'not-a-url' }))).toBeNull();
    });
});
(0, vitest_1.describe)('isDomainAllowed', () => {
    (0, vitest_1.it)('allows any domain when allowedDomains is empty', () => {
        (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('example.com', [])).toBe(true);
    });
    (0, vitest_1.it)('allows null domain when allowedDomains is empty', () => {
        (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)(null, [])).toBe(true);
    });
    (0, vitest_1.it)('rejects null domain when allowedDomains is non-empty', () => {
        (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)(null, ['example.com'])).toBe(false);
    });
    (0, vitest_1.it)('exact match succeeds', () => {
        (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('example.com', ['example.com'])).toBe(true);
    });
    (0, vitest_1.it)('wrong domain is rejected', () => {
        (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('evil.com', ['example.com'])).toBe(false);
    });
    (0, vitest_1.it)('www subdomain is stripped and matched', () => {
        (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('www.example.com', ['example.com'])).toBe(true);
    });
    (0, vitest_1.it)('www in allowedDomains is stripped and matched', () => {
        (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('example.com', ['www.example.com'])).toBe(true);
    });
    (0, vitest_1.it)('case-insensitive matching', () => {
        (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('Example.COM', ['example.com'])).toBe(true);
    });
    (0, vitest_1.describe)('wildcard subdomains', () => {
        (0, vitest_1.it)('wildcard matches subdomain', () => {
            (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('shop.example.com', ['*.example.com'])).toBe(true);
        });
        (0, vitest_1.it)('wildcard matches deep subdomain', () => {
            (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('deep.shop.example.com', ['*.example.com'])).toBe(true);
        });
        (0, vitest_1.it)('wildcard matches bare domain', () => {
            (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('example.com', ['*.example.com'])).toBe(true);
        });
        (0, vitest_1.it)('wildcard does not match unrelated domain', () => {
            (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('evil.com', ['*.example.com'])).toBe(false);
        });
        (0, vitest_1.it)('wildcard does not match partial suffix', () => {
            (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('exampleXcom', ['*.example.com'])).toBe(false);
        });
    });
    (0, vitest_1.describe)('multiple domains', () => {
        const domains = ['example.com', 'partner.co', '*.vendor.io'];
        (0, vitest_1.it)('matches one of multiple allowed domains', () => {
            (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('partner.co', domains)).toBe(true);
        });
        (0, vitest_1.it)('matches wildcard in multiple allowed domains', () => {
            (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('app.vendor.io', domains)).toBe(true);
        });
        (0, vitest_1.it)('rejects domain not in allowed list', () => {
            (0, vitest_1.expect)((0, embed_validation_1.isDomainAllowed)('hacker.org', domains)).toBe(false);
        });
    });
});
//# sourceMappingURL=embed-validation.test.js.map