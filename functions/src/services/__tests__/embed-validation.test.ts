import { extractRequestDomain, isDomainAllowed } from '../embed-validation';

type MockHeaders = Record<string, string | undefined>;

function mockRequest(headers: MockHeaders, query: Record<string, string> = {}, body: Record<string, any> = {}): any {
  return { headers, query, body };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function section(name: string) {
  console.log(`\n=== ${name} ===`);
}

section('extractRequestDomain');

assert(
  extractRequestDomain(mockRequest({ origin: 'https://example.com' })) === 'example.com',
  'extracts hostname from Origin header'
);

assert(
  extractRequestDomain(mockRequest({ referer: 'https://shop.example.com/page?q=1' })) === 'shop.example.com',
  'extracts hostname from Referer header'
);

assert(
  extractRequestDomain(mockRequest({ origin: 'https://origin.com', referer: 'https://referer.com' })) === 'origin.com',
  'prefers Origin over Referer'
);

assert(
  extractRequestDomain(mockRequest({})) === null,
  'returns null when neither Origin nor Referer is present'
);

assert(
  extractRequestDomain(mockRequest({}, { domain: 'spoofed.com' })) === null,
  'does NOT accept domain from query params (anti-spoofing)'
);

assert(
  extractRequestDomain(mockRequest({}, {}, { domain: 'spoofed.com' })) === null,
  'does NOT accept domain from request body (anti-spoofing)'
);

assert(
  extractRequestDomain(mockRequest({ origin: 'not-a-url' })) === null,
  'returns null for malformed Origin'
);

section('isDomainAllowed');

assert(
  isDomainAllowed('example.com', []) === true,
  'allows any domain when allowedDomains is empty'
);

assert(
  isDomainAllowed(null, []) === true,
  'allows null domain when allowedDomains is empty'
);

assert(
  isDomainAllowed(null, ['example.com']) === false,
  'rejects null domain when allowedDomains is non-empty'
);

assert(
  isDomainAllowed('example.com', ['example.com']) === true,
  'exact match succeeds'
);

assert(
  isDomainAllowed('evil.com', ['example.com']) === false,
  'wrong domain is rejected'
);

assert(
  isDomainAllowed('www.example.com', ['example.com']) === true,
  'www subdomain is stripped and matched'
);

assert(
  isDomainAllowed('example.com', ['www.example.com']) === true,
  'www in allowedDomains is stripped and matched'
);

assert(
  isDomainAllowed('Example.COM', ['example.com']) === true,
  'case-insensitive matching'
);

section('isDomainAllowed — wildcard subdomains');

assert(
  isDomainAllowed('shop.example.com', ['*.example.com']) === true,
  'wildcard matches subdomain'
);

assert(
  isDomainAllowed('deep.shop.example.com', ['*.example.com']) === true,
  'wildcard matches deep subdomain'
);

assert(
  isDomainAllowed('example.com', ['*.example.com']) === true,
  'wildcard matches bare domain'
);

assert(
  isDomainAllowed('evil.com', ['*.example.com']) === false,
  'wildcard does not match unrelated domain'
);

assert(
  isDomainAllowed('exampleXcom', ['*.example.com']) === false,
  'wildcard does not match partial suffix'
);

section('isDomainAllowed — multiple domains');

assert(
  isDomainAllowed('partner.co', ['example.com', 'partner.co', '*.vendor.io']) === true,
  'matches one of multiple allowed domains'
);

assert(
  isDomainAllowed('app.vendor.io', ['example.com', 'partner.co', '*.vendor.io']) === true,
  'matches wildcard in multiple allowed domains'
);

assert(
  isDomainAllowed('hacker.org', ['example.com', 'partner.co', '*.vendor.io']) === false,
  'rejects domain not in allowed list'
);

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) process.exit(1);
