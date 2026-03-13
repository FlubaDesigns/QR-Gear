"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const am_crud_1 = require("./am-crud");
const am_sync_1 = require("./am-sync");
const am_utility_1 = require("./am-utility");
function register(app) {
    (0, am_crud_1.register)(app);
    (0, am_sync_1.register)(app);
    (0, am_utility_1.register)(app);
}
//# sourceMappingURL=admin-misc.js.map