import type { Express } from "express";
import crypto from "crypto";
import { isAuthenticated } from "../firebaseAuth";

function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function registerBrainRoutes(app: Express): void {
  app.post("/api/brain/submit", isAuthenticated, async (req, res) => {
    try {
      const secret = process.env.FLUBA_SITE_SECRET;
      const brainUrl = process.env.FLUBA_BRAIN_URL;

      if (!secret || !brainUrl) {
        return res.status(503).json({ error: "Brain proxy not configured" });
      }

      const body = {
        action: req.body.action,
        payload: req.body.payload,
        prompt: req.body.prompt,
      };

      const raw = JSON.stringify(body);
      const sig = sign(secret, raw);

      const r = await fetch(brainUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-site-id": "qr-gear",
          "x-signature": sig,
        },
        body: raw,
      });

      const data = await r.json();
      res.json(data);
    } catch (err: any) {
      console.error("[Brain Proxy] Error:", err.message);
      res.status(500).json({ error: "Brain proxy failed" });
    }
  });
}
