# Wizard Flow — QR Gear Member Creation

**Last updated**: March 2026

## Wizard Tiers (Progressive Unlock)

| Tier | Availability | Description |
|------|-------------|-------------|
| **SuperSimple** | Immediately | Card-based tutorial experience with "Blackboard" explainer cards |
| **Simple** | Immediately | Standard step-by-step guided experience |
| **Advanced** | After 1st publish | Dense 8-step builder with full control (Quick Start resume, font size slider, vertical offset, placement coordinates) |
| **Studio** | After 2nd publish | Streamlined "Quick Publish" for experienced creators |

Unlock tracking: `localStorage` key `publish_count_{userId}`. Unlock banners shown in `MembersPage.tsx`.

---

## Unauthenticated (Guest-First) Flow

Users can launch the wizard without logging in and design their entire product:

1. Select product, color, size
2. Choose QR type and configure content
3. Upload video / enter URL / pick background

**Sign-in gate** triggers at the transition from preview to mockup generation (not at publish time). This ensures the user has invested effort before being asked for credentials.

**Post-auth flow**: After sign-in/sign-up, the system creates a real channel from the temp-channel, uploads any pending video file, then advances to mockup generation with real credentials.

**If user closes without signing in**: An explanatory card appears on the dashboard explaining that an account is needed to save work, generate mockups, and access the dashboard. A "Back to Creator" button returns to the wizard.

---

## SuperSimple Wizard Steps (SIMPLE_WIZARD_STEPS)

| Step | ID | Action |
|------|----|--------|
| 1 | channel | Choose or create a storefront channel |
| 2 | product | Select base product (via TierPickerStep — Good/Better/Best or flat list) |
| 3 | product-congrats | Displays potential earnings |
| 4 | color | Choose product color |
| 5 | size | Pick size |
| 6 | type | Choose QR type (Basic, Plus, Canvas, Play, Compose) |
| 7 | placement-count | Choose placements |
| 8 | graphic-size | Set graphic size |
| 9 | generate | Header/Footer? Yes/No fork |

Then branches by QR type:

---

### QR Basic (QR_BASIC_STEPS)

| Step | ID | Action |
|------|----|--------|
| 10 | qr-basic-type | Choose: URL or Text |
| 11 | qr-basic-input | Enter URL (500 chars) or Text (2000 words) |
| 12 | qr-basic-mockup | Generate QR code + Printful mockup |
| 13 | qr-basic-save-choice | Save: Item only, Graphic only, or Both |
| 14 | qr-basic-confirm | Confirmation + ShareKitHandoff |

---

### QR Plus (QR_PLUS_STEPS)

| Step | ID | Action |
|------|----|--------|
| 10 | text-choice | Text layout (header/footer/both) |
| 11 | text-edit | Edit header/footer text with TextStyleEditor |
| 12 | qr-plus-url | Enter destination URL |
| 13 | qr-plus-preview | Preview styled landing page |
| 14 | qr-plus-mockup | Generate mockup |
| 15 | qr-plus-confirm | Confirmation + ShareKitHandoff |

---

### QR Canvas (default flow)

| Step | ID | Action |
|------|----|--------|
| 10 | text-choice | Text layout (header/footer/both) |
| 11 | text-edit | Edit header/footer text |
| 12 | url-explainer | Explainer (QR scan → landing page) |
| 13 | url-source-choice | Upload or Library |
| 14 | url-library-pick | Pick background image |
| 15 | url-details | Title & Description |
| 16 | url-preview | Preview landing page |
| 17 | url-publish | Publish |

---

### QR Play (QR_PLAY_STEPS)

| Step | ID | Action |
|------|----|--------|
| 10 | play-source | Choose video source (upload or URL) |
| 11 | play-upload | Upload video file or enter video URL |
| 12 | play-details | Title & Description |
| 13 | play-preview | Preview video landing page |
| 14 | play-publish | Publish |

---

### QR Compose (QR_COMPOSE_STEPS)

| Step | ID | Action |
|------|----|--------|
| 10 | compose-hosting | Select hosting tier |
| 11 | compose-domain | Configure domain/subdomain |
| 12 | compose-mockup | Generate mockup |
| 13 | compose-confirm | Confirmation + ShareKitHandoff |

---

## Sign-In Gate Details

- Component: `WizardSignInGate` (rendered inside `SuperSimpleWizard.tsx`)
- State: `showSignInToPublish` controls display
- Trigger points: `play-preview`, `url-preview`, or `compose-hosting` → mockup transition
- Message: "Your creation is ready! Create a free account to publish it."
- Post-auth: creates real channel + uploads pending video → `handleSimpleNext()` → mockup with real credentials → publish

## Key Files

| File | Purpose |
|------|---------|
| `client/src/features/members/SuperSimpleWizard.tsx` | SuperSimple wizard UI + sign-in gate |
| `client/src/features/members/WizardContext.tsx` | Shared wizard state + save logic |
| `client/src/features/members/MembersPage.tsx` | Tier routing + unlock banners |
| `client/src/features/shared/components/wizardSteps/wizardTypes.ts` | Step ID definitions + sequences |
| `client/src/features/shared/components/wizardSteps/PlaySteps.tsx` | QR Play step components |
| `client/src/features/shared/components/wizardSteps/ProductSteps.tsx` | Product picker + TierPickerStep |
