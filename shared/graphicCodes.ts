/**
 * shared/graphicCodes.ts
 *
 * GRF (Graphic Reference Format) identity system.
 *
 * Format:  GRF-[TT]-[K]-[O/L]-[ST]-[NNNNNN]
 *   TT       = 2-digit type code (01–07)
 *   K        = 1-letter role code (S | D | R | F | T)
 *   O/L      = hosting mode — O=Online (hosted URL) | L=Local (design-layer construct)
 *   ST       = presentation subtype — branches by hosting mode:
 *                Online:  I=Image | V=Video | D=Document | A=Audio
 *                Local:   Z=Zone | C=Canvas | T=Text | G=Graphic | X=Composite
 *   NNNNNN   = 6-digit zero-padded sequence number
 *
 * Example: GRF-04-R-O-I-000001  (QR Graphic, Renderable, Online Image, sequence 1)
 * Example: GRF-05-F-L-C-000003  (Canvas Design, Final, Local Canvas, sequence 3)
 *
 * Counter storage: Firestore grf_counters/{typeCode}_{roleCode}  (atomic)
 * Codes are GLOBAL and FIXED — never renumber once assigned.
 */

export type GrfTypeCode = '01' | '02' | '03' | '04' | '05' | '06' | '07';
export type GrfRoleCode = 'S' | 'D' | 'R' | 'F' | 'T';
export type GrfHostingMode = 'O' | 'L';
export type GrfOnlineSubtype = 'I' | 'V' | 'D' | 'A';
export type GrfLocalSubtype = 'Z' | 'C' | 'T' | 'G' | 'X';
export type GrfSubtype = GrfOnlineSubtype | GrfLocalSubtype;

export interface GrfTypeEntry {
  label: string;
  description: string;
  validRoles: GrfRoleCode[];
}

export const GRF_TYPE_MAP: Record<GrfTypeCode, GrfTypeEntry> = {
  '01': { label: 'upload_source',      description: 'Raw uploaded source image',        validRoles: ['S'] },
  '02': { label: 'cropped_derivative', description: 'Cropped/derived from source',      validRoles: ['D'] },
  '03': { label: 'background',         description: 'Background image asset',           validRoles: ['R'] },
  '04': { label: 'qr_graphic',         description: 'QR code graphic (QR-only image)',  validRoles: ['R'] },
  '05': { label: 'canvas_design',      description: 'Full canvas composite design',     validRoles: ['F', 'R'] },
  '06': { label: 'url_artifact_image', description: 'URL/landing page artifact image',  validRoles: ['R'] },
  '07': { label: 'template_graphic',   description: 'Reusable template graphic',        validRoles: ['T'] },
};

export const GRF_ROLE_LABELS: Record<GrfRoleCode, string> = {
  S: 'Source',
  D: 'Derivative',
  R: 'Renderable',
  F: 'Final',
  T: 'Template',
};

export const GRF_HOSTING_LABELS: Record<GrfHostingMode, string> = {
  O: 'Online',
  L: 'Local',
};

export const GRF_ONLINE_SUBTYPE_LABELS: Record<GrfOnlineSubtype, string> = {
  I: 'Image',
  V: 'Video',
  D: 'Document',
  A: 'Audio',
};

export const GRF_LOCAL_SUBTYPE_LABELS: Record<GrfLocalSubtype, string> = {
  Z: 'Zone',
  C: 'Canvas',
  T: 'Text',
  G: 'Graphic',
  X: 'Composite',
};

const ONLINE_SUBTYPES = new Set<string>(['I', 'V', 'D', 'A']);
const LOCAL_SUBTYPES  = new Set<string>(['Z', 'C', 'T', 'G', 'X']);

export function isValidSubtypeForMode(hostingMode: GrfHostingMode, subtype: string): boolean {
  if (hostingMode === 'O') return ONLINE_SUBTYPES.has(subtype);
  if (hostingMode === 'L') return LOCAL_SUBTYPES.has(subtype);
  return false;
}

