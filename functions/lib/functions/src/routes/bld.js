"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBld = registerBld;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const admin_composition_routes_1 = require("../services/admin-composition-routes");
function registerBld(app) {
    (0, admin_composition_routes_1.registerCompositionRoutes)(app, '/admin', middleware_1.requireAdmin, { db: () => core_1.db, now: () => core_1.admin.firestore.FieldValue.serverTimestamp() }, 'bld');
}
//# sourceMappingURL=bld.js.map