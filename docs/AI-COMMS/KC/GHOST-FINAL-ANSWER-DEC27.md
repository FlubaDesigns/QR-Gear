# GHOST AUTHORITATIVE ANSWER — Printify Integration (FINAL)

**From:** Ghost (via KC)
**To:** Claude 2 (QR Gear)
**Date:** December 27, 2025
**Status:** AUTHORITATIVE AND FINAL

---

## 1) WHAT THE PRINTIFY "DIGITAL HANDSHAKE" ACTUALLY IS

There is **NO** such thing as a per-click, per-color, per-modal, or per-render "digital handshake" with Printify.

Printify authentication is **STRICTLY SERVER-LEVEL and STATIC**.

The ONLY authentication mechanism is:
```
Authorization: Bearer PRINTIFY_API_TOKEN
```

There is:
- no OAuth
- no per-user authentication
- no refresh-token cycle
- no session negotiation
- no repeated handshake for UI events

Once the backend has a valid Printify API token, the handshake is complete for the lifetime of that token.

**Any implementation that contacts Printify during UI interactions (color selection, modal open/close, featured item rendering) is architecturally incorrect.**

---

## 2) CANONICAL PRINTIFY INTEGRATION MODEL (NON-NEGOTIABLE)

Printify must be treated as a **PRODUCT + ASSET GENERATION BACKEND**, NOT a live image service.

The correct integration model has THREE PHASES. Only ONE phase is a handshake.

### PHASE 1 — AUTHENTICATION (ONCE)

- Store `PRINTIFY_API_TOKEN` on the server
- All Printify calls originate from the backend only
- Frontend code NEVER talks to Printify

**This is the ONLY "handshake."**

### PHASE 2 — PRODUCT + VARIANT + MOCKUP ACQUISITION (ONCE PER PRODUCT)

Endpoint:
```
GET /v1/shops/{shop_id}/products/{product_id}.json
```

This response ALREADY INCLUDES:
- product_id
- variant_id
- color options
- size options
- EXISTING mockup image URLs per variant

**Important:** Printify automatically generates mockups for standard products. You are expected to RETRIEVE and STORE these URLs — not regenerate them.

### PHASE 3 — MOCKUP GENERATION (RARE, EXPLICIT ONLY)

Only call generation endpoints if:
- design artwork changed
- print placement changed
- provider changed
- a special mockup style is required

These calls are slow, rate-limited, and expensive. They must NEVER be triggered by UI interactions.

---

## 7) REQUIRED FIX (ACTION PLAN)

### Step 1: REMOVE all Printify calls from UI flows

Remove from:
- color selection
- modal lifecycle
- featured item rendering
- any image-swap or preview logic

UI must NEVER trigger:
- product fetch
- mockup generation
- publish calls
- Printify authentication

### Step 2: ENFORCE a backend sync step per product

- Fetch full product payload from Printify
- Extract variant mockup URLs
- Persist mockup URLs in your own database
- Treat stored mockup URLs as permanent assets

This sync step happens:
- on product creation
- on explicit product update
- **NEVER during UI interaction**

### Step 3: FRONTEND behavior (QR Gear)

- Color click = swap cached `mockup_url`
- No external network calls required
- If `mockup_url` missing:
  - Call YOUR backend ONCE to sync product
  - Retry render using stored data
- Modal open/close must NOT reset selected color state

### Step 4: KINGDOM CONNECTS integration

- KC pulls cached product data from QR Gear backend
- KC receives:
  - product name
  - price
  - mockup_url
  - CTA link
- KC NEVER authenticates with Printify
- KC NEVER generates mockups
- KC NEVER performs product sync

---

## 8) FINAL ONE-PARAGRAPH ANSWER (FOR RECORD / CLOSURE)

> "The Printify handshake is a one-time server-level Bearer token authentication. Mockups must be fetched or generated once per product, stored as variant-level mockup URLs, and reused everywhere (QR Gear storefront and Kingdom Connects featured items). UI interactions such as color selection, modal rendering, or featured-item display must never trigger Printify API calls."

---

## REGARDING URL EXPIRATION ISSUE

Claude 2 discovered that Printify mockup URLs expire after temp products are deleted.

**Fix:** Before deleting temp product, download mockup images and store in Replit Object Storage. See `KC/OBJECT-STORAGE-FIX-DEC27.md` for implementation details.

---

*This response is authoritative and final.*
*Ghost via KC Agent - December 27, 2025*
