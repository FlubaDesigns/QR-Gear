# Page layout audit — October 11, 2026

All 107 route entries (including redirects and the not-found route) inherit the single `PageSkeleton` mounted around `Router` in `App.tsx`. Loading, denied-access and error states cannot bypass the skeleton.

## CSS ownership

- `PageSkeleton` owns the canonical stage, main, main-inner and content slot, plus stylesheet order: master, fonts, buttons, forms, theme, site.
- `master.css` remains byte-for-byte upstream (Git blob `18a6aeb4e0bde8a88df0b46af9f8f871c06cd336`). Its rows, container-query column helpers and `--col-gap` own page structure. No replacement gutters or column CSS were introduced.
- Page and storefront components supply content; no nested page skeletons, site headers/footers or main landmarks.
- Marketing, shopping, account and admin page grids use Master helpers. Compact controls (size/color options, paired fields, QR previews, dialog contents and tabular data) keep their internal component layout; they do not define page columns.
- Admin routes retain their existing rail/bottom navigation and AdminShell content toolbar. Embedded widgets and scan viewers omit retail chrome while inheriting the same skeleton CSS and stage.
- Breadcrumbs live inside main. Storefront product, channel and collection views retain their semantic breadcrumbs; shop root and error/loading states use the shared trail.
- The desktop logo increase is preserved. The footer now uses the same Master row/split-4 columns, with compact desktop typography, internal spacing and transparent background; no footer column/gutter overrides.

## Verification

`npm run layout:verify` audits the shared routing boundary and every page/storefront source file, rejects legacy page containers or duplicate shells/main landmarks, checks CSS order, and pins the upstream Master blob. It runs before every production build. Frontend TypeScript and the production build pass.

Live verification is recorded with the deployment result. Source coverage includes protected routes; it does not imply every authenticated workflow or transaction was exercised.

## Route inventory

