/**
 * shared/graphicCodes.ts
 *
 * GRF (Graphic Reference Format) identity system.
 *
 * Format:  GRF-[TT]-[K]-[NNNNNN]
 *   TT       = 2-digit type code (01–07)
 *   K        = 1-letter role code (S | D | R | F | T)
 *   NNNNNN   = 6-digit zero-padded sequence number
 *
 * Example: GRF-04-R-000001  (QR Graphic, Renderable, sequence 1)
 *
 * Counter storage: Firestore grf_counters/{typeCode}_{roleCode}  (atomic)
 * Codes are GLOBAL and FIXED — never renumber once assigned.
 */

export type GrfTypeCode = '01' | '02' | '03' | '04' | '05' | '06' | '07';
export type GrfRoleCode = 'S' | 'D' | 'R' | 'F' | 'T';

export interface GrfTypeEntry {
  label: string;
  description: string;
  validRoles: GrfRoleCode[];
}

export const GRF_TYPE_MAP: Record<GrfTypeCode, GrfTypeEntry> = {
  '01': { label: 'upload_source',      description: 'Raw uploaded source image',       validRoles: ['S'] },
  '02': { label: 'cropped_derivative', description: 'Cropped/derived from source',     validRoles: ['D'] },
  '03': { label: 'background',         description: 'Background image asset',          validRoles: ['R'] },
  '04': { label: 'qr_graphic',         description: 'QR code graphic (QR-only image)', validRoles: ['R'] },
  '05': { label: 'canvas_design',      description: 'Full canvas composite design',    validRoles: ['F', 'R'] },
  '06': { label: 'url_artifact_image', description: 'URL/landing page artifact image', validRoles: ['R'] },
  '07': { label: 'template_graphic',   description: 'Reusable template graphic',       validRoles: ['T'] },
};

export const GRF_ROLE_LABELS: Record<GrfRoleCode, string> = {
  S: 'Source',
  D: 'Derivative',
  R: 'Renderable',
  F: 'Final',
  T: 'Template',
};

const GRF_REGEX = /^GRF-(01|02|03|04|05|06|07)-([SDRFT])-(\d{6})$/;

export function isValidGraphicId(id: string): boolean {
  const m = GRF_REGEX.exec(id);
  if (!m) return false;
  const typeCode = m[1] as GrfTypeCode;
  const roleCode = m[2] as GrfRoleCode;
  return GRF_TYPE_MAP[typeCode]?.validRoles.includes(roleCode) ?? false;
}

export function assertValidGraphicId(id: string): void {
  if (!isValidGraphicId(id)) {
    throw new Error(`Invalid GRF graphic ID: "${id}"`);
  }
}

export interface ParsedGraphicId {
  typeCode: GrfTypeCode;
  roleCode: GrfRoleCode;
  sequence: string;
  typeName: string;
  typeDescription: string;
  roleLabel: string;
}

export function parseGraphicId(id: string): ParsedGraphicId {
  assertValidGraphicId(id);
  const m = GRF_REGEX.exec(id)!;
  const typeCode = m[1] as GrfTypeCode;
  const roleCode = m[2] as GrfRoleCode;
  const sequence = m[3];
  const entry = GRF_TYPE_MAP[typeCode];
  return {
    typeCode,
    roleCode,
    sequence,
    typeName: entry.label,
    typeDescription: entry.description,
    roleLabel: GRF_ROLE_LABELS[roleCode],
  };
}

export function buildGraphicId(
  typeCode: GrfTypeCode,
  roleCode: GrfRoleCode,
  sequence: number
): string {
  const entry = GRF_TYPE_MAP[typeCode];
  if (!entry) throw new Error(`Unknown GRF typeCode: "${typeCode}"`);
  if (!entry.validRoles.includes(roleCode)) {
    throw new Error(
      `Role "${roleCode}" is not valid for typeCode "${typeCode}". Valid roles: ${entry.validRoles.join(', ')}`
    );
  }
  if (sequence < 1 || sequence > 999999) {
    throw new Error(`GRF sequence must be 1–999999, got ${sequence}`);
  }
  const seq = String(sequence).padStart(6, '0');
  return `GRF-${typeCode}-${roleCode}-${seq}`;
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
