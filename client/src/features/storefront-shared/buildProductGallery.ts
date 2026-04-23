/**
 * storefront-shared/buildProductGallery.ts
 *
 * Single canonical function that turns raw product API data into an ordered
 * StorefrontMediaItem[] for any storefront product gallery or card.
 *
 * Priority order:
 *   1. API-provided `images[]` array  ← primary source of truth
 *   2. `mockupsByColor` (color-specific mockup data, legacy)
 *   3. `imageUrl` + `packetImageUrl` as a 2-image fallback set
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

export function buildProductGallery(
  product: ProductMediaSource | null | undefined,
  selectedColor?: string | null,
): StorefrontMediaItem[] {
  if (!product) return [];

  const productName = product.name || 'Product';

  // ── Priority 1: API-provided images array ────────────────────────────────
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

  // ── Priority 2: mockupsByColor (color-keyed legacy data) ─────────────────
  const color = selectedColor || (product.mockupsByColor ? Object.keys(product.mockupsByColor)[0] : null);
  if (color && product.mockupsByColor?.[color]) {
    const m = product.mockupsByColor[color];
    const items: StorefrontMediaItem[] = [];
    if (m.lifestyle) items.push({ url: m.lifestyle, label: 'Lifestyle', alt: `${productName} — ${color} lifestyle`, type: 'lifestyle' });
    if (m.front)     items.push({ url: m.front,     label: 'Front',     alt: `${productName} — ${color} front`,     type: 'gallery'   });
    (m.angles || []).forEach((url, i) => {
      items.push({ url, label: `View ${i + 2}`, alt: `${productName} — ${color} angle ${i + 2}`, type: 'gallery' });
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
