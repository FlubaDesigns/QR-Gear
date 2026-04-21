# Environment Notes — QR Gear

Last updated: April 21, 2026

---

## Which Environment This ZIP Reflects

**Production environment: Firebase project `qrgear-c1ffd`**
- Live URL: https://qrgear-c1ffd.web.app (also https://qrgear.com)
- Cloud Functions: `api` function in us-central1
- Firestore: Native mode, us-central1
- Firebase Storage: `qrgear-c1ffd.firebasestorage.app`

The dev Express server (`server/`) is **NOT production**. It is a local dev aid only. It uses in-memory storage. Any data written to it is lost on restart. All production code runs in Cloud Functions (`functions/`).

---

## Dev vs. Production Code Paths

| | Dev (npm run dev) | Production (Firebase) |
|--|------------------|----------------------|
| API handler | `server/routes/*.ts` | `functions/src/routes/*.ts` |
| Data persistence | In-memory (lost on restart) | Firestore (permanent) |
| Auth | Firebase Auth (same) | Firebase Auth (same) |
| Storage | Firebase Storage (same) | Firebase Storage (same) |
| URL | http://localhost:5001 | https://api-b3rye3vhuq-uc.a.run.app |

---

## Feature Flags

There are no explicit feature flags (env vars like `FEATURE_X=true`) currently controlling behavior in the admin/products flow.

Behavior gates that exist in code (not env vars):
- **Autosave (Build+Save):** Always enabled. Not behind a flag.
- **Session commit:** Controlled by whether `state.activeSessionId` is set at save time — this is a runtime state condition, not a flag.
- **Store product link creation (legacy):** Runs if `selectedStore.id && selectedChannel.name` — a runtime condition.
- **Play mode:** Controlled by `state.qrProductState === "qr_play"` — a UI selection.

---

## Firebase Emulator

**Not in use.** This project connects directly to production Firebase for all environments. There is no emulator configuration active.

- `firebase.json` does not define an `emulators` block in use.
- All Firestore reads/writes in dev go to production Firestore.
- All Firebase Storage uploads in dev go to production Storage.

**Implication:** Dev testing affects production data. Be careful when creating test products in admin — they will appear in the live Firestore.

---

## App Check

**Status: Not confirmed active for CF.**
- Firebase App Check may be configured in the Firebase console, but is not enforced in Cloud Function middleware (`functions/src/middleware.ts`).
- The CF middleware uses `requireAuth` (verifies Firebase ID token) and `requireAdmin` (checks admin UID list). App Check is not a separate gate.
- If App Check enforcement is turned on in the Firebase console without corresponding CF enforcement, it will not block CF calls but may block client SDK calls.

---

## Delete Behavior

**Hard delete** throughout. No soft delete.

| Resource | Delete type | What happens |
|----------|------------|-------------|
| `admin_catalog_instances` doc | Hard delete | Firestore doc is permanently removed |
| `storeChannels` channel | Hard delete | Channel doc + all its catalog instances bulk-deleted |
| `storeProductLinks` collection entry | Hard delete | Link doc removed |
| `productPackets` | Not deleted on instance delete | Packets are orphaned but retained |
| Firebase Storage images | Not deleted on image doc delete | Storage files remain even if admin_images doc is removed |

---

## Autosave

There is no background autosave timer. "Autosave" in this codebase refers to the Build+Save button being a single press that does everything. The build session working state (`admin_build_sessions.working`) is updated during the session via PATCH calls when certain builder modules save their state (e.g. title/description edits may PATCH the session). The final packet+instance creation only happens on button press.

---

## Pricing Settings

Loaded via: `GET /api/admin/pricing-settings`
Stored in Firestore: `admin_settings` collection, a settings doc
Default values if doc missing:
- markupPercent: 25
- markupFixed: 0
- additionalPlacementCost: 2.50
- textLineUpcharge: 1.00
- hostingTiers: [{ code: "1_year", name: "1 Year", price: 0 }]

If pricing settings fail to load, `pricingSettings` is undefined, and Build+Save aborts at Step 1 with "Could not calculate pricing."