| Route | Source | Presentation within the shared skeleton |
|---|---|---|
| `/` | `client/src/pages/home.tsx` | Site header / footer |
| `/build` | `client/src/pages/build.tsx` | Site header / footer |
| `/store` | `client/src/pages/store.tsx` | Site header / footer |
| `/gallery` | `client/src/pages/gallery.tsx` | Site header / footer |
| `/cart` | `client/src/pages/cart.tsx` | Site header / footer |
| `/widget` | `client/src/pages/widget.tsx` | Embedded / scan viewer |
| `/account` | `client/src/pages/account.tsx` | Site header / footer |
| `/members` | `client/src/features/members/MembersPage.tsx` | Site header / footer |
| `/members/library` | `client/src/pages/member-library.tsx` | Site header / footer |
| `/member` | `client/src/pages/member.tsx` | Site header / footer |
| `/admin` | `client/src/pages/admin-run.tsx` | Admin navigation |
| `/admin/run` | `wouter Redirect` | Admin navigation |
| `/admin/dashboard` | `wouter Redirect` | Admin navigation |
| `/admin/ai-builder` | `client/src/pages/admin-ai-builder.tsx` | Admin navigation |
| `/admin/products` | `client/src/pages/admin-products.tsx` | Admin navigation |
| `/admin/pricing` | `client/src/pages/admin-pricing.tsx` | Admin navigation |
| `/admin/library` | `client/src/features/adminLibrary/LibraryPage.tsx` | Admin navigation |
| `/admin/videos` | `client/src/pages/admin-videos.tsx` | Admin navigation |
| `/admin/categories` | `client/src/pages/admin-categories.tsx` | Admin navigation |
| `/admin/tags` | `client/src/pages/admin-tags.tsx` | Admin navigation |
| `/admin/partners` | `client/src/pages/admin-partners.tsx` | Admin navigation |
| `/admin/orchestration` | `client/src/pages/admin-orchestration.tsx` | Admin navigation |
| `/admin/orders` | `client/src/pages/admin-orders.tsx` | Admin navigation |
| `/admin/gifts` | `client/src/pages/admin-gifts.tsx` | Admin navigation |
| `/admin/coupons` | `client/src/pages/admin-coupons.tsx` | Admin navigation |
| `/admin/health` | `client/src/pages/admin-health.tsx` | Admin navigation |
| `/admin/customers` | `client/src/pages/admin-customers.tsx` | Admin navigation |
| `/admin/email-templates` | `client/src/pages/admin-email-templates.tsx` | Admin navigation |
| `/admin/manual` | `client/src/pages/admin-manual.tsx` | Admin navigation |
| `/admin/settings` | `client/src/pages/admin-settings.tsx` | Admin navigation |
| `/admin/sales/build` | `client/src/pages/store-build.tsx` | Admin navigation |
| `/build/success` | `client/src/pages/build-success.tsx` | Site header / footer |
| `/earn` | `client/src/pages/earn.tsx` | Site header / footer |
| `/checkout` | `client/src/pages/checkout.tsx` | Site header / footer |
| `/customize` | `client/src/pages/customize.tsx` | Site header / footer |
| `/checkout/success` | `client/src/pages/checkout-success.tsx` | Site header / footer |
| `/renew/:instanceId` | `client/src/pages/renew.tsx` | Site header / footer |
| `/renew/:instanceId/success` | `client/src/pages/renew.tsx` | Site header / footer |
| `/claim/:claimCode` | `client/src/pages/claim.tsx` | Site header / footer |
| `/my-item/:instanceId` | `client/src/pages/my-item.tsx` | Site header / footer |
| `/view/:id` | `client/src/pages/view-image.tsx` | Embedded / scan viewer |
| `/dynamic/:slug` | `client/src/pages/view-dynamic.tsx` | Embedded / scan viewer |
| `/customs/:id` | `client/src/pages/customs.tsx` | Site header / footer |
| `/p/success` | `client/src/pages/packet-success.tsx` | Site header / footer |
| `/p/:id` | `client/src/pages/packet.tsx` | Site header / footer |
| `/play/:packetId` | `client/src/pages/play.tsx` | Embedded / scan viewer |
| `/QRG-:rest` | `client/src/pages/product-landing.tsx` | Embedded / scan viewer |
| `/i/:slug` | `client/src/pages/product-landing.tsx` | Embedded / scan viewer |
| `/e/:slug` | `client/src/pages/product-landing.tsx` | Embedded / scan viewer |
| `/m/:slug` | `client/src/pages/product-landing.tsx` | Embedded / scan viewer |
| `/gifts` | `client/src/pages/gift-shop.tsx` | Site header / footer |
| `/gift/redeem` | `client/src/pages/gift-redeem.tsx` | Site header / footer |
| `/gift/redeem/:code` | `client/src/pages/gift-redeem.tsx` | Site header / footer |
| `/creator/:creatorSlug/:channelId` | `client/src/pages/creator-surface.tsx` | Site header / footer |
| `/creator/:creatorSlug` | `client/src/pages/creator-surface.tsx` | Site header / footer |
| `/shop/product/:linkId` | `client/src/pages/shop-product.tsx` | Site header / footer |
| `/shop/:storeType/:storeName/:channel/:collection` | `client/src/pages/shop-segment.tsx` | Site header / footer |
| `/shop/:storeType/:storeName/:segment` | `client/src/pages/shop-segment.tsx` | Site header / footer |
| `/shop/:storeType/:storeName` | `client/src/pages/shop-segment.tsx` | Site header / footer |
| `/admin/launch` | `client/src/pages/admin-launch.tsx` | Admin navigation |
| `/admin/blanks` | `client/src/pages/admin-blanks.tsx` | Admin navigation |
| `/admin/marketplaces` | `client/src/pages/admin-marketplaces.tsx` | Admin navigation |
| `/admin/external-sites` | `client/src/pages/admin-external-sites.tsx` | Admin navigation |
| `/admin/store-builder` | `client/src/pages/admin-store-builder.tsx` | Admin navigation |
| `/admin/store-library` | `client/src/pages/admin-store-library.tsx` | Admin navigation |
| `/admin/ar-demo` | `client/src/pages/admin-ar-demo.tsx` | Admin navigation |
| `/admin/fonts` | `client/src/pages/admin-fonts.tsx` | Admin navigation |
| `/admin/schema-keys` | `client/src/pages/admin-schema-keys.tsx` | Admin navigation |
| `/login` | `client/src/pages/login.tsx` | Site header / footer |
| `/register` | `client/src/pages/register.tsx` | Site header / footer |
| `/qr-basics` | `client/src/pages/qr-basics.tsx` | Site header / footer |
| `/qr-plus` | `client/src/pages/qr-plus.tsx` | Site header / footer |
| `/qr-canvas` | `client/src/pages/qr-canvas.tsx` | Site header / footer |
| `/qr-play` | `client/src/pages/qr-play.tsx` | Site header / footer |
| `/qr-dynamics` | `client/src/pages/qr-dynamics.tsx` | Site header / footer |
| `/corporate-get-togethers` | `client/src/pages/qr-ideas.tsx` | Site header / footer |
| `/guerrilla-marketing` | `client/src/pages/qr-ideas.tsx` | Site header / footer |
| `/unique-qr-gifts` | `client/src/pages/qr-ideas.tsx` | Site header / footer |
| `/one-of-a-kind-qr-gifts` | `client/src/pages/qr-ideas.tsx` | Site header / footer |
| `/christmas-qr-gifts` | `client/src/pages/qr-ideas.tsx` | Site header / footer |
| `/qr-history` | `client/src/pages/qr-history.tsx` | Site header / footer |
| `/wedding-qr-shirts` | `client/src/pages/wedding-qr-shirts.tsx` | Site header / footer |
| `/family-reunion-shirts` | `client/src/pages/family-reunion-shirts.tsx` | Site header / footer |
| `/artist-qr-apparel` | `client/src/pages/artist-qr-apparel.tsx` | Site header / footer |
| `/memorial-qr-gifts` | `client/src/pages/memorial-qr-gifts.tsx` | Site header / footer |
| `/musician-merch` | `client/src/pages/musician-merch.tsx` | Site header / footer |
| `/website-qr-shirts` | `client/src/pages/website-qr-shirts.tsx` | Site header / footer |
| `/office-qr-mug` | `client/src/pages/office-qr-mug.tsx` | Site header / footer |
| `/lost-found-qr` | `client/src/pages/lost-found-qr.tsx` | Site header / footer |
| `/networking-qr-shirts` | `client/src/pages/networking-qr-shirts.tsx` | Site header / footer |
| `/medical-alert-qr` | `client/src/pages/medical-alert-qr.tsx` | Site header / footer |
| `/personal-items-qr` | `client/src/pages/personal-items-qr.tsx` | Site header / footer |
| `/event-qr-shirts` | `client/src/pages/event-qr-shirts.tsx` | Site header / footer |
| `/everyday-qr` | `client/src/pages/everyday-qr.tsx` | Site header / footer |
| `/business-qr-plus` | `client/src/pages/business-qr-plus.tsx` | Site header / footer |
| `/memorial-video-shirts` | `client/src/pages/memorial-video-shirts.tsx` | Site header / footer |
| `/family-video-messages` | `client/src/pages/family-video-messages.tsx` | Site header / footer |
| `/video-time-capsule` | `client/src/pages/video-time-capsule.tsx` | Site header / footer |
| `/advent-qr-shirts` | `client/src/pages/advent-qr-shirts.tsx` | Site header / footer |
| `/band-dynamic-merch` | `client/src/pages/band-dynamic-merch.tsx` | Site header / footer |
| `/realtor-qr-shirts` | `client/src/pages/realtor-qr-shirts.tsx` | Site header / footer |
| `/business-analytics-qr` | `client/src/pages/business-analytics-qr.tsx` | Site header / footer |
| `/logo-preview` | `client/src/pages/logo-preview.tsx` | Site header / footer |
| `/privacy` | `client/src/pages/privacy.tsx` | Site header / footer |
| `/terms` | `client/src/pages/terms.tsx` | Site header / footer |
| `/dev-auth` | `client/src/pages/dev-auth.tsx` | Site header / footer |
| `(not found)` | `client/src/pages/not-found.tsx` | Site header / footer |

