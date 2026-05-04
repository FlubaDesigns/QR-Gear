"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRF_VALID_PAIRINGS = exports.GRF_LOCAL_SUBTYPE_LABELS = exports.GRF_ONLINE_SUBTYPE_LABELS = exports.GRF_HOSTING_LABELS = exports.GRF_ROLE_LABELS = exports.GRF_TYPE_MAP = void 0;
exports.isValidSubtypeForMode = isValidSubtypeForMode;
exports.subtypeLabel = subtypeLabel;
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
exports.GRF_HOSTING_LABELS = {
    O: 'Online',
    L: 'Local',
};
exports.GRF_ONLINE_SUBTYPE_LABELS = {
    I: 'Image',
    V: 'Video',
    D: 'Document',
    A: 'Audio',
};
exports.GRF_LOCAL_SUBTYPE_LABELS = {
    Z: 'Zone',
    C: 'Canvas',
    T: 'Text',
    G: 'Graphic',
    X: 'Composite',
};
const ONLINE_SUBTYPES = new Set(['I', 'V', 'D', 'A']);
const LOCAL_SUBTYPES = new Set(['Z', 'C', 'T', 'G', 'X']);
function isValidSubtypeForMode(hostingMode, subtype) {
    if (hostingMode === 'O')
        return ONLINE_SUBTYPES.has(subtype);
    if (hostingMode === 'L')
        return LOCAL_SUBTYPES.has(subtype);
    return false;
}
function subtypeLabel(hostingMode, subtype) {
    if (hostingMode === 'O')
        return exports.GRF_ONLINE_SUBTYPE_LABELS[subtype] ?? subtype;
    return exports.GRF_LOCAL_SUBTYPE_LABELS[subtype] ?? subtype;
}
const GRF_REGEX = /^GRF-(01|02|03|04|05|06|07)-([SDRFT])-(O|L)-(I|V|D|A|Z|C|T|G|X)-(\d{6})$/;
function isValidGraphicId(id) {
    const m = GRF_REGEX.exec(id);
    if (!m)
        return false;
    const typeCode = m[1];
    const roleCode = m[2];
    const hostingMode = m[3];
    const subtype = m[4];
    if (!(exports.GRF_TYPE_MAP[typeCode]?.validRoles.includes(roleCode) ?? false))
        return false;
    return isValidSubtypeForMode(hostingMode, subtype);
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
    const hostingMode = m[3];
    const subtype = m[4];
    const sequence = m[5];
    const entry = exports.GRF_TYPE_MAP[typeCode];
    return {
        typeCode,
        roleCode,
        hostingMode,
        subtype,
        sequence,
        typeName: entry.label,
        typeDescription: entry.description,
        roleLabel: exports.GRF_ROLE_LABELS[roleCode],
        hostingLabel: exports.GRF_HOSTING_LABELS[hostingMode],
        subtypeLabel: subtypeLabel(hostingMode, subtype),
    };
}
function buildGraphicId(typeCode, roleCode, hostingMode, subtype, sequence) {
    const entry = exports.GRF_TYPE_MAP[typeCode];
    if (!entry)
        throw new Error(`Unknown GRF typeCode: "${typeCode}"`);
    if (!entry.validRoles.includes(roleCode)) {
        throw new Error(`Role "${roleCode}" is not valid for typeCode "${typeCode}". Valid roles: ${entry.validRoles.join(', ')}`);
    }
    if (!isValidSubtypeForMode(hostingMode, subtype)) {
        throw new Error(`Subtype "${subtype}" is not valid for hostingMode "${hostingMode}".`);
    }
    if (sequence < 1 || sequence > 999999) {
        throw new Error(`GRF sequence must be 1–999999, got ${sequence}`);
    }
    const seq = String(sequence).padStart(6, '0');
    return `GRF-${typeCode}-${roleCode}-${hostingMode}-${subtype}-${seq}`;
}
/** Firestore document key for the grf_counters collection */
function grfCounterKey(typeCode, roleCode) {
    return `${typeCode}_${roleCode}`;
}
/** All valid (typeCode, roleCode) pairings as a flat list */
exports.GRF_VALID_PAIRINGS = Object.entries(exports.GRF_TYPE_MAP).flatMap(([tc, entry]) => entry.validRoles.map((rc) => ({ typeCode: tc, roleCode: rc })));
//# sourceMappingURL=graphicCodes.js.map