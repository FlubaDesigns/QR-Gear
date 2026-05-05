/**
 * shared/graphicCodes.ts
 *
 * GRF (Graphic Reference Format) identity system.
 *
 * Format:  GRF-[TT]-[K]-[NNNNNN]
 *   TT       = 2-digit type code (01–07)
 *   K        = 1-digit role code (1–5)
 *   NNNNNN   = 6-digit zero-padded sequence number
 *
 * Example: GRF-04-3-000001  (QR Graphic, Renderable, sequence 1)
 * Example: GRF-05-4-000003  (Canvas Design, Final, sequence 3)
 *
 * Hosting mode (H) and subtype (ST) are stored as fields on the
 * Firestore document at grf_assets/{grfId} — not in the ID.
 *
 * Counter storage: Firestore grf_counters/{typeCode}_{roleCode}  (atomic)
 * Codes are GLOBAL and FIXED — never renumber once assigned.
 */

export type GrfTypeCode = '01' | '02' | '03' | '04' | '05' | '06' | '07';
export type GrfRoleCode = '1' | '2' | '3' | '4' | '5';

export interface GrfTypeEntry {
  label: string;
  description: string;
  validRoles: GrfRoleCode[];
}

export const GRF_TYPE_MAP: Record<GrfTypeCode, GrfTypeEntry> = {
  '01': { label: 'upload_source',      description: 'Raw uploaded source image',        validRoles: ['1'] },
  '02': { label: 'cropped_derivative', description: 'Cropped/derived from source',      validRoles: ['2'] },
  '03': { label: 'background',         description: 'Background image asset',           validRoles: ['3'] },
  '04': { label: 'qr_graphic',         description: 'QR code graphic (QR-only image)',  validRoles: ['3'] },
  '05': { label: 'canvas_design',      description: 'Full canvas composite design',     validRoles: ['4', '3'] },
  '06': { label: 'url_artifact_asset',  description: 'URL/landing page artifact image',  validRoles: ['3'] },
  '07': { label: 'template_graphic',   description: 'Reusable template graphic',        validRoles: ['5'] },
};

export const GRF_ROLE_LABELS: Record<GrfRoleCode, string> = {
  '1': 'Source',
  '2': 'Derivative',
  '3': 'Renderable',
  '4': 'Final',
  '5': 'Template',
};

// ── Regex ──────────────────────────────────────────────────────────────────

const GRF_REGEX = /^GRF-(01|02|03|04|05|06|07)-([12345])-(\d{6})$/;

// ── Validation ─────────────────────────────────────────────────────────────

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

// ── ParsedGraphicId ────────────────────────────────────────────────────────

export interface ParsedGraphicId {
  typeCode:        GrfTypeCode;
  roleCode:        GrfRoleCode;
  sequence:        string;
  typeName:        string;
  typeDescription: string;
  roleLabel:       string;
}

export function parseGraphicId(id: string): ParsedGraphicId {
  const m = GRF_REGEX.exec(id);
  if (!m) throw new Error(`Invalid GRF graphic ID: "${id}"`);
  const typeCode = m[1] as GrfTypeCode;
  const roleCode = m[2] as GrfRoleCode;
  const entry    = GRF_TYPE_MAP[typeCode];
  if (!entry.validRoles.includes(roleCode)) {
    throw new Error(`Invalid GRF graphic ID: "${id}"`);
  }
  return {
    typeCode,
    roleCode,
    sequence:        m[3],
    typeName:        entry.label,
    typeDescription: entry.description,
    roleLabel:       GRF_ROLE_LABELS[roleCode],
  };
}

// ── Builder ────────────────────────────────────────────────────────────────

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

// ── Counter key ────────────────────────────────────────────────────────────

/** Firestore document key for the grf_counters collection. */
export function grfCounterKey(typeCode: GrfTypeCode, roleCode: GrfRoleCode): string {
  return `${typeCode}_${roleCode}`;
}

// ── Pairings ───────────────────────────────────────────────────────────────

/** All valid (typeCode, roleCode) pairings as a flat list. */
export const GRF_VALID_PAIRINGS: Array<{ typeCode: GrfTypeCode; roleCode: GrfRoleCode }> =
  (Object.entries(GRF_TYPE_MAP) as Array<[GrfTypeCode, GrfTypeEntry]>).flatMap(
    ([tc, entry]) => entry.validRoles.map((rc) => ({ typeCode: tc, roleCode: rc }))
  );

// ── MIME validation ────────────────────────────────────────────────────────

/**
 * Allowed MIME types for each GRF typeCode.
 * Types 01–05 and 07 are always image assets.
 * Type 06 (url_artifact_asset) also permits video and document MIMEs.
 */
export const GRF_TYPE_ALLOWED_MIMES: Record<GrfTypeCode, readonly string[]> = {
  '01': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'],
  '02': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  '03': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  '04': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  '05': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  '06': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm', 'application/pdf'],
  '07': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
};

/** Returns true when mimeType is permitted for the given GRF typeCode. */
export function isValidGrfMime(typeCode: GrfTypeCode, mimeType: string): boolean {
  return (GRF_TYPE_ALLOWED_MIMES[typeCode] as string[]).includes(mimeType);
}
