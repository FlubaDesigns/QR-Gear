# QR Gear — Production Inventory
  Generated: Thu, 23 Apr 2026 14:16:38 GMT
  Project: qrgear-c1ffd  |  Domain: qrgear.com  |  Region: us-central1

  ---

  ## 1. Firebase Hosting

  | Property | Value |
  |---|---|
  | Project | qrgear-c1ffd |
  | Hosting URL | https://qrgear-c1ffd.web.app |
  | Custom Domain | https://qrgear.com |
  | Framework | React + Vite (SPA) |
  | Public dir | dist/public |
  | Rewrites | All non-file routes → /index.html |

  ---

  ## 2. Cloud Functions

  Single Gen-2 Cloud Function (Express app, all routes bundled):

  | Property | Value |
  |---|---|
  | Function name | api |
  | Runtime | Node.js 20 |
  | Entry point | api |
  | Region | us-central1 |
  | Status | ACTIVE |
  | Deployment | Generation 149 |
  | Last deployed | 2026-04-23T07:37:58Z |
  | Trigger | HTTPS (public) |
  | Internal URL | https://api-b3rye3vhuq-uc.a.run.app |
  | Public URL prefix | https://qrgear.com/api/* |
  | Memory | 1024 Mi |
  | CPU | 1 vCPU |
  | Timeout | 540 s |
  | Max instances | 20 |
  | Concurrency | 80 per instance |
  | Traffic | 100% → latest revision |

  ### API Route Modules (functions/src/routes/)

  | File | Purpose |
  |---|---|
  | admin-build-sessions.ts | Admin wizard build session management |
  | admin-catalog-instances.ts | Admin catalog instance CRUD |
  | admin-misc.ts | Admin miscellaneous utilities |
  | admin-orders.ts | Order management (admin) |
  | admin-products.ts | Admin product CRUD |
  | admin-settings.ts | Platform and test settings |
  | admin-stores.ts | Store configuration (admin) |
  | am-crud.ts | Asset/media CRUD |
  | am-sync.ts | Asset/media sync jobs |
  | am-utility.ts | Asset/media utility endpoints |
  | amazon-oauth.ts | Amazon seller OAuth flow |
  | auth.ts | Authentication endpoints |
  | brain.ts | AI/orchestration intelligence layer |
  | catalog.ts | Product catalog endpoints |
  | categories.ts | Category management |
  | checkout.ts | Checkout + cart flow |
  | claims.ts | Claim code redemption |
  | core-routes.ts | Core product display routes |
  | core-routes-checkout.ts | Core checkout routes |
  | designs.ts | Custom design endpoints |
  | dynamics.ts | QR Dynamics instance management |
  | ebay-oauth.ts | eBay seller OAuth flow |
  | etsy-oauth.ts | Etsy OAuth 2.0 PKCE flow |
  | external-sites.ts | External site embed management |
  | external-sites-public.ts | Public external site serving |
  | file-routes.ts | File upload/download routes |
  | gifts.ts | Gift/claim code generation |
  | images.ts | Admin image library |
  | marketplace.ts | Marketplace listing push (Amazon/eBay/Etsy) |
  | master-catalog.ts | Master product catalog sync |
  | member-catalog-instances.ts | Member catalog instance endpoints |
  | member-files.ts | Member file storage |
  | members-library.ts | Member asset library |
  | members.ts | Member profile management |
  | mockup-routes.ts | Mockup generation + cache |
  | orchestration.ts | Build orchestration + pricing |
  | packets.ts | Product packet (QR product) CRUD |
  | partner.ts | Partner store endpoints |
  | pp-builder.ts | Printify product builder |
  | pp-catalog.ts | Printify catalog sync |
  | pp-catalog-browse.ts | Printify catalog browse |
  | pp-pricing-packets.ts | Printify pricing + packet builder |
  | print-placements.ts | Print placement management |
  | products-page.ts | Products page data |
  | public.ts | Public-facing endpoints (storefront) |
  | public-stores.ts | Public store pages |
  | referral.ts | Referral system |
  | seo.ts | SEO sitemap/meta generation |
  | store-files.ts | Store file serving + product data |
  | stripe-webhooks.ts | Stripe webhook handler |
  | tiers.ts | Membership tier logic |
  | widget.ts | Embeddable widget endpoints |

  ---

  ## 3. Firestore Collections (54 total)

  | Collection | Doc Count | Sample Fields |
  |---|---|---|
