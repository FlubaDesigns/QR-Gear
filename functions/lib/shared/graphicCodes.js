"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRF_VALID_PAIRINGS = exports.GRF_ROLE_LABELS = exports.GRF_TYPE_MAP = void 0;
exports.isValidGraphicId = isValidGraphicId;
exports.assertValidGraphicId = assertValidGraphicId;
exports.parseGraphicId = parseGraphicId;
exports.buildGraphicId = buildGraphicId;
exports.grfCounterKey = grfCounterKey;
exports.GRF_TYPE_MAP = {
    '01': { label: 'upload_source', description: 'Raw uploaded source image', validRoles: ['1'] },
    '02': { label: 'cropped_derivative', description: 'Cropped/derived from source', validRoles: ['2'] },
    '03': { label: 'background', description: 'Background image asset', validRoles: ['3'] },
    '04': { label: 'qr_graphic', description: 'QR code graphic (QR-only image)', validRoles: ['3'] },
    '05': { label: 'canvas_design', description: 'Full canvas composite design', validRoles: ['4', '3'] },
    '06': { label: 'url_artifact_asset', description: 'URL/landing page artifact image', validRoles: ['3'] },
    '07': { label: 'template_graphic', description: 'Reusable template graphic', validRoles: ['5'] },
};
exports.GRF_ROLE_LABELS = {
    '1': 'Source',
    '2': 'Derivative',
    '3': 'Renderable',
    '4': 'Final',
    '5': 'Template',
};
// ── Regex ──────────────────────────────────────────────────────────────────
const GRF_REGEX = /^GRF-(01|02|03|04|05|06|07)-([12345])-(\d{6})$/;
// ── Validation ─────────────────────────────────────────────────────────────
function isValidGraphicId(id) {
    const m = GRF_REGEX.exec(id);
    if (!m)
        return false;
    const typeCode = m[1];
    const roleCode = m[2];
    return exports.GRF_TYPE_MAP[typeCode]?.validRoles.includes(roleCode) ?? false;
}
function assertValidGraphicId(id) {
    if (!isValidGraphicId(id)) {
        throw new Error(`Invalid GRF graphic ID: "${id}"`);
    }
}
function parseGraphicId(id) {
    const m = GRF_REGEX.exec(id);
    if (!m)
        throw new Error(`Invalid GRF graphic ID: "${id}"`);
    const typeCode = m[1];
    const roleCode = m[2];
    const entry = exports.GRF_TYPE_MAP[typeCode];
    if (!entry.validRoles.includes(roleCode)) {
        throw new Error(`Invalid GRF graphic ID: "${id}"`);
    }
    return {
        typeCode,
        roleCode,
        sequence: m[3],
        typeName: entry.label,
        typeDescription: entry.description,
        roleLabel: exports.GRF_ROLE_LABELS[roleCode],
    };
}
// ── Builder ────────────────────────────────────────────────────────────────
function buildGraphicId(typeCode, roleCode, sequence) {
    const entry = exports.GRF_TYPE_MAP[typeCode];
    if (!entry)
        throw new Error(`Unknown GRF typeCode: "${typeCode}"`);
    if (!entry.validRoles.includes(roleCode)) {
        throw new Error(`Role "${roleCode}" is not valid for typeCode "${typeCode}". Valid roles: ${entry.validRoles.join(', ')}`);
    }
    if (sequence < 1 || sequence > 999999) {
        throw new Error(`GRF sequence must be 1–999999, got ${sequence}`);
    }
    const seq = String(sequence).padStart(6, '0');
    return `GRF-${typeCode}-${roleCode}-${seq}`;
}
// ── Counter key ────────────────────────────────────────────────────────────
/** Firestore document key for the grf_counters collection. */
function grfCounterKey(typeCode, roleCode) {
    return `${typeCode}_${roleCode}`;
}
// ── Pairings ───────────────────────────────────────────────────────────────
/** All valid (typeCode, roleCode) pairings as a flat list. */
exports.GRF_VALID_PAIRINGS = Object.entries(exports.GRF_TYPE_MAP).flatMap(([tc, entry]) => entry.validRoles.map((rc) => ({ typeCode: tc, roleCode: rc })));
//# sourceMappingURL=graphicCodes.js.map