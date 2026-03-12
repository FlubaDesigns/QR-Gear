"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const constants_1 = require("../constants");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ BRAIN PROXY ENDPOINTS ============
    app.post("/brain/submit", middleware_1.requireAuth, async (req, res) => {
        try {
            const secret = process.env.FLUBA_SITE_SECRET;
            const brainUrl = process.env.FLUBA_BRAIN_URL;
            if (!secret || !brainUrl) {
                res.status(503).json({ error: "Brain proxy not configured" });
                return;
            }
            const crypto = await Promise.resolve().then(() => __importStar(require("crypto")));
            const body = {
                action: req.body.action,
                payload: req.body.payload,
                prompt: req.body.prompt,
            };
            const raw = JSON.stringify(body);
            const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
            const r = await fetch(brainUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-site-id": constants_1.PLATFORM_STORE_ID,
                    "x-signature": sig,
                },
                body: raw,
            });
            const data = await r.json();
            res.json(data);
        }
        catch (err) {
            console.error("[Brain Proxy CF] Error:", err.message);
            res.status(500).json({ error: "Brain proxy failed" });
        }
    });
}
//# sourceMappingURL=brain.js.map