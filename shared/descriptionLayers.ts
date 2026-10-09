/**
 * Progressive Truth — Display Resolver
 *
 * Data flows FORWARD by explicit copy/snapshot only:
 *   Blank/Provider  →  Catalog  →  Product Packet  →  Member Copy
 *
 * This module is DISPLAY-ONLY.  It MUST NOT be used to write fallback-resolved
 * values back into any downstream record unless the admin has explicitly
 * chosen to promote the value forward.
 *
 * Legacy exports kept for backward-compat with any existing imports.
 */

// ── Source tracking ──────────────────────────────────────────────────────────

/** Public merchandising copy uses QR Gear branding; supplier records stay internal. */
export function publicProductText(value: string): string {
  return value.replace(/\bBella\s*(?:\+|&(?:amp;)?|and|\/)\s*Canvas\b(?:\s+3001\b)?/gi, 'QR Gear');
}

export type DescriptionSource =
  | 'provider'  // raw value from Printify / Printful
  | 'catalog'   // admin-curated override on the catalog doc
  | 'packet'    // value set at the product-packet layer (may start from catalog seed)
  | 'manual'    // explicit admin edit inside the builder
  | 'member'    // member's own copy override
  | 'none';     // no value available at any layer

// ── Input / output shapes ────────────────────────────────────────────────────

export interface DescriptionLayerInput {
  /** Value explicitly set by a member on their own copy */
  memberValue?: string | null;
  /** Value owned by the product packet (may have been seeded from catalog) */
  packetValue?: string | null;
  /** Admin-curated override stored on the catalog document */
  catalogValue?: string | null;
  /** Raw value from the fulfillment provider */
  providerValue?: string | null;
}

export interface ResolvedLayer {
  value: string;
  source: DescriptionSource;
}

// ── Core resolver ────────────────────────────────────────────────────────────

/**
 * Resolve the effective title or description for DISPLAY purposes only.
 * Returns both the resolved value and the source layer it came from.
 *
 * Priority (highest wins):
 *   member → packet → catalog → provider → ''
 *
 * IMPORTANT: Never write the returned `value` back into a downstream record
 * unless the user has explicitly chosen to promote/copy it.
 */
export function resolveDisplayText(input: DescriptionLayerInput): ResolvedLayer {
  if (input.memberValue?.trim()) {
    return { value: input.memberValue.trim(), source: 'member' };
  }
  if (input.packetValue?.trim()) {
    return { value: input.packetValue.trim(), source: 'packet' };
  }
  if (input.catalogValue?.trim()) {
    return { value: input.catalogValue.trim(), source: 'catalog' };
  }
  if (input.providerValue?.trim()) {
    return { value: input.providerValue.trim(), source: 'provider' };
  }
  return { value: '', source: 'none' };
}

// ── Legacy interface (backward-compat) ───────────────────────────────────────

/** @deprecated Use resolveDisplayText instead */
export interface DescriptionLayers {
  providerDescription?: string | null;
  adminCatalogDescription?: string | null;
  memberPacketDescription?: string | null;
  effectiveDescription?: string | null;
}

/** @deprecated Use resolveDisplayText instead */
export function resolveDescription(layers: DescriptionLayers): string {
  return resolveDisplayText({
    memberValue: layers.memberPacketDescription,
    catalogValue: layers.adminCatalogDescription,
    providerValue: layers.providerDescription,
  }).value;
}

/** @deprecated Use resolveDisplayText instead */
export function resolvePublicDescription(
  layers: Pick<DescriptionLayers, 'adminCatalogDescription' | 'providerDescription'>
): string {
  return resolveDisplayText({
    catalogValue: layers.adminCatalogDescription,
    providerValue: layers.providerDescription,
  }).value;
}

/** @deprecated Use resolveDisplayText + manual snapshot instead */
export function buildDescriptionSnapshot(layers: DescriptionLayers): DescriptionLayers {
  return {
    providerDescription: layers.providerDescription || null,
    adminCatalogDescription: layers.adminCatalogDescription || null,
    memberPacketDescription: layers.memberPacketDescription || null,
    effectiveDescription: resolveDescription(layers),
  };
}
