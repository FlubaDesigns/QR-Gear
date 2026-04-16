"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeAssign = safeAssign;
exports.safeAssignRequired = safeAssignRequired;
/**
 * safeAssign — prevents null/empty/undefined provider values from
 * overwriting previously-curated, non-empty data during sync operations.
 *
 * Returns `incoming` only when it is a non-empty, non-null string.
 * Otherwise the existing value is preserved unchanged.
 */
function safeAssign(existing, incoming) {
    if (incoming === null || incoming === undefined || String(incoming).trim() === "") {
        return existing ?? null;
    }
    return incoming;
}
function safeAssignRequired(existing, incoming, fallback = "") {
    if (incoming !== null && incoming !== undefined && String(incoming).trim() !== "") {
        return incoming;
    }
    if (existing !== null && existing !== undefined && String(existing).trim() !== "") {
        return existing;
    }
    return fallback;
}
//# sourceMappingURL=safeAssign.js.map