/**
 * storefront-shared/mediaTypes.ts
 *
 * Canonical media item type used across all storefront product views.
 * All gallery builders and gallery components consume this shape.
 */

export type StorefrontMediaType = 'mockup' | 'gallery' | 'lifestyle' | 'detail' | 'graphic';

export interface StorefrontMediaItem {
  url: string;
  alt?: string;
  label?: string;
  type?: StorefrontMediaType;
}
