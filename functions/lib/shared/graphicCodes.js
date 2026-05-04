"use strict";
/**
 * shared/graphicCodes.ts
 *
 * GRF (Graphic Reference Format) identity system.
 *
 * Format:  GRF-[TT]-[K]-[H]-[ST]-[NNNNNN]
 *   TT       = 2-digit type code (01–07)
 *   K        = 1-digit role code (1–5)
 *   H        = 1-digit hosting mode (0=Online | 1=Local)
 *   ST       = 1-digit presentation subtype (1–9)
 *              Online (H=0): 1=Image | 2=Video | 3=Document | 4=Audio
 *              Local  (H=1): 5=Zone  | 6=Canvas | 7=Text | 8=Graphic | 9=Composite
 *   NNNNNN   = 6-digit zero-padded sequence number
 *
 * Example: GRF-04-3-0-1-000001  (QR Graphic, Renderable, Online, Image, sequence 1)
 * Example: GRF-05-4-1-6-000003  (Canvas Design, Final, Local, Canvas, sequence 3)
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
    '01': { label: 'upload_source', description: 'Raw uploaded source image', validRoles: ['1'] },
    '02': { label: 'cropped_derivative', description: 'Cropped/derived from source', validRoles: ['2'] },
    '03': { label: 'background', description: 'Background image asset', validRoles: ['3'] },
    '04': { label: 'qr_graphic', description: 'QR code graphic (QR-only image)', validRoles: ['3'] },
    '05': { label: 'canvas_design', description: 'Full canvas composite design', validRoles: ['4', '3'] },
    '06': { label: 'url_artifact_image', description: 'URL/landing page artifact image', validRoles: ['3'] },
    '07': { label: 'template_graphic', description: 'Reusable template graphic', validRoles: ['5'] },
};
exports.GRF_ROLE_LABELS = {
    '1': 'Source',
    '2': 'Derivative',
    '3': 'Renderable',
    '4': 'Final',
    '5': 'Template',
};
exports.GRF_HOSTING_LABELS = {
    '0': 'Online',
    '1': 'Local',
};
exports.GRF_ONLINE_SUBTYPE_LABELS = {
    '1': 'Image',
    '2': 'Video',
    '3': 'Document',
    '4': 'Audio',
};
exports.GRF_LOCAL_SUBTYPE_LABELS = {
    '5': 'Zone',
    '6': 'Canvas',
    '7': 'Text',
    '8': 'Graphic',
    '9': 'Composite',
};
const ONLINE_SUBTYPES = new Set(['1', '2', '3', '4']);
const LOCAL_SUBTYPES = new Set(['5', '6', '7', '8', '9']);
function isValidSubtypeForMode(hostingMode, subtype) {
    if (hostingMode === '0')
        return ONLINE_SUBTYPES.has(subtype);
    if (hostingMode === '1')
        return LOCAL_SUBTYPES.has(subtype);
    return false;
}
function subtypeLabel(hostingMode, subtype) {
    if (hostingMode === '0')
        return exports.GRF_ONLINE_SUBTYPE_LABELS[subtype] ?? subtype;
    return exports.GRF_LOCAL_SUBTYPE_LABELS[subtype] ?? subtype;
}
const GRF_REGEX = /^GRF-(01|02|03|04|05|06|07)-([12345])-([01])-([123456789])-(\d{6})$/;
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