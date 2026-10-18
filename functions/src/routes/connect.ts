import { readFlubaProviderKey } from '../services/fluba-provider-keys';
import { Request, Response } from 'express';
import express from 'express';
import { db } from '../core';
import { requireAuth } from '../middleware';
import Stripe from 'stripe';
import { retrieveOwnedConnectAccount } from '../services/connect-accounts';

const MEMBER_PROFILES = 'member_profiles';
const PROFIT_SHARE_PERCENT = 0.25;

async function getStripe(): Promise<Stripe> {
  const key = (await readFlubaProviderKey('STRIPE_SECRET_KEY'));
  if (!key) throw new Error('Stripe not configured');
  return new Stripe(key, { apiVersion: '2023-10-16' as any });
}

function getBaseUrl(): string {
  return process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';
}

export function register(app: express.Express): void {

  // ── POST /api/connect/onboard ─────────────────────────────────────────────
  // Creates a Stripe Express account for the authenticated entity, stores the
  // accountId on their profile, and returns the onboarding URL.
  app.post('/connect/onboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const entityId = (req as any).user?.uid;
      if (!entityId) { res.status(401).json({ error: 'Not authenticated' }); return; }

      const stripe = await getStripe();
      const base = getBaseUrl();

      // Fetch existing profile
      const profileDoc = await db.collection(MEMBER_PROFILES).doc(entityId).get();
      const profile = profileDoc.data() || {};

      // If already has an account id, just refresh the link
      let accountId: string = profile.stripeConnectAccountId || '';

      if (accountId) {
        await retrieveOwnedConnectAccount(stripe, entityId, accountId);
      } else {
        const account = await stripe.accounts.create({
          type: 'express',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            entityId,
            entityType: profile.entityType || 'member',
          },
        });
        accountId = account.id;

        await db.collection(MEMBER_PROFILES).doc(entityId).set({
          stripeConnectAccountId: accountId,
          stripeOnboardingComplete: false,
          stripePayoutsEnabled: false,
          connectCreatedAt: new Date().toISOString(),
        }, { merge: true });

        console.log(`[Connect] Created Express account ${accountId} for entity ${entityId}`);
      }

      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${base}/members?connect_refresh=true`,
        return_url: `${base}/members?connect_return=true`,
        type: 'account_onboarding',
      });

      res.json({ url: link.url, accountId });
    } catch (err: any) {
      console.error('[Connect] Onboard error:', err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // ── GET /api/connect/onboard/refresh/:entityId ────────────────────────────
  // Compatibility for previously issued links: resume through signed-in UI.
  // Never mint an account link from a caller-supplied member ID.
  app.get('/connect/onboard/refresh/:entityId', (_req: Request, res: Response): void => {
    res.set('Cache-Control', 'private, no-store');
    res.redirect(`${getBaseUrl()}/members?connect_refresh=true`);
  });

  // ── GET /api/connect/status/:entityId ─────────────────────────────────────
  // Returns current Connect account status for the given entity.
  app.get('/connect/status/:entityId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const { entityId } = req.params;
      const requestingUid = (req as any).user?.uid;
      if (requestingUid !== entityId) { res.status(403).json({ error: 'Forbidden' }); return; }

      const profileDoc = await db.collection(MEMBER_PROFILES).doc(entityId).get();
      const profile = profileDoc.data() || {};

      const accountId: string = profile.stripeConnectAccountId || '';

      if (!accountId) {
        res.json({ connected: false, payoutsEnabled: false, onboardingComplete: false, accountId: null, profitSharePercent: PROFIT_SHARE_PERCENT });
        return;
      }

      // Fetch live status from Stripe to keep in sync
      const stripe = await getStripe();
      const account = await retrieveOwnedConnectAccount(stripe, entityId, accountId);

      const payoutsEnabled = account.payouts_enabled === true;
      const chargesEnabled = account.charges_enabled === true;
      const onboardingComplete = payoutsEnabled && chargesEnabled;

      // Persist any status changes
      if (profile.stripePayoutsEnabled !== payoutsEnabled || profile.stripeOnboardingComplete !== onboardingComplete) {
        await db.collection(MEMBER_PROFILES).doc(entityId).set({
          stripePayoutsEnabled: payoutsEnabled,
          stripeOnboardingComplete: onboardingComplete,
          stripeStatusSyncedAt: new Date().toISOString(),
        }, { merge: true });
      }

      res.json({
        connected: true,
        payoutsEnabled,
        chargesEnabled,
        onboardingComplete,
        accountId,
        profitSharePercent: PROFIT_SHARE_PERCENT,
        requirements: account.requirements?.currently_due || [],
      });
    } catch (err: any) {
      console.error('[Connect] Status error:', err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // ── POST /api/connect/dashboard-link/:entityId ────────────────────────────
  // Returns a one-time Stripe Express dashboard login URL.
  app.post('/connect/dashboard-link/:entityId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const { entityId } = req.params;
      const requestingUid = (req as any).user?.uid;
      if (requestingUid !== entityId) { res.status(403).json({ error: 'Forbidden' }); return; }

      const profileDoc = await db.collection(MEMBER_PROFILES).doc(entityId).get();
      const profile = profileDoc.data() || {};
      const accountId = profile.stripeConnectAccountId;

      if (!accountId) { res.status(400).json({ error: 'No connected account' }); return; }
      const stripe = await getStripe();
      const account = await retrieveOwnedConnectAccount(stripe, entityId, accountId);
      if (!account.payouts_enabled) { res.status(400).json({ error: 'Account not fully onboarded' }); return; }
      const loginLink = await stripe.accounts.createLoginLink(accountId);

      res.json({ url: loginLink.url });
    } catch (err: any) {
      console.error('[Connect] Dashboard link error:', err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

}
