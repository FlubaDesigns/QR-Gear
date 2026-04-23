import { Request, Response } from 'express';
import express from 'express';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import { getNexusMailService } from '../nexusmail';
import {
  MARKETPLACE_ACCOUNTS_COLLECTION,
  MARKETPLACE_SYNC_JOBS_COLLECTION,
  AFFILIATE_PAYOUT_LEDGER_COLLECTION,
} from '../constants';

export interface QueueItem {
  id: string;
  title: string;
  reason: string;
  priority: 'critical' | 'important' | 'next' | 'optional';
  category: 'system' | 'email' | 'marketplace' | 'sell' | 'banking' | 'place';
  href: string;
  count?: number;
}

async function buildQueue(): Promise<QueueItem[]> {
  const items: QueueItem[] = [];

  const settled = await Promise.allSettled([
    // 1. Stripe Connect — check if live secret key is set
    (async () => {
      const key = process.env.STRIPE_SECRET_KEY || '';
      if (!key || key.startsWith('sk_test_') || key === '') {
        items.push({
          id: 'stripe-not-live',
          title: 'Stripe not in live mode',
          reason: key ? 'Secret key is test mode — switch to live keys before accepting real payments' : 'No Stripe secret key configured',
          priority: 'critical',
          category: 'banking',
          href: '/admin/settings',
        });
      }
    })(),

    // 2. NexusMail / Resend health
    (async () => {
      try {
        const service = getNexusMailService(db);
        if (!service.isReady()) {
          items.push({
            id: 'email-not-configured',
            title: 'Email not configured',
            reason: 'Resend API key not set — transactional emails will not send',
            priority: 'critical',
            category: 'email',
            href: '/admin/settings',
          });
          return;
        }
        const health: any = await service.getHealthScore();
        const stats: any = await service.getStats();

        if (health?.isPaused) {
          items.push({
            id: 'email-paused',
            title: 'Email system is paused',
            reason: 'NexusMail outbox is paused — emails will not send until resumed',
            priority: 'critical',
            category: 'email',
            href: '/admin/email-health',
          });
        } else if (health?.status === 'unhealthy') {
          items.push({
            id: 'email-unhealthy',
            title: 'Email system unhealthy',
            reason: `Health score ${health.score}/100 — ${health.consecutiveFailures} consecutive failures`,
            priority: 'critical',
            category: 'email',
            href: '/admin/email-health',
          });
        } else if (health?.status === 'degraded') {
          items.push({
            id: 'email-degraded',
            title: 'Email system degraded',
            reason: `Health score ${health.score}/100 — delivery may be unreliable`,
            priority: 'important',
            category: 'email',
            href: '/admin/email-health',
          });
        }

        if (stats?.dead > 0) {
          items.push({
            id: 'email-dead-letters',
            title: 'Dead email messages in outbox',
            reason: `${stats.dead} message${stats.dead === 1 ? '' : 's'} permanently failed — manual review needed`,
            priority: 'critical',
            category: 'email',
            href: '/admin/email-health',
            count: stats.dead,
          });
        }

        if (stats?.failed > 0) {
          items.push({
            id: 'email-failed',
            title: 'Failed emails in outbox',
            reason: `${stats.failed} message${stats.failed === 1 ? '' : 's'} failed — will retry automatically`,
            priority: 'important',
            category: 'email',
            href: '/admin/email-health',
            count: stats.failed,
          });
        }
      } catch { /* nexusmail may not be configured */ }
    })(),

    // 3. Marketplace sync jobs — failed
    (async () => {
      try {
        const snap = await db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION)
          .where('status', '==', 'failed')
          .orderBy('updatedAt', 'desc')
          .limit(50)
          .get();
        if (!snap.empty) {
          items.push({
            id: 'sync-jobs-failed',
            title: 'Marketplace sync jobs failed',
            reason: `${snap.size} job${snap.size === 1 ? '' : 's'} failed — listings may be out of sync`,
            priority: 'critical',
            category: 'marketplace',
            href: '/admin/marketplaces',
            count: snap.size,
          });
        }
      } catch { /* collection may not exist yet */ }
    })(),

    // 4. Marketplace accounts — disconnected
    (async () => {
      try {
        const snap = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).get();
        const disconnected = snap.docs.filter(d => {
          const data = d.data();
          return data.isActive && data.authStatus !== 'connected' && !data.accessToken;
        });
        if (disconnected.length > 0) {
          items.push({
            id: 'marketplace-disconnected',
            title: 'Marketplace account not connected',
            reason: `${disconnected.length} active account${disconnected.length === 1 ? '' : 's'} missing OAuth — listings cannot sync`,
            priority: 'important',
            category: 'marketplace',
            href: '/admin/marketplaces',
            count: disconnected.length,
          });
        }
      } catch { /* collection may not exist yet */ }
    })(),

    // 5. Partner stores — missing allowedOrigins
    (async () => {
      try {
        const snap = await db.collection('partnerStores').get();
        const incomplete = snap.docs.filter(d => {
          const data = d.data();
          return data.isActive && (!data.allowedOrigins || data.allowedOrigins.trim() === '');
        });
        if (incomplete.length > 0) {
          items.push({
            id: 'partner-missing-origins',
            title: 'Partner store missing allowed origins',
            reason: `${incomplete.length} active store${incomplete.length === 1 ? '' : 's'} with no allowed origins — embedded builder will be blocked`,
            priority: 'important',
            category: 'place',
            href: '/admin/partners',
            count: incomplete.length,
          });
        }
      } catch { /* collection may not exist yet */ }
    })(),

    // 6. Provider health — down or degraded
    (async () => {
      try {
        const snap = await db.collection('provider_health_checks')
          .orderBy('checkedAt', 'desc')
          .limit(50)
          .get();

        const latestByProvider = new Map<string, any>();
        snap.docs.forEach(d => {
          const data = d.data();
          if (!latestByProvider.has(data.providerType)) {
            latestByProvider.set(data.providerType, data);
          }
        });

        const down = [...latestByProvider.values()].filter(p => p.status === 'down');
        const degraded = [...latestByProvider.values()].filter(p => p.status === 'degraded');

        down.forEach(p => {
          items.push({
            id: `provider-down-${p.providerType}`,
            title: `${p.providerType} provider is down`,
            reason: 'Provider health check failed — dependent features will not work',
            priority: 'critical',
            category: 'system',
            href: '/admin/health',
          });
        });

        if (degraded.length > 0) {
          items.push({
            id: 'providers-degraded',
            title: `${degraded.length} provider${degraded.length === 1 ? '' : 's'} degraded`,
            reason: degraded.map(p => p.providerType).join(', ') + ' — reliability may be reduced',
            priority: 'important',
            category: 'system',
            href: '/admin/health',
            count: degraded.length,
          });
        }
      } catch { /* collection may not exist yet */ }
    })(),

    // 7. Orders — pending fulfillment
    (async () => {
      try {
        const snap = await db.collection('orders')
          .where('fulfillmentStatus', '==', 'pending')
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get();
        if (!snap.empty) {
          items.push({
            id: 'orders-pending',
            title: 'Orders pending fulfillment',
            reason: `${snap.size} order${snap.size === 1 ? '' : 's'} waiting — review and submit to fulfillment provider`,
            priority: 'next',
            category: 'sell',
            href: '/admin/orders',
            count: snap.size,
          });
        }
      } catch { /* collection may not exist yet */ }
    })(),

    // 8. Affiliate payouts — pending
    (async () => {
      try {
        const snap = await db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION)
          .where('status', '==', 'pending')
          .limit(50)
          .get();
        if (!snap.empty) {
          const total = snap.docs.reduce((sum, d) => sum + (d.data().affiliateAmount || 0), 0);
          items.push({
            id: 'payouts-pending',
            title: 'Affiliate payouts pending approval',
            reason: `${snap.size} payout${snap.size === 1 ? '' : 's'} totaling $${total.toFixed(2)} waiting for approval`,
            priority: 'next',
            category: 'sell',
            href: '/admin/external-sites',
            count: snap.size,
          });
        }
      } catch { /* collection may not exist yet */ }
    })(),
  ]);

  // Log any unexpected errors
  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[AdminQueue] Signal ${i} failed:`, r.reason);
    }
  });

  // Sort: critical → important → next → optional
  const PRIORITY_ORDER = { critical: 0, important: 1, next: 2, optional: 3 };
  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return items;
}

// ── Setup checklist ───────────────────────────────────────────────────────────

export interface SetupItem {
  id: string;
  label: string;
  description: string;
  status: 'ok' | 'missing' | 'warning' | 'partial';
  action?: string;
  href: string;
  group: 'payments' | 'email' | 'fulfillment' | 'marketplaces' | 'ai' | 'platform';
}

async function buildSetupChecklist(): Promise<SetupItem[]> {
  const items: SetupItem[] = [];
  const env = process.env;

  // ── Payments ──────────────────────────────────────────────────────────────
  const stripeKey = env.STRIPE_SECRET_KEY || '';
  items.push({
    id: 'stripe-key',
    label: 'Stripe Secret Key',
    description: 'Required for payment processing',
    status: !stripeKey ? 'missing' : stripeKey.startsWith('sk_live_') ? 'ok' : 'warning',
    action: !stripeKey ? 'Add STRIPE_SECRET_KEY to environment' : stripeKey.startsWith('sk_test_') ? 'Switch from test key to live key before accepting real payments' : undefined,
    href: '/admin/settings',
    group: 'payments',
  });

  items.push({
    id: 'stripe-webhook',
    label: 'Stripe Webhook Secret',
    description: 'Required for validating Stripe webhook events',
    status: env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'missing',
    action: 'Add STRIPE_WEBHOOK_SECRET — configure endpoint at /api/stripe-webhooks in Stripe dashboard',
    href: '/admin/settings',
    group: 'payments',
  });

  // ── Email ─────────────────────────────────────────────────────────────────
  items.push({
    id: 'resend-key',
    label: 'Resend API Key',
    description: 'Required for all transactional emails (orders, shipping, members)',
    status: env.QR_RESEND_API_KEY ? 'ok' : 'missing',
    action: 'Get API key from resend.com and add as QR_RESEND_API_KEY',
    href: '/admin/settings',
    group: 'email',
  });

  // ── AI Brain ─────────────────────────────────────────────────────────────
  const brainUrl = env.FLUBA_BRAIN_URL || '';
  const brainSecret = env.FLUBA_SITE_SECRET || '';
  items.push({
    id: 'ai-brain',
    label: 'AI Brain Connection',
    description: 'Connects the dashboard to your AI operator brain',
    status: brainUrl && brainSecret ? 'ok' : brainUrl || brainSecret ? 'partial' : 'missing',
    action: !brainUrl && !brainSecret
      ? 'Set FLUBA_BRAIN_URL and FLUBA_SITE_SECRET to enable AI monitoring'
      : !brainUrl ? 'FLUBA_BRAIN_URL is missing' : 'FLUBA_SITE_SECRET is missing',
    href: '/admin/settings',
    group: 'ai',
  });

  // ── Fulfillment ───────────────────────────────────────────────────────────
  items.push({
    id: 'printify-key',
    label: 'Printify API Key',
    description: 'Required for product sync and order fulfillment via Printify',
    status: env.PRINTIFY_API_KEY ? 'ok' : 'warning',
    action: env.PRINTIFY_API_KEY ? undefined : 'PRINTIFY_API_KEY not set — using fallback key, set your own for production',
    href: '/admin/settings',
    group: 'fulfillment',
  });

  items.push({
    id: 'printful-key',
    label: 'Printful API Key',
    description: 'Required for Printful fulfillment and mockup generation',
    status: env.PRINTFUL_API_KEY ? 'ok' : 'missing',
    action: 'Get API key from printful.com/dashboard and add as PRINTFUL_API_KEY',
    href: '/admin/settings',
    group: 'fulfillment',
  });

  // ── Marketplaces ─────────────────────────────────────────────────────────
  items.push({
    id: 'etsy-oauth-app',
    label: 'Etsy OAuth App',
    description: 'Required to connect Etsy seller accounts and push listings',
    status: env.ETSY_KEYSTRING && env.ETSY_REDIRECT_URI ? 'ok' : env.ETSY_KEYSTRING || env.ETSY_REDIRECT_URI ? 'partial' : 'missing',
    action: !env.ETSY_KEYSTRING ? 'Register app at developers.etsy.com and set ETSY_KEYSTRING + ETSY_REDIRECT_URI' : !env.ETSY_REDIRECT_URI ? 'ETSY_REDIRECT_URI is missing' : undefined,
    href: '/admin/marketplaces',
    group: 'marketplaces',
  });

  items.push({
    id: 'ebay-oauth-app',
    label: 'eBay OAuth App',
    description: 'Required to connect eBay seller accounts and push listings',
    status: env.EBAY_APP_ID && env.EBAY_CERT_ID && env.EBAY_RUNAME ? 'ok' : (env.EBAY_APP_ID || env.EBAY_CERT_ID || env.EBAY_RUNAME) ? 'partial' : 'missing',
    action: !env.EBAY_APP_ID ? 'Register app at developer.ebay.com and set EBAY_APP_ID, EBAY_CERT_ID, EBAY_RUNAME' : 'Some eBay credentials are missing — check EBAY_APP_ID, EBAY_CERT_ID, EBAY_RUNAME',
    href: '/admin/marketplaces',
    group: 'marketplaces',
  });

  // ── Platform ─────────────────────────────────────────────────────────────
  const adminIds = env.ADMIN_USER_IDS || '';
  const defaultAdminId = 'xHUmudG0t5OkCQhqyhB4nXhCUfs1';
  items.push({
    id: 'admin-user-ids',
    label: 'Admin User IDs',
    description: 'Explicitly configured list of admin user IDs',
    status: adminIds && adminIds !== defaultAdminId ? 'ok' : adminIds === defaultAdminId || !adminIds ? 'warning' : 'ok',
    action: !adminIds || adminIds === defaultAdminId ? 'Set ADMIN_USER_IDS to your Firebase UID — currently using hardcoded default' : undefined,
    href: '/admin/settings',
    group: 'platform',
  });

  return items;
}

export function register(app: express.Express): void {
  app.get('/admin/dashboard/queue', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await buildQueue();
      res.json({ items, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/admin/dashboard/setup', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await buildSetupChecklist();
      const missing = items.filter(i => i.status === 'missing').length;
      const warnings = items.filter(i => i.status === 'warning' || i.status === 'partial').length;
      res.json({ items, missing, warnings, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
