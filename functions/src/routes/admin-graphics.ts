import { Request, Response } from 'express';
import { db, admin, getStorageBucket } from '../core';
import { requireAdmin } from '../middleware';
import { registerGrfRoutes } from '../services/admin-grf-routes';

export function registerAdminGraphics(app: any): void {
  registerGrfRoutes(app, '/admin', requireAdmin, { db: () => db, bucket: getStorageBucket, now: () => admin.firestore.FieldValue.serverTimestamp() });

  app.get('/admin/proxy-image', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const url = req.query.url as string;
      if (!url) {
        res.status(400).json({ error: 'url query param required' });
        return;
      }
      if (
        !url.startsWith('https://firebasestorage.googleapis.com/') &&
        !url.startsWith('https://storage.googleapis.com/')
      ) {
        res.status(400).json({ error: 'Only Firebase Storage URLs are supported' });
        return;
      }
      const upstream = await fetch(url);
      if (!upstream.ok) {
        res.status(502).json({ error: `Upstream ${upstream.status}` });
        return;
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (err: any) {
      console.error('[GRF] proxy-image error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

}
