"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_FOLDER_MAX_LENGTH = exports.IMAGE_LIBRARY_MAX_MB = exports.IMAGE_LIBRARY_MAX_BYTES = exports.IMAGE_LIBRARY_ACCEPT = exports.ImageLibraryError = void 0;
exports.normalizeImageFolder = normalizeImageFolder;
exports.validateImageUpload = validateImageUpload;
exports.imageExtension = imageExtension;
exports.publicImageUrl = publicImageUrl;
const GRF_engine_1 = require("./GRF_engine");
class ImageLibraryError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
exports.ImageLibraryError = ImageLibraryError;
// Images and GRF assets share image formats and limits, not identities or collections.
exports.IMAGE_LIBRARY_ACCEPT = GRF_engine_1.GRF_IMAGE_ACCEPT_TYPES;
exports.IMAGE_LIBRARY_MAX_BYTES = GRF_engine_1.GRF_IMAGE_MAX_BYTES;
exports.IMAGE_LIBRARY_MAX_MB = GRF_engine_1.GRF_IMAGE_MAX_MB;
exports.IMAGE_FOLDER_MAX_LENGTH = 80;
function normalizeImageFolder(value) {
    const name = value.trim().replace(/\s+/g, ' ');
    if (!name)
        throw new ImageLibraryError('Folder name is required');
    if (name.length > exports.IMAGE_FOLDER_MAX_LENGTH)
        throw new ImageLibraryError(`Folder names must be ${exports.IMAGE_FOLDER_MAX_LENGTH} characters or less`);
    return name;
}
function validateImageUpload(mime, size) {
    let normalized;
    try {
        normalized = (0, GRF_engine_1.normalizeMimeType)(mime);
    }
    catch (error) {
        throw new ImageLibraryError(error.message);
    }
    if (size <= 0)
        throw new ImageLibraryError('The image file is empty');
    if (size > exports.IMAGE_LIBRARY_MAX_BYTES)
        throw new ImageLibraryError(`Images must be ${exports.IMAGE_LIBRARY_MAX_MB} MB or smaller`);
    return normalized;
}
function imageExtension(mime) {
    let normalized;
    try {
        normalized = (0, GRF_engine_1.normalizeMimeType)(mime);
    }
    catch (error) {
        throw new ImageLibraryError(error.message);
    }
    return Object.values(GRF_engine_1.GRF_FORMATS['1']).find(format => format.mime === normalized).label;
}
function publicImageUrl(bucket, path) {
    return `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
//# sourceMappingURL=imageLibrary.js.map