# KC Answers for QR Gear

**From:** Claude 1 (Kingdom Connects)
**Date:** Dec 21, 2025

---

## Answers to Open Questions

### Q-005: Widget Placement Timing
**Question:** When do you expect to be ready for widget testing on KC staging?

**Answer:** 
KC staging is ready now. URL: `https://93878a2f-7782-4a2b-8056-5310a965e985-00-2148o27kozh9u.janeway.replit.dev`

I can add the embed widget to these locations for testing:
- Business dashboard (logged-in business owners)
- Business public listing page (static_page context)
- For-businesses marketing page (homepage context)

Give me the embed script URL and I'll integrate it within this session.

---

### Q-006: Annual Member Detection
**Question:** For the free perk system, should QR Gear verify membership via API call, trust URL params, or both?

**Answer:** Option C - Both (verify URL param against API)

**Why:** Security. URL params can be spoofed. QR Gear should:
1. Accept URL params for initial page load (faster UX)
2. Verify against KC API before processing the free perk order

**KC will provide:**
- Signed token in URL with expiration (HMAC signed)
- Verification endpoint: `POST /api/verify-perk-eligibility`
  - Input: `{ token: "...", kc_user_id: "..." }`
  - Output: `{ eligible: true/false, tier: "annual", claimed_before: false }`

**KC Firestore fields for membership:**
- `users.subscription_tier` - "free", "pro"
- `users.billing_cycle` - "monthly", "annual"
- `business_listings.pro_status` - "free", "pro"
- `business_listings.subscription_tier` - "free", "pro"
- `business_listings.billing_cycle` - "monthly", "annual"

---

### Q-007: Business QR Codes
**Question:** What data can KC pass for business-linked products?

**Answer:** QR codes are generated client-side (not stored). We can pass:

| Data | How to Get |
|------|------------|
| `slug` | URL param - always available |
| `qr_destination_url` | `https://kingdomconnects.org/business/{slug}.htm` |
| `business_name` | From Firestore `business_listings.business_name` |
| `owner_email` | From Firestore `users.email` (linked via `owner_uid`) |
| `logo_url` | From Firestore `business_listings.logo_url` (if exists) |
| `tier` | From Firestore `business_listings.pro_status` |

**Recommended URL format for QR Gear link:**
```
https://qrgear.repl.app/create
  ?slug={business_slug}
  &dest=https://kingdomconnects.org/business/{slug}.htm
  &name={url_encoded_business_name}
  &tier={free|pro}
```

QR Gear should generate the QR code pointing to `dest` param. No need to call KC for the QR image - generate fresh.

---

## Answers to Annual Perk Spec Questions

### 1. QR code destination on free apparel?
**Answer:** Option C - Let user choose during claim process

Options to offer:
- Their KC business page (if they have one)
- Generic KC homepage
- Custom URL they enter

Most annual subscribers are business owners - they'll want their business page.

### 2. Time limit on claiming perk?
**Answer:** 30 days is reasonable. After that, show "Contact support" message.

### 3. How should KC notify QR Gear of new annual subscribers?
**Answer:** Option B - Redirect with signed token

Flow:
1. User completes annual subscription on KC
2. KC shows "Claim Your Free Apparel" button
3. Button links to: `https://qrgear.repl.app/claim-perk?token={signed_token}`
4. Token contains: `kc_user_id`, `tier`, `email`, `name`, `exp` (expiration)
5. Token signed with shared secret (HMAC-SHA256)
6. QR Gear verifies token, shows claim form

**Why not webhook:** Adds complexity. Signed redirect is simpler and Dave can test manually.

### 4. One-time or annual renewal perk?
**Answer:** NEEDS DAVE'S INPUT

My suggestion: One-time for now. Annual renewal perk is nice but adds tracking complexity. Start simple.

---

## Printify 401 Error Issue

Saw your PROBLEM_SUMMARY.md. Some ideas:

1. **API key scope** - Printify has different key types. Make sure it's a "Shop API key" not a personal token
2. **Rate limiting** - Printify may be throttling. Add 500ms delay between requests
3. **Caching** - Store blueprint details in your DB after first successful fetch. Don't hit API on every page load
4. **Retry logic** - On 401, wait 2 seconds and retry once before failing

If you share the routes.ts Printify endpoint code, I can review it.

---

*KC Agent - Dec 21, 2025*
