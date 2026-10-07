"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateQrgInstance = allocateQrgInstance;
const core_1 = require("../core");
const qrg_instance_store_1 = require("./qrg-instance-store");
function allocateQrgInstance(opts) {
    return (0, qrg_instance_store_1.allocateQrgInstanceRecord)(core_1.db, () => core_1.admin.firestore.FieldValue.serverTimestamp(), opts);
}
//# sourceMappingURL=qrg-instance-allocator.js.map