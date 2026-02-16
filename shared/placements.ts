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
  if (providerPlacement.endsWith('_dtf')) return 'dtf';
  return 'dtg';
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
