"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
function register(app) {
    app.get('/deploy-proof', (_req, res) => {
        res.json({
            ok: true,
            target: 'firebase-functions',
            functionName: 'api',
            project: 'qrgear-c1ffd',
            deployedAtRuntime: new Date().toISOString(),
            buildId: process.env.QRGEAR_BUILD_ID || 'missing-build-id'
        });
    });
}
//# sourceMappingURL=deploy-proof.js.map