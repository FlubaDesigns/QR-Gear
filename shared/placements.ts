export type FulfillmentProvider = 'printify' | 'printful';

export type InternalPlacement =
  | 'front'
  | 'back'
  | 'pocket'
  | 'left_sleeve'
  | 'right_sleeve'
  | 'label_inside'
  | 'label_outside'
  | 'left'
  | 'right'
  | 'center'
  | 'side'
  | 'wraparound'
  | 'default';

const PRINTIFY_TO_INTERNAL: Record<string, InternalPlacement> = {
  'front': 'front',
  'back': 'back',
  'pocket': 'pocket',
  'sleeve_left': 'left_sleeve',
  'sleeve_right': 'right_sleeve',
  'left': 'left',
  'right': 'right',
  'neck_label': 'label_outside',
  'label': 'label_inside',
};

const PRINTFUL_TO_INTERNAL: Record<string, InternalPlacement> = {
  'front': 'front',
  'front_large': 'front',
  'front_dtf': 'front',
  'front_dtf_hat': 'front',
  'back': 'back',
  'back_dtf': 'back',
  'sleeve_left': 'left_sleeve',
  'sleeve_right': 'right_sleeve',
  'short_sleeve_left_dtf': 'left_sleeve',
  'short_sleeve_right_dtf': 'right_sleeve',
  'label_outside': 'label_outside',
  'label_inside': 'label_inside',
  'default': 'front',
};

const INTERNAL_TO_PRINTIFY: Record<string, string> = {
  'front': 'front',
  'back': 'back',
  'pocket': 'pocket',
  'left_sleeve': 'sleeve_left',
  'right_sleeve': 'sleeve_right',
  'label_inside': 'label',
  'label_outside': 'neck_label',
  'left': 'left',
  'right': 'right',
};

const INTERNAL_TO_PRINTFUL: Record<string, string> = {
  'front': 'front_large',
  'back': 'back',
  'left_sleeve': 'sleeve_left',
  'right_sleeve': 'sleeve_right',
  'label_inside': 'label_inside',
  'label_outside': 'label_outside',
};

const INTERNAL_TO_PRINTFUL_DTF: Record<string, string> = {
  'front': 'front_dtf',
  'back': 'back_dtf',
  'left_sleeve': 'short_sleeve_left_dtf',
  'right_sleeve': 'short_sleeve_right_dtf',
};

export function normalizePlacement(
  provider: FulfillmentProvider,
  providerPlacement: string
): InternalPlacement {
  const map = provider === 'printify' ? PRINTIFY_TO_INTERNAL : PRINTFUL_TO_INTERNAL;
  return map[providerPlacement] || (providerPlacement as InternalPlacement);
}

export function toProviderPlacement(
  provider: FulfillmentProvider,
  internal: string,
  availablePlacements?: string[],
  printMethod?: PrintMethod
): string {
  if (provider === 'printful' && printMethod === 'dtf') {
    if (internal === 'front' && availablePlacements?.includes('front_dtf_hat')) return 'front_dtf_hat';
    const dtfMapped = INTERNAL_TO_PRINTFUL_DTF[internal];
    if (dtfMapped && (!availablePlacements || availablePlacements.includes(dtfMapped))) {
      return dtfMapped;
    }
  }

  const map = provider === 'printify' ? INTERNAL_TO_PRINTIFY : INTERNAL_TO_PRINTFUL;
  let mapped = map[internal] || internal;

  if (provider === 'printful' && internal === 'front' && availablePlacements) {
    if (availablePlacements.includes('front_large')) {
      mapped = 'front_large';
    } else if (availablePlacements.includes('front')) {
      mapped = 'front';
    }
  }

  return mapped;
}

export function normalizePlacements(
  provider: FulfillmentProvider,
  providerPlacements: string[]
): InternalPlacement[] {
  const seen = new Set<InternalPlacement>();
  const result: InternalPlacement[] = [];
  for (const pp of providerPlacements) {
    const internal = normalizePlacement(provider, pp);
    if (!seen.has(internal)) {
      seen.add(internal);
      result.push(internal);
    }
  }
  return result;
}

export function isEmbroideryPlacement(providerPlacement: string): boolean {
  return providerPlacement.startsWith('embroidery_');
}

export type PrintMethod = 'dtg' | 'dtf';

export function detectPrintMethod(providerPlacement: string): PrintMethod {
  if (/(?:^|_)dtf(?:_|$)/.test(providerPlacement)) return 'dtf';
  return 'dtg';
}

/** Select a supplier-verified method and its geometry from one master location. */
export function selectPrintLocationMethod<T extends { methods?: any[]; [key: string]: any }>(location: T, method?: PrintMethod): T {
  if (!location.methods?.length) return location;
  const selected = method ? location.methods.find(option => option.method === method) : location.methods[0];
  if (!selected) throw new Error(`Printing method ${method} is unavailable for ${location.id || location.canonicalLocationCode}.`);
  return { ...location, ...selected, methods: location.methods,
    providerPlacement: selected.providerName, providerPlacementId: selected.providerName };
}

export interface PlacementWithMethods {
  internal: InternalPlacement;
  methods: { method: PrintMethod; providerName: string }[];
}

export function groupPlacementsByLocation(
  provider: FulfillmentProvider,
  rawPlacements: string[]
): PlacementWithMethods[] {
  const groups = new Map<InternalPlacement, { method: PrintMethod; providerName: string }[]>();
  for (const raw of rawPlacements) {
    const internal = normalizePlacement(provider, raw);
    const method = detectPrintMethod(raw);
    if (!groups.has(internal)) groups.set(internal, []);
    const existing = groups.get(internal)!;
    if (!existing.some(m => m.method === method)) {
      existing.push({ method, providerName: raw });
    }
  }
  const result: PlacementWithMethods[] = [];
  groups.forEach((methods, internal) => {
    result.push({ internal, methods });
  });
  return result;
}

/** Preview and production must agree with the current product's verified master area. */
export function requireVerifiedPrintLayout(master: any, placement: string, layout: any, variantId: number) {
  const location = master.qrgPrintSpecs?.printful?.locations?.find((p: any) => p.id === placement && p.provider === 'printful');
  const spec = location ? selectPrintLocationMethod(location, detectPrintMethod(layout?.providerPlacementId || '')) : null;
  const saved = layout?.dimensions, target = spec?.dimensions;
  const template = spec?.printfileIds?.[String(variantId)];
  const savedTemplate = layout?.printfileIds?.[String(variantId)];
  // Older DTG packets used front_large for the same physical canvas. Resolve only
  // this known alias; variant, dimensions, resolution, template and technique still
  // must pass below. The returned current spec drives both proof and production.
  const legacyFrontAlias = placement === 'front' && layout?.providerPlacementId === 'front_large' && spec?.providerPlacementId === 'front';
  if (layout?.provider !== 'printful' || !spec || (spec.providerPlacementId !== layout.providerPlacementId && !legacyFrontAlias) ||
      !spec.verifiedVariantIds?.includes(variantId) || !(saved?.widthPx > 0 && saved.heightPx > 0 && saved.dpi > 0 && target?.dpi > 0) ||
      saved.widthPx / saved.dpi !== target.widthPx / target.dpi || saved.heightPx / saved.dpi !== target.heightPx / target.dpi || saved.dpi < target.dpi ||
      (savedTemplate != null && template !== savedTemplate) || (layout.technique && spec.technique !== layout.technique)) {
    throw new Error(`Refresh and regenerate the verified Printful print area for ${placement}.`);
  }
  return spec;
}
