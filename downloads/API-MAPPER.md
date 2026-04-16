# QR Gear API Mapper & Firestore Collections Reference

**Last Updated:** February 16, 2026

---

## FIRESTORE COLLECTIONS (Canonical List)

These are the ONLY Firestore collections that should be used. Do NOT create new collections without updating this document.

### Core Product Data
| Collection | Purpose | Used By |
|---|---|---|
| `productPackets` | Product packet configs (single source of truth) | CF + Dev |
| `productTemplates` | Templates linked to packets, stores mockup results | CF + Dev |
| `productGraphics` | Canvas/graphic assets for products | CF + Dev |
| `products` | Base product catalog entries | CF + Dev |
| `productCategories` | Product category definitions | CF + Dev |
| `productCategoryMappings` | Product-to-category links | CF |
| `productVariants` | Product variant definitions | CF |

### Catalog & Fulfillment
| Collection | Purpose | Used By |
|---|---|---|
| `printifyBlueprints` | Synced Printify blueprint catalog | CF + Dev |
| `printify_providers` | Printify print provider data | CF |
| `printful_products` | Synced Printful product catalog | CF |
| `printful_variants` | Printful variant data | CF |
| `printify_printful_mapping` | Printify→Printful product ID mapping | CF + Dev |
| `canonicalPlacements` | Normalized placement definitions | CF |
| `catalogItemLinks` | Links between catalog items | CF + Dev |
| `catalogSyncs` | Catalog sync job status tracking | CF |

### Mockups
| Collection | Purpose | Used By |
|---|---|---|
| `mockup_jobs` | Queue of pending/processing/completed mockup jobs | CF + Dev |
| `mockup_cache` | Cached mockup results by blueprint+color+variant | CF + Dev |

### Store & Distribution
| Collection | Purpose | Used By |
|---|---|---|
| `stores` | Store definitions | CF + Dev |
| `partnerStores` | Partner store configs | CF + Dev |
| `storeChannels` | Channels within stores | CF + Dev |
| `storeProductLinks` | Links products to store channels | CF + Dev |
| `storeAllowedProducts` | Product visibility per store | CF + Dev |
| `storeChannelCollections` | Collections within channels | Dev |
| `storeChannelContent` | Content items in channels | Dev |
| `storeChannelProducts` | Products assigned to channels | Dev |
| `partnerStoreProducts` | Products in partner stores | CF |

### QR & Dynamics
| Collection | Purpose | Used By |
|---|---|---|
| `qr_dynamics_instances` | QR compose/dynamics instances | CF + Dev |
| `dynamicsCollections` | Mosaic template records (accessed via `MOSAIC_TEMPLATES_COLLECTION` constant) | CF + Dev |
| `dynamicsCollectionItems` | Items within dynamics collections | Dev |
| `dynamicsChannelContent` | Channel content for dynamics | Dev |
| `qrDynamicsSurfaces` | QR surface type definitions | Dev |
| `qrTemplates` | QR template configs | CF |
| `qrDesigns` | QR design entries | CF |

### Users & Auth
| Collection | Purpose | Used By |
|---|---|---|
| `users` | User profiles | CF + Dev |
| `member_profiles` | Member profile data | Dev |
| `memberEarnings` | Member earnings tracking | Dev |

### Member Content
| Collection | Purpose | Used By |
|---|---|---|
| `memberPackets` | Member-created packets | Dev |
| `memberProducts` | Member products | Dev |
| `memberTemplates` | Member templates | Dev |
| `memberGraphics` | Member graphic assets | Dev |
| `memberLibrary` | Member library items | Dev |
| `memberLibraryLinks` | Member library link items | Dev |

### Orders & Commerce
| Collection | Purpose | Used By |
|---|---|---|
| `orders` | Order records | CF |
| `orderItems` | Individual order line items | CF |
| `orders_public` | Public order view data | Dev |
| `cartItems` | Shopping cart items | CF |
| `temp_packets` | Temporary packets for guest checkout (24hr TTL) | Dev |

### Gifts & Coupons
| Collection | Purpose | Used By |
|---|---|---|
| `giftPackages` | Gift package definitions | CF |
| `giftCodes` | Gift redemption codes | CF |
| `claimCodes` | Product claim codes | CF |
| `claimedInstances` | Claimed product instances | CF |
| `coupons` | Discount coupons | CF |

