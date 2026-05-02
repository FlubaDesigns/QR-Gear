/**
 * storefront-shared/buildProductGallery.ts
 *
 * Single canonical function that turns raw product API data into an ordered
 * StorefrontMediaItem[] for any storefront product gallery or card.
 *
 * Priority order:
 *   1. `mockupsByColor` for the selected color — color-reactive gallery
 *   2. API-provided `images[]` array — static fallback when no color mockups exist
 *   3. `imageUrl` + `packetImageUrl` as a 2-image final fallback
 *   4. Empty array (caller handles empty state)
 */

import type { StorefrontMediaItem } from './mediaTypes';

export interface ProductMediaSource {
  name?: string;
  /** Full ordered gallery array from API — primary source. May be strings or {url,alt} objects. */
  images?: Array<string | { url?: string; alt?: string }> | null;
  /** Single hero image — fallback when images[] is absent. */
  imageUrl?: string | null;
  /** Secondary image (packet QR graphic) — used only in fallback path. */
  packetImageUrl?: string | null;
  /** Color-keyed mockup data — used only if images[] is absent and a color is selected. */
  mockupsByColor?: Record<string, {
    front?: string;
    lifestyle?: string;
    angles?: string[];
  }> | null;
}

function normalizeImageUrl(item: string | { url?: string; alt?: string }): string | null {
  if (typeof item === 'string') return item || null;
  return item?.url || null;
}

/** Strip common color name prefixes and normalize to lowercase (e.g. "Solid Black" → "black"). */
function normalizeColorName(name: string): string {
  return name.replace(/^(Solid|Heather)\s+/i, '').toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Extract just the color portion from a compound key like "navy_large_front" → "navy".
 * Keys are stored as {color}_{size}_{placement} or just {color}.
 */
function extractColorFromKey(key: string): string {
  // Compound keys use underscores — the color is always the first segment
  return key.split('_')[0];
}

/**
 * Find and aggregate all mockup entries for a given color from a mockupsByColor map.
 *
 * Handles both simple keys ("navy", "Navy") and compound keys ("navy_large_front").
 * Aggregates multiple placement entries (front, back, sleeve) into a single result:
 *   - front  → the "front" placement image (hero)
 *   - lifestyle → lifestyle/model shot if present
 *   - angles → all non-front placement images (back, sleeve, etc.)
 */
function findColorMockup(
  mockupsByColor: Record<string, { front?: string; lifestyle?: string; angles?: string[]; placement?: string }>,
  targetColor: string | null | undefined,
): { front?: string; lifestyle?: string; angles?: string[] } | null {
  const keys = Object.keys(mockupsByColor);
  if (keys.length === 0) return null;

  // No color selected — return the first available entry
  if (!targetColor) {
    return mockupsByColor[keys[0]] ?? null;
  }

  const normalizedTarget = normalizeColorName(targetColor);

  // Collect all entries whose color portion matches the target
  const matches = keys.filter((key) => {
    const keyColor = normalizeColorName(extractColorFromKey(key));
    return keyColor === normalizedTarget;
  });

  // If no compound-key matches, try a full-key normalized match (simple keys like "Navy")
  if (matches.length === 0) {
    for (const key of keys) {
      if (normalizeColorName(key) === normalizedTarget) return mockupsByColor[key];
    }
    // Still nothing — fall back to first available entry
    return mockupsByColor[keys[0]] ?? null;
  }

  // Aggregate all matching placements into one result
  const aggregated: { front?: string; lifestyle?: string; angles: string[] } = { angles: [] };

  for (const key of matches) {
    const entry = mockupsByColor[key];
    const placement = entry.placement ?? (key.includes('_') ? key.split('_').pop() : 'front');
    const isFront = placement === 'front' || placement === 'front-center';

    if (entry.lifestyle && !aggregated.lifestyle) {
      aggregated.lifestyle = entry.lifestyle;
    }

    if (isFront && entry.front && !aggregated.front) {
      aggregated.front = entry.front;
    } else if (!isFront && entry.front) {
      aggregated.angles.push(entry.front);
    }
  }

  // If we collected anything, return it
  if (aggregated.front || aggregated.lifestyle || aggregated.angles.length > 0) {
    return aggregated;
  }

  return mockupsByColor[keys[0]] ?? null;
}

/**
 * Type sort order — lower index = shown first.
 * Lifestyle/model shots always lead; QR-only graphics always trail.
 */
const TYPE_ORDER: Record<string, number> = {
  lifestyle: 0,
  mockup:    1,
  gallery:   2,
  detail:    3,
  graphic:   4,
};

function sortByType(items: StorefrontMediaItem[]): StorefrontMediaItem[] {
  if (items.length <= 1) return items;
  return [...items].sort((a, b) => {
    const ra = TYPE_ORDER[a.type ?? 'gallery'] ?? 2;
    const rb = TYPE_ORDER[b.type ?? 'gallery'] ?? 2;
    return ra - rb;
  });
}

export function buildProductGallery(
  product: ProductMediaSource | null | undefined,
  selectedColor?: string | null,
): StorefrontMediaItem[] {
  if (!product) return [];

  const productName = product.name || 'Product';

  // ── Priority 1: mockupsByColor for the selected color ────────────────────
  // Lifestyle (model/glamour shot) is always pushed first, then front mockup.
  if (product.mockupsByColor && Object.keys(product.mockupsByColor).length > 0) {
    const mockup = findColorMockup(product.mockupsByColor, selectedColor);
    if (mockup) {
      const items: StorefrontMediaItem[] = [];
      if (mockup.lifestyle) items.push({ url: mockup.lifestyle, label: 'Lifestyle', alt: `${productName} — lifestyle`, type: 'lifestyle' });
      if (mockup.front)     items.push({ url: mockup.front,     label: 'Front',     alt: `${productName} — front`,     type: 'mockup'  });
      (mockup.angles || []).forEach((url, i) => {
        items.push({ url, label: `View ${i + 2}`, alt: `${productName} — angle ${i + 2}`, type: 'gallery' });
      });
      if (items.length > 0) return items;
    }
  }

  // ── Priority 2: API-provided images[] — fallback when no color mockups ───
  // Sort so that mockup/gallery images appear before QR-only graphics.
  if (product.images && product.images.length > 0) {
    const items: StorefrontMediaItem[] = [];
    product.images.forEach((item, i) => {
      const url = normalizeImageUrl(item);
      if (!url) return;
      // Heuristic: last image is often the QR graphic/composite; everything
      // else is treated as a product mockup or gallery shot.
      const isLastAndLikelyGraphic = i === product.images!.length - 1 && i > 0;
      items.push({
        url,
        alt: `${productName} — image ${i + 1}`,
        type: isLastAndLikelyGraphic ? 'graphic' : (i === 0 ? 'mockup' : 'gallery'),
      });
    });
    if (items.length > 0) return sortByType(items);
  }

  // ── Priority 3: single imageUrl + optional packetImageUrl ────────────────
  // packetImageUrl is the QR graphic — always trails the product mockup.
  const fallback: StorefrontMediaItem[] = [];
  if (product.imageUrl) {
    fallback.push({ url: product.imageUrl, alt: productName, type: 'mockup' });
  }
  if (product.packetImageUrl && product.packetImageUrl !== product.imageUrl) {
    fallback.push({ url: product.packetImageUrl, alt: `${productName} — graphic`, type: 'graphic' });
  }
  return fallback;
}
