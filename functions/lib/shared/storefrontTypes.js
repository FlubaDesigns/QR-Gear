"use strict";
/**
 * shared/storefrontTypes.ts
 *
 * Canonical types for the public-facing storefront product contract.
 * Used by:
 *   - Frontend storefront views (client/src/features/storefront/)
 *   - Backend store API (functions/src/routes/store-files.ts)
 *   - Marketplace adapters that need structured option data
 *
 * Single source of truth. Do not redefine these shapes locally.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStructuredOptions = buildStructuredOptions;
exports.deriveCardMode = deriveCardMode;
const colorUtils_1 = require("./colorUtils");
/**
 * Build structured color + size option groups from raw string arrays.
 * Uses the canonical COLOR_HEX_MAP for hex resolution.
 * Used by the storefront API when serializing a product for the frontend.
 */
function buildStructuredOptions(colors, sizes) {
    const opts = [];
    if (colors.length > 0) {
        opts.push({
            name: 'color',
            displayType: 'swatches',
            isPrimary: true,
            values: colors.map(label => ({
                label,
                hex: colorUtils_1.COLOR_HEX_MAP[label] ?? '#CCCCCC',
                available: true,
            })),
        });
    }
    if (sizes.length > 0) {
        opts.push({
            name: 'size',
            displayType: 'pills',
            isPrimary: false,
            values: sizes.map(label => ({ label, available: true })),
        });
    }
    return opts;
}
/**
 * Derive whether a product card should require color/size selection before
 * adding to cart ('browseOnly') or can be added directly ('quickAdd').
 */
function deriveCardMode(colors, sizes) {
    return colors.length > 0 && sizes.length > 0 ? 'browseOnly' : 'quickAdd';
}
//# sourceMappingURL=storefrontTypes.js.map