Footer credit: “Powered by FlubaDesigns.com”, linked to https://flubadesigns.com.

Footer inset correction: the footer content panel uses `padding-inline: var(--col-gap)` because Master rows fill their parent and column gap does not create an outer content inset. Headings align left with their links. Master itself remains unchanged.


## Card-density review — October 11, 2026

Reviewed all 107 route entries and their page sources for repeated informational panels. Homepage is excluded from changes. The five new occasion pages, 21 older use-case pages, five QR type pages, QR History and Earn now use open sections or compact links for informational content. Account summary, member earnings summary, Admin Run metrics, Admin Orders metrics and Orchestration Profit metrics no longer put each number in a separate card.

Product/design galleries, independently selectable records, checkout/form groups, isolated status/error panels and workspace controls retain their functional grouping. This is a presentation review, not a claim of end-to-end authenticated or payment testing. All URLs, handlers, data reads and Master CSS are unchanged.

### Route review disposition

| Route | Card treatment |
|---|---|
| `/` | Homepage preserved |
| `/build` | Functional product/record/form/status grouping retained; no global card override |
| `/store` | Functional product/record/form/status grouping retained; no global card override |
| `/gallery` | Functional product/record/form/status grouping retained; no global card override |
| `/cart` | Functional product/record/form/status grouping retained; no global card override |
| `/widget` | Functional product/record/form/status grouping retained; no global card override |
| `/account` | Repeated decorative panels removed; functional controls retained |
| `/members` | Repeated decorative panels removed; functional controls retained |
| `/members/library` | Functional product/record/form/status grouping retained; no global card override |
| `/member` | Functional product/record/form/status grouping retained; no global card override |
| `/admin` | Repeated decorative panels removed; functional controls retained |
| `/admin/run` | Redirect; no page cards |
| `/admin/dashboard` | Redirect; no page cards |
| `/admin/ai-builder` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/products` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/pricing` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/library` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/videos` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/categories` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/tags` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/partners` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/orchestration` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/orders` | Repeated decorative panels removed; functional controls retained |
| `/admin/gifts` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/coupons` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/health` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/customers` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/email-templates` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/manual` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/settings` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/sales/build` | Functional product/record/form/status grouping retained; no global card override |
| `/build/success` | Functional product/record/form/status grouping retained; no global card override |
| `/earn` | Repeated decorative panels removed; functional controls retained |
| `/checkout` | Functional product/record/form/status grouping retained; no global card override |
| `/customize` | Functional product/record/form/status grouping retained; no global card override |
| `/checkout/success` | Functional product/record/form/status grouping retained; no global card override |
| `/renew/:instanceId` | Functional product/record/form/status grouping retained; no global card override |
| `/renew/:instanceId/success` | Functional product/record/form/status grouping retained; no global card override |
| `/claim/:claimCode` | Functional product/record/form/status grouping retained; no global card override |
| `/my-item/:instanceId` | Functional product/record/form/status grouping retained; no global card override |
| `/view/:id` | Functional product/record/form/status grouping retained; no global card override |
| `/dynamic/:slug` | Functional product/record/form/status grouping retained; no global card override |
| `/customs/:id` | Functional product/record/form/status grouping retained; no global card override |
| `/p/success` | Functional product/record/form/status grouping retained; no global card override |
| `/p/:id` | Functional product/record/form/status grouping retained; no global card override |
| `/play/:packetId` | Functional product/record/form/status grouping retained; no global card override |
| `/QRG-:rest` | Functional product/record/form/status grouping retained; no global card override |
| `/i/:slug` | Functional product/record/form/status grouping retained; no global card override |
| `/e/:slug` | Functional product/record/form/status grouping retained; no global card override |
| `/m/:slug` | Functional product/record/form/status grouping retained; no global card override |
| `/gifts` | Functional product/record/form/status grouping retained; no global card override |
| `/gift/redeem` | Functional product/record/form/status grouping retained; no global card override |
| `/gift/redeem/:code` | Functional product/record/form/status grouping retained; no global card override |
| `/creator/:creatorSlug/:channelId` | Functional product/record/form/status grouping retained; no global card override |
| `/creator/:creatorSlug` | Functional product/record/form/status grouping retained; no global card override |
| `/shop/product/:linkId` | Functional product/record/form/status grouping retained; no global card override |
| `/shop/:storeType/:storeName/:channel/:collection` | Functional product/record/form/status grouping retained; no global card override |
| `/shop/:storeType/:storeName/:segment` | Functional product/record/form/status grouping retained; no global card override |
| `/shop/:storeType/:storeName` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/launch` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/blanks` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/marketplaces` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/external-sites` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/store-builder` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/store-library` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/ar-demo` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/fonts` | Functional product/record/form/status grouping retained; no global card override |
| `/admin/schema-keys` | Functional product/record/form/status grouping retained; no global card override |
| `/login` | Functional product/record/form/status grouping retained; no global card override |
| `/register` | Functional product/record/form/status grouping retained; no global card override |
| `/qr-basics` | Repeated decorative panels removed; functional controls retained |
| `/qr-plus` | Repeated decorative panels removed; functional controls retained |
| `/qr-canvas` | Repeated decorative panels removed; functional controls retained |
| `/qr-play` | Repeated decorative panels removed; functional controls retained |
| `/qr-dynamics` | Repeated decorative panels removed; functional controls retained |
| `/corporate-get-togethers` | Repeated decorative panels removed; functional controls retained |
| `/guerrilla-marketing` | Repeated decorative panels removed; functional controls retained |
| `/unique-qr-gifts` | Repeated decorative panels removed; functional controls retained |
| `/one-of-a-kind-qr-gifts` | Repeated decorative panels removed; functional controls retained |
| `/christmas-qr-gifts` | Repeated decorative panels removed; functional controls retained |
| `/qr-history` | Repeated decorative panels removed; functional controls retained |
| `/wedding-qr-shirts` | Repeated decorative panels removed; functional controls retained |
| `/family-reunion-shirts` | Repeated decorative panels removed; functional controls retained |
| `/artist-qr-apparel` | Repeated decorative panels removed; functional controls retained |
| `/memorial-qr-gifts` | Repeated decorative panels removed; functional controls retained |
| `/musician-merch` | Repeated decorative panels removed; functional controls retained |
| `/website-qr-shirts` | Repeated decorative panels removed; functional controls retained |
| `/office-qr-mug` | Repeated decorative panels removed; functional controls retained |
| `/lost-found-qr` | Repeated decorative panels removed; functional controls retained |
| `/networking-qr-shirts` | Repeated decorative panels removed; functional controls retained |
| `/medical-alert-qr` | Repeated decorative panels removed; functional controls retained |
| `/personal-items-qr` | Repeated decorative panels removed; functional controls retained |
| `/event-qr-shirts` | Repeated decorative panels removed; functional controls retained |
| `/everyday-qr` | Repeated decorative panels removed; functional controls retained |
| `/business-qr-plus` | Repeated decorative panels removed; functional controls retained |
| `/memorial-video-shirts` | Repeated decorative panels removed; functional controls retained |
| `/family-video-messages` | Repeated decorative panels removed; functional controls retained |
| `/video-time-capsule` | Repeated decorative panels removed; functional controls retained |
| `/advent-qr-shirts` | Repeated decorative panels removed; functional controls retained |
| `/band-dynamic-merch` | Repeated decorative panels removed; functional controls retained |
| `/realtor-qr-shirts` | Repeated decorative panels removed; functional controls retained |
| `/business-analytics-qr` | Repeated decorative panels removed; functional controls retained |
| `/logo-preview` | Functional product/record/form/status grouping retained; no global card override |
| `/privacy` | Text document; no repeated cards |
| `/terms` | Text document; no repeated cards |
| `/dev-auth` | Functional product/record/form/status grouping retained; no global card override |
| `(not found)` | Functional product/record/form/status grouping retained; no global card override |
