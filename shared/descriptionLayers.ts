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

// ── Builder-layer helpers ─────────────────────────────────────────────────────

/**
 * Resolve the effective display title for a builder state.
 *
 * @param packetTitle   - adminCatalogTitle in BuilderState — owned by packet once set.
 * @param catalogTitle  - admin-curated title from the catalog's blankTitles map.
 * @param providerTitle - raw title from the fulfillment provider (masterTitle).
 *
 * Display only. Do NOT write the returned value back into the packet record.
 */
export function resolveBuilderTitle(opts: {
  packetTitle: string | null | undefined;
  catalogTitle: string | null | undefined;
  providerTitle: string | null | undefined;
}): ResolvedLayer {
  return resolveDisplayText({
    packetValue: opts.packetTitle,
    catalogValue: opts.catalogTitle,
    providerValue: opts.providerTitle,
  });
}

/**
 * Resolve the effective display description for a builder state.
 *
 * @param packetDescription   - productDescription in BuilderState — owned by packet once set.
 * @param catalogDescription  - admin-curated description from blankDescriptions map.
 * @param providerDescription - raw description from the fulfillment provider (masterDescription).
 *
 * Display only. Do NOT write the returned value back into the packet record.
 */
export function resolveBuilderDescription(opts: {
  packetDescription: string | null | undefined;
  catalogDescription: string | null | undefined;
  providerDescription: string | null | undefined;
}): ResolvedLayer {
  return resolveDisplayText({
    packetValue: opts.packetDescription,
    catalogValue: opts.catalogDescription,
    providerValue: opts.providerDescription,
  });
}

/**
 * Resolve effective display text for an admin_catalog_instance, which stores
 * baseSnapshot (catalog-resolved), overrides (packet-set), and resolved (merged).
 *
 * Display only.
 */
export function resolveInstanceText(opts: {
  overrideValue: string | null | undefined;
  baseSnapshotValue: string | null | undefined;
  memberValue?: string | null | undefined;
}): ResolvedLayer {
  return resolveDisplayText({
    memberValue: opts.memberValue,
    packetValue: opts.overrideValue,
    catalogValue: opts.baseSnapshotValue,
  });
}

// ── Legacy interface (backward-compat) ───────────────────────────────────────

/** @deprecated Use resolveDisplayText / resolveBuilderDescription instead */
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
