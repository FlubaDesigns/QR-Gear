"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminLibrarySource = registerAdminLibrarySource;
const middleware_1 = require("../middleware");
const grf_registrar_1 = require("../services/grf-registrar");
const grf_store_1 = require("../services/grf-store");
function registerAdminLibrarySource(app) {
    app.post('/admin/library/upload-source', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json(await (0, grf_registrar_1.registerSourceImage)(req.body));
        }
        catch (error) {
            res.status(error instanceof grf_store_1.LibraryImageError ? error.status : 500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=admin-library-source.js.map