/**
 * instance-resolver.ts
 *
 * Field-aware merge helpers and resolveInstance for the three-layer product
 * architecture:
 *   master_catalog (read-only) → admin_catalog_instances → member_library_instances
 *
 * RULES:
 * - isMeaningfulValue decides whether a value can replace an existing one
 * - Every field type has a dedicated merge function
 * - resolveInstance is the SINGLE source of truth for computed resolved state
 * - Never use a generic "skip null" loop — each field type knows its own merge semantics
 * - Description can be intentionally cleared only if the caller passes clearDescription: true
 */

// ──────────────────────────────────────────────────────────────────────────────
// 1. isMeaningfulValue
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns true only when the value is something real that should overwrite
 * an existing good value.
 * - null, undefined, '' → false
 * - whitespace-only string → false
 * - empty array → false
 * - empty plain object → false
 * - everything else → true
 */
export function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  // numbers, booleans are always meaningful
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. mergePrimitivePreserve
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generic "preserve existing if incoming is not meaningful" merge.
 * Use for non-string primitives (numbers, booleans, objects) where the
 * content type doesn't require normalization.
 */
export function mergePrimitivePreserve<T>(existing: T, incoming: T): T {
  if (!isMeaningfulValue(incoming)) return existing;
  return incoming;
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. mergeStringNormalized
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Trims the incoming string.
 * If the trimmed result is empty, keeps existing.
 * Otherwise returns the trimmed value.
 */
export function mergeStringNormalized(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const trimmed = (incoming ?? '').trim();
  if (trimmed.length === 0) return existing ?? null;
  return trimmed;
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. mergeArrayUnionStrings
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Union-merges two string arrays.
 * - Normalizes both to trimmed strings
 * - Drops empty entries
 * - Dedupes by normalized value
 * - Stable order: existing first, then new entries
 * - If incoming is empty, existing is returned unchanged
 */
export function mergeArrayUnionStrings(
  existing: string[] | null | undefined,
  incoming: string[] | null | undefined,
): string[] {
  const base = (existing ?? []).map(s => s.trim()).filter(s => s.length > 0);
  const next = (incoming ?? []).map(s => s.trim()).filter(s => s.length > 0);
  if (next.length === 0) return base;

  const seen = new Set(base.map(s => s.toLowerCase()));
  const merged = [...base];
  for (const s of next) {
    if (!seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      merged.push(s);
    }
  }
  return merged;
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. mergeImagesByUrl
// ──────────────────────────────────────────────────────────────────────────────

export interface ImageRecord {
  url: string;
  alt?: string | null;
  provider?: string | null;
  providerProductId?: string | null;
  width?: number | null;
  height?: number | null;
  priority?: number | null;
}

function normalizeImageUrl(url: string): string {
  try { return new URL(url).href.split('?')[0]; } catch { return url.trim(); }
}

function coerceToImageRecord(img: unknown): ImageRecord | null {
  if (!img) return null;
  if (typeof img === 'string') {
    const trimmed = img.trim();
    return trimmed ? { url: trimmed } : null;
  }
  if (typeof img === 'object') {
    const o = img as any;
    const url = (o.url ?? '').trim();
    if (!url) return null;
    return {
      url,
      alt: o.alt ?? null,
      provider: o.provider ?? null,
      providerProductId: o.providerProductId ?? null,
      width: o.width ?? null,
      height: o.height ?? null,
      priority: o.priority ?? null,
    };
  }
  return null;
}

function isBetterMetadata(current: ImageRecord, candidate: ImageRecord): boolean {
  const currentScore =
    (current.width ? 1 : 0) +
    (current.height ? 1 : 0) +
    (current.provider ? 1 : 0) +
    (current.alt ? 1 : 0);
  const candidateScore =
    (candidate.width ? 1 : 0) +
    (candidate.height ? 1 : 0) +
    (candidate.provider ? 1 : 0) +
    (candidate.alt ? 1 : 0);
  return candidateScore > currentScore;
}

/**
 * Merges two image collections (each entry may be a string URL or ImageRecord).
 * - Dedupes by normalized URL (no query params)
 * - When same URL appears in both, uses whichever has richer metadata
 * - Stable order: existing first, then new entries
 * - If incoming is empty, existing is returned unchanged
 */
export function mergeImagesByUrl(
  existing: unknown[] | null | undefined,
  incoming: unknown[] | null | undefined,
): ImageRecord[] {
  const baseRecords = (existing ?? []).map(coerceToImageRecord).filter(Boolean) as ImageRecord[];
  const nextRecords = (incoming ?? []).map(coerceToImageRecord).filter(Boolean) as ImageRecord[];
  if (nextRecords.length === 0) return baseRecords;

  const byUrl = new Map<string, ImageRecord>();
  for (const img of baseRecords) {
    byUrl.set(normalizeImageUrl(img.url), img);
  }
  for (const img of nextRecords) {
    const key = normalizeImageUrl(img.url);
    const existing = byUrl.get(key);
    if (!existing || isBetterMetadata(existing, img)) {
      byUrl.set(key, img);
    }
  }
  return Array.from(byUrl.values());
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. resolveInstance
// ──────────────────────────────────────────────────────────────────────────────

export interface InstanceSnapshot {
  title?: string | null;
  description?: string | null;
  images?: unknown[];
  brand?: string | null;
  colors?: string[] | null;
  sizes?: string[] | null;
  category?: string | null;
  pricing?: Record<string, any> | null;
  graphics?: Record<string, any> | null;
  qrConfig?: Record<string, any> | null;
  layoutConfig?: Record<string, any> | null;
  zones?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  [key: string]: unknown;
}

export interface InstanceOverrides extends InstanceSnapshot {
  /** Set to true only when the user explicitly wants to blank the description. */
  clearDescription?: boolean;
}

export interface ResolvedInstance {
  title: string;
  description: string | null;
  images: ImageRecord[];
  brand: string | null;
  colors: string[];
  sizes: string[];
  category: string | null;
  pricing: Record<string, any> | null;
  graphics: Record<string, any> | null;
  qrConfig: Record<string, any> | null;
  layoutConfig: Record<string, any> | null;
  zones: Record<string, any> | null;
  metadata: Record<string, any> | null;
}

/**
 * Single source of truth for computing the resolved state of an instance.
 *
 * Rules:
 * - title: mergeStringNormalized — never blank if base has a value
 * - description: meaningful override replaces base; explicit clearDescription=true
 *   allows blanking; otherwise base is preserved
 * - images: mergeImagesByUrl — union, prefer richer metadata, existing order first
 * - colors/sizes: mergeArrayUnionStrings
 * - brand/category: mergeStringNormalized
 * - pricing/graphics/qrConfig/layoutConfig/zones/metadata: mergePrimitivePreserve
 *   (entire object replace — callers must merge internally if they need partial patching)
 */
export function resolveInstance(
  base: InstanceSnapshot,
  overrides: InstanceOverrides,
): ResolvedInstance {
  const title = mergeStringNormalized(base.title ?? '', overrides.title ?? '') ?? base.title ?? '';

  let description: string | null;
  if (overrides.clearDescription === true) {
    description = null;
  } else if (isMeaningfulValue(overrides.description)) {
    description = mergeStringNormalized(base.description, overrides.description as string);
  } else {
    description = base.description ?? null;
  }

  const images = mergeImagesByUrl(
    (base.images ?? []) as unknown[],
    (overrides.images ?? []) as unknown[],
  );

  const brand = mergeStringNormalized(base.brand, overrides.brand as string | null | undefined);
  const category = mergeStringNormalized(base.category, overrides.category as string | null | undefined);

  const colors = mergeArrayUnionStrings(
    base.colors as string[] | undefined,
    overrides.colors as string[] | undefined,
  );
  const sizes = mergeArrayUnionStrings(
    base.sizes as string[] | undefined,
    overrides.sizes as string[] | undefined,
  );

  const pricing = mergePrimitivePreserve(base.pricing ?? null, overrides.pricing ?? null);
  const graphics = mergePrimitivePreserve(base.graphics ?? null, overrides.graphics ?? null);
  const qrConfig = mergePrimitivePreserve(base.qrConfig ?? null, overrides.qrConfig ?? null);
  const layoutConfig = mergePrimitivePreserve(base.layoutConfig ?? null, overrides.layoutConfig ?? null);
  const zones = mergePrimitivePreserve(base.zones ?? null, overrides.zones ?? null);
  const metadata = mergePrimitivePreserve(base.metadata ?? null, overrides.metadata ?? null);

  return {
    title,
    description,
    images,
    brand: brand ?? null,
    colors,
    sizes,
    category: category ?? null,
    pricing,
    graphics,
    qrConfig,
    layoutConfig,
    zones,
    metadata,
  };
}
