/**
 * shopHierarchy.ts
 *
 * Single source of truth for the QR Gear store / channel / collection structure.
 *
 * Hierarchy:
 *   internal
 *   └── qrgear
 *       └── usa250
 *           ├── monuments
 *           ├── armed-forces
 *           └── founding-fathers
 *
 * Rules:
 *   storeType  = "internal"
 *   storeName  = URL slug (e.g. "qrgear")
 *   channel    = URL channel slug (e.g. "usa250")
 *   collection = URL collection slug (e.g. "armed-forces")
 *   segment    = legacy Firestore field value (e.g. "Armed Forces")
 *                — only used in the resolver bridge below, not in page logic.
 */

export interface CollectionConfig {
  slug: string;        // URL slug, e.g. "armed-forces"
  label: string;       // Display label, e.g. "Armed Forces"
  description: string;
  /** Firestore `segment` field value for this collection. Bridge layer only. */
  segmentValue: string;
}

export interface ChannelConfig {
  slug: string;        // URL channel slug, e.g. "usa250"
  label: string;       // e.g. "USA 250"
  intro: string;       // One-line tagline shown on the hub page
  description: string; // Longer description
  collections: CollectionConfig[];
}

export interface StoreConfig {
  storeType: "internal" | "external" | "member";
  storeName: string;   // URL slug used in routes, e.g. "qrgear"
  label: string;
  tagline: string;
  description: string;
  channels: ChannelConfig[];
}

// ── QR Gear store definition ─────────────────────────────────────────────────

export const QR_GEAR: StoreConfig = {
  storeType: "internal",
  storeName: "qrgear",
  label: "QR Gear",
  tagline: "Official QR-Powered Apparel & Accessories",
  description:
    "QR Gear is America's home for QR-powered apparel — wearable products embedded with scannable QR codes that connect to digital experiences.",
  channels: [
    {
      slug: "usa250",
      label: "USA 250",
      intro: "A tribute to the people, places, and principles that shaped America.",
      description:
        "Celebrating 250 years of American history, culture, and service. Wear the story.",
      collections: [
        {
          slug: "monuments",
          label: "Monuments",
          description:
            "Iconic landmarks and national monuments that define the American landscape.",
          segmentValue: "Monuments",
        },
        {
          slug: "armed-forces",
          label: "Armed Forces",
          description:
            "Honoring those who serve and have served to protect America's freedom.",
          segmentValue: "Armed Forces",
        },
        {
          slug: "founding-fathers",
          label: "Founding Fathers",
          description:
            "The visionaries who built a nation from a bold idea and relentless conviction.",
          segmentValue: "Founding Fathers",
        },
      ],
    },
  ],
};

// ── Registry & resolver helpers ──────────────────────────────────────────────

const STORE_REGISTRY: StoreConfig[] = [QR_GEAR];

/**
 * Look up a store config by URL slug. Handles both "qrgear" and "qr-gear" forms.
 */
export function getStoreConfig(storeName: string): StoreConfig | undefined {
  const normalized = storeName.replace(/-/g, "");
  return STORE_REGISTRY.find(
    (s) => s.storeName === storeName || s.storeName === normalized,
  );
}

export function getChannelConfig(
  storeName: string,
  channelSlug: string,
): ChannelConfig | undefined {
  return getStoreConfig(storeName)?.channels.find((c) => c.slug === channelSlug);
}

export function getCollectionConfig(
  storeName: string,
  channelSlug: string,
  collectionSlug: string,
): CollectionConfig | undefined {
  return getChannelConfig(storeName, channelSlug)?.collections.find(
    (c) => c.slug === collectionSlug,
  );
}

/**
 * Bridge: maps a URL collection slug → the Firestore `segment` field value.
 * Keeps legacy segment-based data translation out of page components.
 */
export function resolveSegmentFromCollection(
  storeName: string,
  channelSlug: string,
  collectionSlug: string,
): string | null {
  return (
    getCollectionConfig(storeName, channelSlug, collectionSlug)?.segmentValue ?? null
  );
}
