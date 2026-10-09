/**
 * storefront-shared/mediaTypes.ts
 *
 * Canonical media item type used across all storefront product views.
 * All gallery builders and gallery components consume this shape.
 */

export type StorefrontMediaType = 'mockup' | 'gallery' | 'lifestyle' | 'detail' | 'graphic' | 'video';

export interface StorefrontMediaItem {
  url: string;
  alt?: string;
  label?: string;
  type?: StorefrontMediaType;
  /** Saved product artwork used when a provider's video thumbnail is unavailable. */
  posterUrl?: string;
}
