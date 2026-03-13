"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const pp_pricing_packets_1 = require("./pp-pricing-packets");
const pp_catalog_1 = require("./pp-catalog");
const pp_builder_1 = require("./pp-builder");
function register(app) {
    (0, pp_pricing_packets_1.register)(app);
    (0, pp_catalog_1.register)(app);
    (0, pp_builder_1.register)(app);
}
//# sourceMappingURL=products-page.js.map