export function subtypeLabel(hostingMode: GrfHostingMode, subtype: GrfSubtype): string {
  if (hostingMode === 'O') return GRF_ONLINE_SUBTYPE_LABELS[subtype as GrfOnlineSubtype] ?? subtype;
  return GRF_LOCAL_SUBTYPE_LABELS[subtype as GrfLocalSubtype] ?? subtype;
}

const GRF_REGEX = /^GRF-(01|02|03|04|05|06|07)-([SDRFT])-(O|L)-(I|V|D|A|Z|C|T|G|X)-(\d{6})$/;

export function isValidGraphicId(id: string): boolean {
  const m = GRF_REGEX.exec(id);
  if (!m) return false;
  const typeCode    = m[1] as GrfTypeCode;
  const roleCode    = m[2] as GrfRoleCode;
  const hostingMode = m[3] as GrfHostingMode;
  const subtype     = m[4];
  if (!(GRF_TYPE_MAP[typeCode]?.validRoles.includes(roleCode) ?? false)) return false;
  return isValidSubtypeForMode(hostingMode, subtype);
}

export function assertValidGraphicId(id: string): void {
  if (!isValidGraphicId(id)) {
    throw new Error(`Invalid GRF graphic ID: "${id}"`);
  }
}

export interface ParsedGraphicId {
  typeCode:         GrfTypeCode;
  roleCode:         GrfRoleCode;
  hostingMode:      GrfHostingMode;
  subtype:          GrfSubtype;
  sequence:         string;
  typeName:         string;
  typeDescription:  string;
  roleLabel:        string;
  hostingLabel:     string;
  subtypeLabel:     string;
}

export function parseGraphicId(id: string): ParsedGraphicId {
  assertValidGraphicId(id);
  const m            = GRF_REGEX.exec(id)!;
  const typeCode     = m[1] as GrfTypeCode;
  const roleCode     = m[2] as GrfRoleCode;
  const hostingMode  = m[3] as GrfHostingMode;
  const subtype      = m[4] as GrfSubtype;
  const sequence     = m[5];
  const entry        = GRF_TYPE_MAP[typeCode];
  return {
    typeCode,
    roleCode,
    hostingMode,
    subtype,
    sequence,
    typeName:        entry.label,
    typeDescription: entry.description,
    roleLabel:       GRF_ROLE_LABELS[roleCode],
    hostingLabel:    GRF_HOSTING_LABELS[hostingMode],
    subtypeLabel:    subtypeLabel(hostingMode, subtype),
  };
}

export function buildGraphicId(
  typeCode:    GrfTypeCode,
  roleCode:    GrfRoleCode,
  hostingMode: GrfHostingMode,
  subtype:     GrfSubtype,
  sequence:    number
): string {
  const entry = GRF_TYPE_MAP[typeCode];
  if (!entry) throw new Error(`Unknown GRF typeCode: "${typeCode}"`);
  if (!entry.validRoles.includes(roleCode)) {
    throw new Error(
      `Role "${roleCode}" is not valid for typeCode "${typeCode}". Valid roles: ${entry.validRoles.join(', ')}`
    );
  }
  if (!isValidSubtypeForMode(hostingMode, subtype)) {
    throw new Error(
      `Subtype "${subtype}" is not valid for hostingMode "${hostingMode}".`
    );
  }
  if (sequence < 1 || sequence > 999999) {
    throw new Error(`GRF sequence must be 1–999999, got ${sequence}`);
  }
  const seq = String(sequence).padStart(6, '0');
  return `GRF-${typeCode}-${roleCode}-${hostingMode}-${subtype}-${seq}`;
}

/** Firestore document key for the grf_counters collection */
export function grfCounterKey(typeCode: GrfTypeCode, roleCode: GrfRoleCode): string {
  return `${typeCode}_${roleCode}`;
}

/** All valid (typeCode, roleCode) pairings as a flat list */
export const GRF_VALID_PAIRINGS: Array<{ typeCode: GrfTypeCode; roleCode: GrfRoleCode }> =
  (Object.entries(GRF_TYPE_MAP) as Array<[GrfTypeCode, GrfTypeEntry]>).flatMap(
    ([tc, entry]) => entry.validRoles.map((rc) => ({ typeCode: tc, roleCode: rc }))
  );