| `admin_build_sessions` | 10 | sessionType, sourceMasterId, ownerAdminId, catalogId, generated, expiresAt, committedInstanceId, createdAt, draftName, lastActiveAt, working, status, updatedAt |
| `admin_build_shelf` | 19 | providerId, catalogId, catalog, groupIds, createdAt, updatedAt, shelfKey |
| `admin_catalog_instances` | 2 | instanceType, sourceMasterId, sourceSessionId, catalogId, ownerAdminId, baseSnapshot, overrides, resolved, currentPacketId, currentTemplateId, currentGraphicSetId, storeId, storeName, channelId, channelName, collectionId, collectionName, folderPath, status, createdAt, updatedAt |
| `admin_image_folders` | 1 | name, normalizedName, createdAt |
| `admin_images` | 10 | name, folder, mimeType, sizeBytes, storageUrl, publicUrl, createdAt, isActive, updatedAt |
| `admin_shelf_groups` | 3 | name, sortOrder, createdAt, updatedAt |
| `backgroundAssets` | 34 | isActive, storagePath, name, sourceAssetId, imageUrl, assetType, mimeType, tags, cropData, createdAt |
| `catalogSyncs` | 11 | syncType, status, productsCount, startedAt |
| `catalogs` | 2 | name, description, createdAt, blankIds, blankImages, blankTitles, blankDescriptions, blankTiers, updatedAt |
| `categories` | 7 | name, slug, description, icon, sortOrder, isActive, createdAt, updatedAt |
| `channels` | 4 | name, storeId, ownerId, type, createdAt, updatedAt |
| `claimCodes` | 1 | claimCode, templateId, packetType, productName, productDescription, status, buyerEmail, source, orderId, qrgId, createdAt |
| `config` | 1 | fonts, updatedAt |
| `costSyncs` | 1000+ | status, totalProviders, id, startedAt, failedCount, processedCount, successCount, skippedCount, lastProcessedProviderId |
| `customDesigns` | 1 | printReadyArtUrl, publishError, templateSubcategory, dynamicContentSetId, templateVariant, placements, bottomText, productName, createdAt, graphicsConfig, defaultColor, productImage, mockupsByColor, segment, landingOverlay, printifyProductId, storeName, id, isFeatured, publishStatus, savedToStore, externalUrl, textUpcharge, storeType, productId, backgroundAssetId, placementConfigs, topText, blueprintId, templateCategory, savedToLibrary, templateName, ownerUserId, selectedColors, printProviderId, projectName, campaignName, isSeasonalPromo, selectedVariantIds, backgroundImageUrl, placementImages, qrCodeUrl, printifyCompositeUrl, updatedAt |
| `dynamicsCollectionItems` | 1 | collectionId, contentId, contentType, name, url, thumbnailUrl, order, addedAt, rotationInterval, updatedAt |
| `dynamicsCollections` | 3 | storeId, channelId, name, createdAt, updatedAt |
| `libraryAssets` | 264 | name, thumbnailUrl, assetType, mediaType, ownerType, userId, category, tags, season, event, id, createdAt, usageCount |
| `library_assets` | 99 | ownerType, assetType, mediaType, name, fileName, originalName, mimeType, sizeBytes, storageUrl, publicUrl, isActive, sourceAssetId, createdAt, updatedAt |
| `master_catalog` | 1000+ | title, description, brand, images, colors, sizes, originCountry, printifyBlueprintId, printfulProductId, minPrice, maxPrice, lastSyncedAt, updatedAt, createdAt, category, qrgCategory, qrgId, qrgSequence |
| `master_catalog_syncs` | 1 | status, created, updated, matched, printifyOnly, printfulOnly, startedAt, completedAt |
| `master_products` | 1000+ | id, providers, fulfillmentProvider, printifyId, printfulId, title, description, brand, model, imageUrl, madeInUSA, minPrice, maxPrice, availableColors, availableSizes, colorCount, category, blueprintId, printProviderId, availableVia, lastSyncedAt |
| `memberGraphics` | 1 | graphicsId, packetId, memberId, compositeUrl, qrOnlyUrl, status, createdAt |
| `memberLibrary` | 43 | memberId, assetType, mediaType, name, fileName, originalName, storageUrl, publicUrl, mimeType, sizeBytes, isActive, isCropped, createdAt, originalAssetId |
| `memberLibraryLinks` | 2 | libraryLinkId, packetId, templateId, memberId, compositeUrl, qrOnlyUrl, boundProduct, metadata, status, shareUrl, createdAt |
| `memberPackets` | 153 | packetId, memberId, kind, urlContent, background, textLayers, boundProduct, metadata, source, createdAt, graphicsId, templateId, libraryLinkId, status, updatedAt |
| `memberTemplates` | 1 | templateId, packetId, memberId, kind, compositeUrl, titleText, descriptionText, background, textLayers, metadata, createdAt |
| `member_profiles` | 1 | isMember, userId, useCase, fullName, creatorSlug, storeName, productInterests, country, socialSurfaces, memberSince, attributionSource, primarySocial, socialHandle, updatedAt |
| `mockupCache` | 1 | blueprintId, colorName, artworkVariant, mockupUrl, lifestyleMockupUrl, status, generatedAt |
| `mockup_cache` | 71 | blueprintId, colorName, artworkVariant, mockupUrl, lifestyleMockupUrl, status, generatedAt |
| `mockup_jobs` | 336 | templateId, colorName, colorHex, placement, qrSize, fulfillmentProvider, createdAt, processorId, startedAt, failedAt, error, status |
| `partnerStoreProducts` | 3 | storeId, productId, createdAt |
| `partnerStores` | 1 | name, slug, isInternal, availableSegments, createdAt, isActive, updatedAt |
| `print_placements` | 9 | internalName, displayName, description, dimensions, providers, sortOrder, isActive, createdAt, updatedAt |
| `printfulCatalog` | 465 | image, isAvailable, description, model, id, category, title, type, brand, variantCount, minPrice, lastSyncedAt, maxPrice |
| `printfulProducts` | 466 | image, description, modelImages, title, type, colors, lifestyleImages, variantCount, sizes, fulfillmentProvider, isEnabled, model, id, brand, techniques, placements, syncedAt |
| `printful_products` | 466 | image, lastSyncedAt, typeName, title, type, variantCount, avgFulfillmentTime, minPrice, originCountry, currency, isDiscontinued, model, id, maxPrice, brand, availableColors, availableSizes |
| `printful_variants` | 1000+ | image, color, productId, lastSyncedAt, colorCode2, size, price, name, colorCode, inStock, availabilityStatus, id, updatedAt |
| `printifyBlueprints` | 291 | id, title, brand, model, images, description, createdAt, updatedAt, primaryImageUrl, category, syncedAt |
| `printifyPrintProviders` | 660 | availableColors, isUSA, lastSyncedAt, availableSizes, placeholderProductId, title, blueprintId, providerId, maxCost, id, minCost, costsFetchedAt, syncedAt, country |
| `printify_blueprints` | 1000+ | images, primaryImageUrl, description, model, id, title, brand, richDescription, lastSyncedAt |
| `printify_printful_mapping` | 141 | printifyBlueprintId, printifyBrand, printifyModel, printfulProductId, printfulBrand, printfulModel, matchConfidence, isActive, createdAt, updatedAt |
| `productPackets` | 3 | headerText, footerText, pricing, productId, productName, productDescription, productImageUrl, blueprintId, printProviderId, manufacturer, madeInUSA, category, defaultColor, defaultColorHex, defaultPlacement, qrProductState, placements, availablePlacements, sizes, colors, basePrice, customerPrice, mockupsByColor, landingPageTitle, landingPageDescription, landingPageBackgroundUrl, landingPageSlug, headerStyle, footerStyle, roleType, storeId, storeName, channelId, channelName, fulfillmentProvider, playMediaUrl, playMediaType, createdAt, qrContent, landingPageSnapshotUrl, qrOnlyUrl, productGraphicUrl, compositeUrl, buildSessionId, sourceMasterId, ownerType, sourceAdminInstanceId, ownerInstanceId, priorityMockupUrl, updatedAt |
| `productTemplates` | 5 | name, description, category, productId, blueprintId, printProviderId, fulfillmentProvider, artworkUrl, artworkVariant, thumbnailUrl, qrContent, pricing, packetId, graphicLayoutMode, qrSizePercent, qrPositionX, qrPositionY, productName, headerText, footerText, headerStyle, footerStyle, subBottomEnabled, subBottomText, subBottomFontFamily, subBottomFontSize, subBottomFontWeight, subBottomColor, backgroundUrl, qrProductState, areaImageUrl, areaImageMode, areaImageOffsetX, areaImageOffsetY, areaImageScale, placements, placementMethods, createdAt, updatedAt |
| `products` | 631 | markupFixed, availableColors, description, manufacturer, productLine, createdAt, defaultColor, markupPercent, qrProductionCost, mockupsByColor, imageUrl, id, isFeatured, basePrice, printifyId, availableSizes, blueprintId, customerPrice, availablePlacements, defaultPlacement, sortOrder, name, printProviderId, category, madeInUSA, metadata, isEnabled, updatedAt |
| `qr_dynamics_instances` | 5 | memberId, packetId, createdAt, startTimestamp, mode, composeMode, hostingTerm, fallbackUrl, slots |
| `storeAllowedProducts` | 1 | storeId, products, updatedAt |
| `storeChannels` | 1 | name, storeId, isActive, productCount, createdAt |
| `storeProductLinks` | 37 | storeId, storeName, channel, packetId, templateId, graphicsId, qrContent, productName, compositeUrl, qrOnlyUrl, pricing, enabledColors, enabledSizes, selectedGraphicSize, defaultColor, createdAt, updatedAt |
| `stores` | 3 | name, roleType, isActive, channelCount, createdAt |
| `systemSettings` | 2 | member, public, external, platform, updatedAt |
| `system_config` | 1 | printfulUpdatedAt, printfulApiKey |
| `testSettings` | 1 | additionalPlacementCost, markupFixed, markupPercent, hostingTiers, textLineUpcharge, updatedAt |
| `users` | 2 | isAdmin, email |

  ---

  ## 4. Firestore Security Rules

  Location: `firestore.rules`
  Rules cover: users (owner read), members (owner read/write), productPackets (owner + admin), stores/channels (admin-only write), storeProductLinks (admin write + public read for active), master_catalog + products (public read), admin_* collections (admin-only), systemSettings (admin write + public read for public doc).

  ---

  ## 5. Firebase Storage Rules

  Location: `storage.rules`
  Rules cover: authenticated uploads to user-specific paths, public read for finalized assets, admin paths restricted to verified admin tokens.

  ---

  ## 6. Firestore Indexes

  Location: `firestore.indexes.json`
  11 composite indexes covering: memberPackets (memberId+createdAt), products (isEnabled+sortOrder+isFeatured), storeProductLinks (storeId+channel), mockup_jobs (status+createdAt), libraryAssets (ownerType+category+createdAt), and related query patterns.

  ---

  *End of production inventory.*
  