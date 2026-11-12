import type express from 'express';
import { db } from '../core';
import { partnerRewardProducts, partnerRewardPreview, partnerRewardStatus, approvePartnerReward } from '../services/partner-rewards';
import { authenticatePartner, partnerProducts, publicPartner } from '../services/partner-api';

export function register(app: express.Express): void {
  const rewards = (action: (partner: any, req: any) => Promise<any>) => async (req: any, res: any): Promise<void> => {
    res.set('Cache-Control', 'private, no-store');
    try { res.json(await action(await authenticatePartner(db, req), req)); }
    catch (error: any) {
      console.error('[Partner rewards]', error.status || 500, error.message);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Reward processing is temporarily unavailable. Retry to resume the same claim.' });
    }
  };
  app.get('/partner/rewards/products', rewards((partner, req) => partnerRewardProducts(partner, req.query.channelId)));
  app.post('/partner/rewards/preview', rewards((partner, req) => partnerRewardPreview(partner, req.body)));
  app.post('/partner/rewards/approve', rewards((partner, req) => approvePartnerReward(partner, req.body)));
  app.get('/partner/rewards/:claimId', rewards((partner, req) => partnerRewardStatus(partner, req.params.claimId, req.query.customerRef)));
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
