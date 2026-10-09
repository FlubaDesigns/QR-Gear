"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryImageError = void 0;
exports.decodeLibraryImage = decodeLibraryImage;
exports.validateImageBytes = validateImageBytes;
const GRF_engine_1 = require("../../../shared/GRF_engine");
const imageLibrary_1 = require("../../../shared/imageLibrary");
var imageLibrary_2 = require("../../../shared/imageLibrary");
Object.defineProperty(exports, "LibraryImageError", { enumerable: true, get: function () { return imageLibrary_2.ImageLibraryError; } });
function decodeLibraryImage(value, rawMime) {
    let mimeType;
    try {
        mimeType = (0, GRF_engine_1.normalizeMimeType)(rawMime);
    }
    catch (error) {
        throw new imageLibrary_1.ImageLibraryError(error.message);
    }
    if (typeof value !== 'string' || !value)
        throw new imageLibrary_1.ImageLibraryError('Image data is required');
    const dataUri = /^data:([^;]+);base64,([\s\S]*)$/.exec(value);
    if (dataUri && dataUri[1].replace('image/jpg', 'image/jpeg') !== mimeType)
        throw new imageLibrary_1.ImageLibraryError('Image format does not match its upload type');
    const imageData = dataUri ? dataUri[2] : value;
    if (imageData.length > Math.ceil(GRF_engine_1.GRF_IMAGE_MAX_BYTES / 3) * 4)
        throw new imageLibrary_1.ImageLibraryError(`Images must be ${GRF_engine_1.GRF_IMAGE_MAX_MB} MB or smaller`, 413);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageData))
        throw new imageLibrary_1.ImageLibraryError('Invalid image encoding');
    const bytes = Buffer.from(imageData, 'base64');
    if (!bytes.length || bytes.length > GRF_engine_1.GRF_IMAGE_MAX_BYTES)
        throw new imageLibrary_1.ImageLibraryError(`Images must be ${GRF_engine_1.GRF_IMAGE_MAX_MB} MB or smaller`, 413);
    validateImageBytes(bytes, mimeType);
    return { imageData, mimeType };
}
function validateImageBytes(bytes, mimeType) {
    if (!bytes.length || bytes.length > GRF_engine_1.GRF_IMAGE_MAX_BYTES)
        throw new imageLibrary_1.ImageLibraryError(`Images must be ${GRF_engine_1.GRF_IMAGE_MAX_MB} MB or smaller`, 413);
    const matches = mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : mimeType === 'image/webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
                : /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(bytes.toString('utf8').trimStart());
    if (!matches)
        throw new imageLibrary_1.ImageLibraryError('Image bytes do not match the selected format. Use PNG, JPEG, WebP, or SVG.');
}
//# sourceMappingURL=image-validation.js.map