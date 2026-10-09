"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSourceCrop = exports.registerSourceImage = exports.registerMockupGrfAssets = exports.registerPacketGrfAssets = exports.registerGrfAsset = void 0;
/** Production adapter for the shared permanent-file registrar. */
const core_1 = require("../core");
const grf_store_1 = require("./grf-store");
const registrar = (0, grf_store_1.createGrfRegistrar)({ db: core_1.db, now: () => core_1.admin.firestore.FieldValue.serverTimestamp(), bucket: () => core_1.admin.storage().bucket() });
exports.registerGrfAsset = registrar.registerGrfAsset, exports.registerPacketGrfAssets = registrar.registerPacketGrfAssets, exports.registerMockupGrfAssets = registrar.registerMockupGrfAssets, exports.registerSourceImage = registrar.registerSourceImage, exports.registerSourceCrop = registrar.registerSourceCrop;
//# sourceMappingURL=grf-registrar.js.map