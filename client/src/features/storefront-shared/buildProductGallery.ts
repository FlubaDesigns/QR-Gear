import { normalizeMockupColorKey } from '@shared/colorUtils';
/**
 * storefront-shared/buildProductGallery.ts
 *
 * Single canonical function that turns raw product API data into an ordered
 * StorefrontMediaItem[] for any storefront product gallery or card.
 *
 * Priority order:
 *   1. `mockupsByColor` for the selected color — color-reactive gallery
 *   2. Remaining API-provided `images[]` — generated artwork and proofs stay visible
 *   3. `imageUrl` + `packetImageUrl` as a 2-image final fallback
 *   4. Empty array (caller handles empty state)
 */

import type { StorefrontMediaItem } from './mediaTypes';

export interface ProductMediaSource {
  name?: string;
  qrProductType?: string | null;
  playMediaUrl?: string | null;
  landingPageSnapshotUrl?: string | null;
  qrCodeUrl?: string | null;
  compositeUrl?: string | null;
  /** Full ordered gallery array from API — primary source. May be strings or {url,alt} objects. */
  images?: Array<string | { url?: string; alt?: string }> | null;
  /** Single hero image — fallback when images[] is absent. */
  imageUrl?: string | null;
  /** Secondary image (packet QR graphic) — used only in fallback path. */
  packetImageUrl?: string | null;
  /** Color-keyed mockups lead the gallery; they do not replace generated packet proofs. */
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
  preferredFront?: string | null,
): { front?: string; lifestyle?: string; angles?: string[] } | null {
  const keys = Object.keys(mockupsByColor);
  if (keys.length === 0) return null;

  // No color selected — return the first available entry
  if (!targetColor) {
    return mockupsByColor[keys[0]] ?? null;
  }

  const normalizedTarget = normalizeMockupColorKey(targetColor);

  // Collect all entries whose color portion matches the target
  const matches = keys.filter((key) => {
    const keyColor = normalizeMockupColorKey(extractColorFromKey(key));
    return keyColor === normalizedTarget;
  });

  // If no compound-key matches, try a full-key normalized match (simple keys like "Navy")
  if (matches.length === 0) {
    for (const key of keys) {
      if (normalizeMockupColorKey(key) === normalizedTarget) return mockupsByColor[key];
    }
    return null;
  }

  // Aggregate all matching placements into one result
  // Saved uploads and supplier caches can use different spellings of the same color.
  // The canonical lead wins within that color without overriding another selection.
  matches.sort((a, b) => Number(mockupsByColor[b].front === preferredFront) - Number(mockupsByColor[a].front === preferredFront));
  const aggregated: { front?: string; lifestyle?: string; angles: string[] } = { angles: [] };

  for (const key of matches) {
    const entry = mockupsByColor[key];
    aggregated.angles.push(...(entry.angles || []));
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

/** Combine selected-color mockups with the complete generated packet gallery. */
export function buildProductGallery(
  product: ProductMediaSource | null | undefined,
  selectedColor?: string | null,
): StorefrontMediaItem[] {
  if (!product) return [];
  const productName = product.name || 'Product';
  const video: StorefrontMediaItem | null = product.qrProductType === 'qr-play' && product.playMediaUrl
    ? { url: product.playMediaUrl, type: 'video', label: 'Video', alt: `${productName} — video`, posterUrl: product.compositeUrl || undefined }
    : null;
  const items: StorefrontMediaItem[] = [];
  const seen = new Set<string>();
  const add = (item: StorefrontMediaItem) => {
    if (!item.url || seen.has(item.url)) return;
    seen.add(item.url);
    items.push(item);
  };
  // Known color-specific URLs must not reintroduce another color through images[].
  const colorMockupUrls = new Set<string>();
  for (const entry of Object.values(product.mockupsByColor || {})) {
    [entry.lifestyle, entry.front, ...(entry.angles || [])].forEach(url => {
      if (url) colorMockupUrls.add(url);
    });
  }
  if (product.mockupsByColor) {
    const mockup = findColorMockup(product.mockupsByColor, selectedColor, product.imageUrl);
    if (mockup?.front) add({ url: mockup.front, label: 'Front', alt: `${productName} — front`, type: 'mockup' });
    if (mockup?.lifestyle) add({ url: mockup.lifestyle, label: 'Lifestyle', alt: `${productName} — lifestyle`, type: 'lifestyle' });
    (mockup?.angles || []).forEach((url, i) => add({ url, label: `View ${i + 2}`, alt: `${productName} — angle ${i + 2}`, type: 'gallery' }));
  }
  // Products already supplies the packet's generated images in canonical order.
  // Append its proofs even when selected-color mockups are available.
  (product.images || []).forEach((item, i) => {
    const url = normalizeImageUrl(item);
    if (!url || colorMockupUrls.has(url)) return;
    // A static QR Play landing-page capture cannot capture the embedded movie.
    // Replace that exact destination slot with the saved video, preserving order.
    if (video && url === product.landingPageSnapshotUrl) { add(video); return; }
    if (video && url === product.qrCodeUrl) add(video);
    add({ url, alt: typeof item === 'object' && item.alt ? item.alt : `${productName} — image ${i + 1}`, type: 'gallery' });
  });
  if (items.length) { if (video) add(video); return items; }

  // Legacy sources without a generated image array retain their existing display.
  if (product.imageUrl && !colorMockupUrls.has(product.imageUrl)) {
    add({ url: product.imageUrl, alt: productName, type: 'mockup' });
  }
  if (product.packetImageUrl && !colorMockupUrls.has(product.packetImageUrl)) {
    add({ url: product.packetImageUrl, alt: `${productName} — graphic`, type: 'graphic' });
  }
  if (video) add(video);
  return items;
}
