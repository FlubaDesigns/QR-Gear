/**
 * Legacy Compatibility Layer
 *
 * This module is the SINGLE source of truth for any backward-compat
 * mapping between old Firestore collection names / service names and
 * the canonical domain vocabulary.
 *
 * RULE: No new code should reference legacy names directly.
 * Instead, import the canonical constant from `./constants.ts`.
 *
 * ──────────────────────────────────────────────────────────────────
 * SERVICE AUDIT (last reviewed: 2026-04-08)
 * ──────────────────────────────────────────────────────────────────
 *
 * programService.ts
 *   STATUS:  REMOVED
 *   Superseded by mosaicService.ts which uses canonical vocabulary.
 *
 * channelItemsService.ts
 *   STATUS:  CANONICAL / ACTIVE
 *   Manages the `channel_items` Firestore collection. Not legacy —
 *   it uses `CHANNEL_ITEMS_COLLECTION` from constants and re-exports
 *   `PLATFORM_STORE_ID`. All callers import from this file.
 *
 * widget-auth.ts
 *   STATUS:  CANONICAL / ACTIVE
 *   Handles JWT minting/verification for the widget embed flow.
 *   Not legacy — the "widget" concept is an active product surface.
 *   All callers import from this file or via widget-token-generator.ts.
 *
 * domain-mappers.ts
 *   STATUS:  CANONICAL / ACTIVE
 *   `firestoreProgramToMosaic` renamed → `firestoreDocToMosaic`.
 *   The old name is re-exported as a deprecated alias for test compat.
 *
 * ──────────────────────────────────────────────────────────────────
 * FIRESTORE COLLECTION NAME MAPPING
 * ──────────────────────────────────────────────────────────────────
 *
 * All legacy Firestore collection names are confined to constants.ts.
 * Route files and service modules only use the named constant.
 *
 * Canonical Constant              → Firestore Name (legacy)
 * ─────────────────────────────────────────────────────────────
 * MOSAICS_COLLECTION              → 'site_programs'
 * MOSAIC_TEMPLATES_COLLECTION     → 'dynamicsCollections'
 * CHANNEL_ITEMS_COLLECTION        → 'channel_items'
 * CHANNEL_CONTENT_COLLECTION      → 'dynamicsChannelContent'
 * COLLECTION_ITEMS_COLLECTION     → 'dynamicsCollectionItems'
 * DYNAMICS_SURFACES_COLLECTION    → 'qrDynamicsSurfaces'
 * STORE_PRODUCT_LINKS_COLLECTION  → 'storeProductLinks'
 * PRODUCT_PACKETS_COLLECTION      → 'productPackets'
 *
 * Renaming the actual Firestore collections is OUT OF SCOPE.
 * The constant layer is the compatibility adapter.
 *
 * ──────────────────────────────────────────────────────────────────
 * DYNAMICS ROUTING CONSOLIDATION
 * ──────────────────────────────────────────────────────────────────
 *
 * dynamics-content.routes.ts
 *   Admin CRUD for channel content, collection items, collections,
 *   and dynamics surfaces. ACTIVE — not superseded.
 *
 * dynamics-v2.routes.ts
 *   Public-facing QR Dynamics v2: packet listing, instance management,
 *   preview, resolver, scan-to-reveal. ACTIVE — not superseded.
 *   Serves a DIFFERENT purpose than dynamics-content.routes.ts.
 *
 * Both route files are canonical and serve distinct domains.
 * No consolidation is needed — they were split intentionally.
 */

export {
  MOSAICS_COLLECTION,
  MOSAIC_TEMPLATES_COLLECTION,
  CHANNEL_ITEMS_COLLECTION,
  CHANNEL_CONTENT_COLLECTION,
  COLLECTION_ITEMS_COLLECTION,
  DYNAMICS_SURFACES_COLLECTION,
  STORE_PRODUCT_LINKS_COLLECTION,
  PRODUCT_PACKETS_COLLECTION,
  PLATFORM_STORE_ID,
} from './constants';

export type { ChannelItem, ChannelItemInput } from './channelItemsService';
export {
  getChannelItems,
  getChannelItem,
  upsertChannelItem,
  deactivateChannelItem,
  setChannelItemActive,
  updateChannelItemOrder,
  deriveChannelId,
  generateShareCaption,
} from './channelItemsService';

export type {
  WidgetTokenPayload,
  NormalizedWidgetPayload,
  MintTokenInput,
  ViewType,
  StoreOwner,
} from './widget-auth';
export {
  mintWidgetToken,
  verifyWidgetToken,
  signWidgetToken,
  normalizeWidgetPayload,
  createWidgetUrl,
  verifyKCServiceAuth,
  mintTokenInputSchema,
  widgetTokenSchema,
} from './widget-auth';

export {
  channelItemToArtifact,
  firestoreDocToStore,
  firestoreDocToChannel,
  firestoreDocToCollection,
  firestoreDocToMosaic,
  firestoreProgramToMosaic,
} from './domain-mappers';
