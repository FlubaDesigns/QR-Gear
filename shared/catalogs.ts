/** Catalog identity and per-blank overlays shared by all catalog operations. */
export const CATALOG_OVERLAY_FIELDS = ['blankTiers', 'blankDescriptions', 'blankTitles', 'blankMakers', 'blankModels', 'blankProviders', 'blankImages', 'blankPrimaryImages', 'blankColors'] as const;
export const CATALOG_SECTIONS = ['member', 'public', 'external', 'marketplace', 'platform'] as const;
export type CatalogSection = typeof CATALOG_SECTIONS[number];
export interface AdminCatalog {
  id: string;
  name: string;
  description?: string;
  blankIds: string[];
  blankTiers?: Record<string, string>;
  tierConfig?: Record<string, { displayName?: string; description?: string; tagline?: string }>;
  blankDescriptions?: Record<string, string>;
  blankTitles?: Record<string, string>;
  blankMakers?: Record<string, string>;
  blankModels?: Record<string, string>;
  blankProviders?: Record<string, string[]>;
  blankImages?: Record<string, string[]>;
  blankPrimaryImages?: Record<string, string>;
  blankColors?: Record<string, Array<{ name: string; hex: string }>>;
  createdAt?: string;
  updatedAt?: string;
}

/** Keep only overlays owned by current members; includes intentionally empty arrays. */
export function catalogOverlays(catalog: Record<string, any>, blankIds: string[]) {
  const members = new Set(blankIds);
  return Object.fromEntries(CATALOG_OVERLAY_FIELDS.map(field => [field,
    Object.fromEntries(Object.entries(catalog[field] || {}).filter(([id]) => members.has(id))),
  ]));
}