### Library & Assets
| Collection | Purpose | Used By |
|---|---|---|
| `library_assets` | Admin library file assets | CF |
| `commonLibrary` | Shared library resources | Dev |
| `galleryItems` | Gallery display items | CF |
| `customDesigns` | Custom design entries | CF + Dev |

### Admin & Settings
| Collection | Purpose | Used By |
|---|---|---|
| `settings` | Global app settings | CF + Dev |
| `testSettings` | Test/debug settings | CF + Dev |
| `hostingTiers` | QR hosting tier pricing | CF |
| `pricingRules` | Pricing rule definitions | CF |
| `admin_shelf_groups` | Admin UI shelf groupings | CF |

### Email
| Collection | Purpose | Used By |
|---|---|---|
| `email_outbox` | NexusMail outbound queue | Dev |
| `email_templates` | Email template definitions | Dev |

### Analytics
| Collection | Purpose | Used By |
|---|---|---|
| `browsingHistory` | User browsing history | CF |

---

## API ROUTES

### Cloud Function (Production: `qrgear-c1ffd.web.app/api/...`)

Firebase Hosting rewrites `/api/**` → Cloud Function. The CF strips the `/api` prefix internally.

#### Admin Routes (require Firebase Auth Bearer token)

**Products & Catalog**
- `GET /admin/products` — List all products
- `POST /admin/products` — Create product
- `PUT /admin/products/:id` — Update product
- `DELETE /admin/products/:id` — Delete product
- `GET /admin/catalog/blueprints` — List Printify blueprints
- `GET /admin/catalog/blueprints/:id` — Get blueprint details
- `GET /admin/catalog/placements` — Get placement data
- `GET /admin/catalog/printful-products` — List Printful products
- `GET /admin/catalog/printful-status` — Printful sync status
- `GET /admin/catalog/sync-status` — Catalog sync status
- `POST /admin/catalog/sync` — Trigger Printify catalog sync
- `POST /admin/catalog/sync-printful` — Trigger Printful catalog sync
- `GET /admin/fulfillment-providers` — List fulfillment providers

**Packets (Product Configurations)**
- `GET /admin/packets` — List all packets
- `GET /admin/packets/:packetId` — Get single packet by ID
- `POST /admin/packets` — Create packet
- `PATCH /admin/packets/:packetId` — Update packet
- `DELETE /admin/packets/:packetId` — Delete packet (cascades)

**Templates**
- `GET /admin/templates` — List all templates
- `POST /admin/templates` — Create template
- `POST /admin/templates/full-save` — Create template + queue mockup jobs
- `PUT /admin/templates/:id` — Update template
- `DELETE /admin/templates/:id` — Delete template
- `GET /admin/templates/:templateId/mockups` — Get mockup job status

**Stores & Channels**
- `GET /admin/stores` — List stores
- `POST /admin/stores` — Create store
- `PUT /admin/stores/:storeId` — Update store
- `DELETE /admin/stores/:storeId` — Delete store
- `POST /admin/stores/:storeId/channels` — Create channel
- `DELETE /admin/stores/:storeId/channels/:channelId` — Delete channel
- `GET /admin/stores/:storeId/channels/:channelId/collections` — List collections
- `GET /admin/partner-stores` — List partner stores
- `POST /admin/partner-stores` — Create partner store
- `PUT /admin/partner-stores/:id` — Update partner store
- `DELETE /admin/partner-stores/:id` — Delete partner store
- `GET /admin/store-product-links` — List store-product links
- `POST /admin/store-product-links` — Create link
- `DELETE /admin/store-product-links/:linkId` — Delete link

**Mockups**
- `POST /admin/mockup/priority` — Generate priority mockup (synchronous)
- `POST /admin/mockup/queue-process` — Trigger background queue processing

**Library & Assets**
- `GET /admin/library` — List library assets
- `GET /admin/library/admin` — Admin library view
- `GET /admin/library/templates` — Library templates
- `POST /admin/library` — Upload library asset
- `DELETE /admin/library/:id` — Delete library asset
- `GET /admin/background-assets` — List background assets
- `POST /admin/background-assets` — Create background asset
- `DELETE /admin/background-assets/:id` — Delete background asset
- `GET /admin/gallery` — List gallery items
- `POST /admin/gallery` — Add gallery item
- `DELETE /admin/gallery/:id` — Delete gallery item

