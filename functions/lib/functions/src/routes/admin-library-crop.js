"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminLibraryCrop = registerAdminLibraryCrop;
const middleware_1 = require("../middleware");
const grf_registrar_1 = require("../services/grf-registrar");
const grf_store_1 = require("../services/grf-store");
function registerAdminLibraryCrop(app) {
    app.post('/admin/library/crop-mint', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json(await (0, grf_registrar_1.registerSourceCrop)(req.body));
        }
        catch (error) {
            res.status(error instanceof grf_store_1.LibraryImageError ? error.status : 500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=admin-library-crop.js.map