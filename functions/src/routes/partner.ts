import type express from 'express';
import { db } from '../core';
import { authenticatePartner, partnerProducts, publicPartner } from '../services/partner-api';

export function register(app: express.Express): void {
  for (const path of ['/partner/verify', '/partner/products']) {
    app.get(path, async (req, res): Promise<void> => {
      res.set('Cache-Control', 'private, no-store');
      try {
        const partner = await authenticatePartner(db, req);
        res.json(path === '/partner/verify'
          ? { ok: true, partner: publicPartner(partner) }
          : await partnerProducts(db, partner, req.query));
      } catch (error: any) {
        console.error('[Partner API]', error.status || 500, error.message);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Partner API unavailable. Please retry.' });
      }
    });
  }
}