**Designs**
- `GET /admin/designs` — List designs
- `POST /admin/designs` — Create design
- `PUT /admin/designs/:id` — Update design
- `DELETE /admin/designs/:id` — Delete design

**Gifts & Coupons**
- `GET /admin/gift-packages` — List gift packages
- `POST /admin/gift-packages` — Create gift package
- `DELETE /admin/gift-packages/:id` — Delete gift package
- `GET /admin/gift-codes` — List gift codes
- `POST /admin/gift-codes` — Create gift code
- `DELETE /admin/gift-codes/:id` — Delete gift code
- `GET /admin/coupons` — List coupons
- `POST /admin/coupons` — Create coupon
- `DELETE /admin/coupons/:id` — Delete coupon

**Settings & Admin**
- `GET /admin/settings` — Get app settings
- `POST /admin/settings` — Update settings
- `GET /admin/hosting-tiers` — List hosting tiers
- `POST /admin/hosting-tiers` — Create hosting tier
- `DELETE /admin/hosting-tiers/:id` — Delete hosting tier
- `GET /admin/pricing-rules` — List pricing rules
- `POST /admin/pricing-rules` — Create pricing rule
- `DELETE /admin/pricing-rules/:id` — Delete pricing rule
- `GET /admin/product-categories` — List categories
- `POST /admin/product-categories` — Create category
- `DELETE /admin/product-categories/:id` — Delete category
- `GET /admin/build-shelf` — Get shelf data
- `POST /admin/build-shelf` — Create shelf item
- `DELETE /admin/build-shelf/:id` — Delete shelf item
- `GET /admin/shelf-groups` — List shelf groups
- `POST /admin/shelf-groups` — Create shelf group
- `DELETE /admin/shelf-groups/:id` — Delete shelf group

**QR Templates**
- `GET /admin/qr-templates` — List QR templates
- `POST /admin/qr-templates` — Create QR template
- `DELETE /admin/qr-templates/:id` — Delete QR template

#### Auth Routes (require Firebase Auth)
- `GET /designs` — User's designs
- `POST /designs` — Create design
- `DELETE /designs/:id` — Delete design
- `GET /cart` — Get cart
- `POST /cart` — Add to cart
- `DELETE /cart/:id` — Remove from cart

#### Member Routes (no admin auth required)
- `GET /members/allowed-products` — Get member-allowed products with pricing from `storeAllowedProducts/member-products` + `printifyPrintProviders` cost lookup + `testSettings/pricing` markup

#### Public Routes (no auth)
- `GET /public/packets/:packetId` — Get packet (public view)
- `GET /public/products` — List published products
- `GET /public/products/:id` — Get product detail
- `POST /public/checkout` — Stripe checkout
- `POST /orders/webhook` — Stripe webhook

#### File Proxy
- `GET /library-files/:filename` — Proxy library files from Firebase Storage

---

## KEY FIELD MAPPING

### Product ID Fields
| Field | Context | Meaning |
|---|---|---|
| `blueprintId` | Printify products | Printify catalog blueprint ID (e.g., 5 = Unisex T-shirt) |
| `productId` | Printful products | Printful catalog product ID (e.g., 71 = Bella Canvas 3001) |
| `printProviderId` | Printify products | Printify print provider ID (e.g., 99 = Textbook Tees) |

### Fulfillment Provider Logic
When `fulfillmentProvider === 'printful'`:
- `productId` = Printful product ID (used for mockup generation)
- `blueprintId` may be 0 or null (not relevant)

When `fulfillmentProvider === 'printify'`:
- `blueprintId` = Printify blueprint ID (needs mapping to Printful for mockups)
- `printProviderId` = Printify print provider ID

### Mockup Resolution
- Template-based: Queue processor reads from `productTemplates` doc
- For Printful: uses `template.productId` as the Printful product ID
- For Printify: uses `template.blueprintId`, maps via `printify_printful_mapping` or `DEFAULT_BLUEPRINT_MAPPINGS`

---

## COLLECTION NAMING RULES

1. Use `camelCase` for Firestore collection names (e.g., `productPackets`, `storeChannels`)
2. Exception: Legacy collections use `snake_case` (e.g., `mockup_jobs`, `mockup_cache`, `printify_printful_mapping`)
3. Do NOT create duplicate collections (e.g., don't create both `packets` and `productPackets`)
4. Always check this document before creating new collections
