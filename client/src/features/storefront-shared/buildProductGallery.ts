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

/** Strip common color name prefixes for fuzzy matching (e.g. "Solid Black" → "black"). */
function normalizeColorName(name: string): string {
  return name.replace(/^(Solid|Heather)\s+/i, '').toLowerCase().trim();
}

/**
 * Find the best mockup entry for a given color from a mockupsByColor map.
 * Tries exact match first, then normalized (prefix-stripped) match, then any available.
 */
function findColorMockup(
  mockupsByColor: Record<string, { front?: string; lifestyle?: string; angles?: string[] }>,
  targetColor: string | null | undefined,
): { front?: string; lifestyle?: string; angles?: string[] } | null {
  if (!targetColor) {
    const firstKey = Object.keys(mockupsByColor)[0];
    return firstKey ? mockupsByColor[firstKey] : null;
  }

  if (mockupsByColor[targetColor]) return mockupsByColor[targetColor];

  const normalizedTarget = normalizeColorName(targetColor);
  for (const [key, val] of Object.entries(mockupsByColor)) {
    if (normalizeColorName(key) === normalizedTarget) return val;
  }

  const firstKey = Object.keys(mockupsByColor)[0];
  return firstKey ? mockupsByColor[firstKey] : null;
}

export function buildProductGallery(
  product: ProductMediaSource | null | undefined,
  selectedColor?: string | null,
): StorefrontMediaItem[] {
  if (!product) return [];

  const productName = product.name || 'Product';

  // ── Priority 1: mockupsByColor for the selected color ────────────────────
  // This is what makes the gallery react to color changes.
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
  if (product.images && product.images.length > 0) {
    const items: StorefrontMediaItem[] = [];
    product.images.forEach((item, i) => {
      const url = normalizeImageUrl(item);
      if (!url) return;
      items.push({
        url,
        alt: `${productName} — image ${i + 1}`,
        type: i === 0 ? 'mockup' : 'gallery',
      });
    });
    if (items.length > 0) return items;
  }

  // ── Priority 3: single imageUrl + optional packetImageUrl ────────────────
  const fallback: StorefrontMediaItem[] = [];
  if (product.imageUrl) {
    fallback.push({ url: product.imageUrl, alt: productName, type: 'mockup' });
  }
  if (product.packetImageUrl && product.packetImageUrl !== product.imageUrl) {
    fallback.push({ url: product.packetImageUrl, alt: `${productName} — graphic`, type: 'graphic' });
  }
  return fallback;
}
