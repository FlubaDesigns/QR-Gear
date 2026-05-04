"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRF_VALID_PAIRINGS = exports.GRF_ROLE_LABELS = exports.GRF_TYPE_MAP = void 0;
exports.isValidGraphicId = isValidGraphicId;
exports.assertValidGraphicId = assertValidGraphicId;
exports.parseGraphicId = parseGraphicId;
exports.buildGraphicId = buildGraphicId;
exports.grfCounterKey = grfCounterKey;
exports.GRF_TYPE_MAP = {
    '01': { label: 'upload_source', description: 'Raw uploaded source image', validRoles: ['S'] },
    '02': { label: 'cropped_derivative', description: 'Cropped/derived from source', validRoles: ['D'] },
    '03': { label: 'background', description: 'Background image asset', validRoles: ['R'] },
    '04': { label: 'qr_graphic', description: 'QR code graphic (QR-only image)', validRoles: ['R'] },
    '05': { label: 'canvas_design', description: 'Full canvas composite design', validRoles: ['F', 'R'] },
    '06': { label: 'url_artifact_image', description: 'URL/landing page artifact image', validRoles: ['R'] },
    '07': { label: 'template_graphic', description: 'Reusable template graphic', validRoles: ['T'] },
};
exports.GRF_ROLE_LABELS = {
    S: 'Source',
    D: 'Derivative',
    R: 'Renderable',
    F: 'Final',
    T: 'Template',
};
const GRF_REGEX = /^GRF-(01|02|03|04|05|06|07)-([SDRFT])-(\d{6})$/;
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
    assertValidGraphicId(id);
    const m = GRF_REGEX.exec(id);
    const typeCode = m[1];
    const roleCode = m[2];
    const sequence = m[3];
    const entry = exports.GRF_TYPE_MAP[typeCode];
    return {
        typeCode,
        roleCode,
        sequence,
        typeName: entry.label,
        typeDescription: entry.description,
        roleLabel: exports.GRF_ROLE_LABELS[roleCode],
    };
}
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
/** Firestore document key for the grf_counters collection */
function grfCounterKey(typeCode, roleCode) {
    return `${typeCode}_${roleCode}`;
}
/** All valid (typeCode, roleCode) pairings as a flat list */
exports.GRF_VALID_PAIRINGS = Object.entries(exports.GRF_TYPE_MAP).flatMap(([tc, entry]) => entry.validRoles.map((rc) => ({ typeCode: tc, roleCode: rc })));
//# sourceMappingURL=graphicCodes.js.map