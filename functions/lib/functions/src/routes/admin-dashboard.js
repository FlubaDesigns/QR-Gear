"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const nexusmail_1 = require("../nexusmail");
const constants_1 = require("../constants");
async function buildQueue() {
    const items = [];
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
                const service = (0, nexusmail_1.getNexusMailService)(core_1.db);
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
                const health = await service.getHealthScore();
                const stats = await service.getStats();
                if (health?.isPaused) {
                    items.push({
                        id: 'email-paused',
                        title: 'Email system is paused',
                        reason: 'NexusMail outbox is paused — emails will not send until resumed',
                        priority: 'critical',
                        category: 'email',
                        href: '/admin/email-health',
                    });
                }
                else if (health?.status === 'unhealthy') {
                    items.push({
                        id: 'email-unhealthy',
                        title: 'Email system unhealthy',
                        reason: `Health score ${health.score}/100 — ${health.consecutiveFailures} consecutive failures`,
                        priority: 'critical',
                        category: 'email',
                        href: '/admin/email-health',
                    });
                }
                else if (health?.status === 'degraded') {
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
            }
            catch { /* nexusmail may not be configured */ }
        })(),
        // 3. Marketplace sync jobs — failed
        (async () => {
            try {
                const snap = await core_1.db.collection(constants_1.MARKETPLACE_SYNC_JOBS_COLLECTION)
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
            }
            catch { /* collection may not exist yet */ }
        })(),
        // 4. Marketplace accounts — disconnected
        (async () => {
            try {
                const snap = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).get();
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
            }
            catch { /* collection may not exist yet */ }
        })(),
        // 5. Partner stores — missing allowedOrigins
        (async () => {
            try {
                const snap = await core_1.db.collection('partnerStores').get();
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
            }
            catch { /* collection may not exist yet */ }
        })(),
        // 6. Provider health — down or degraded
        (async () => {
            try {
                const snap = await core_1.db.collection('provider_health_checks')
                    .orderBy('checkedAt', 'desc')
                    .limit(50)
                    .get();
                const latestByProvider = new Map();
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
            }
            catch { /* collection may not exist yet */ }
        })(),
        // 7. Orders — pending fulfillment
        (async () => {
            try {
                const snap = await core_1.db.collection('orders')
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
            }
            catch { /* collection may not exist yet */ }
        })(),
        // 8. Affiliate payouts — pending
        (async () => {
            try {
                const snap = await core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION)
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
            }
            catch { /* collection may not exist yet */ }
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
function register(app) {
    app.get('/admin/dashboard/queue', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const items = await buildQueue();
            res.json({ items, generatedAt: new Date().toISOString() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=admin-dashboard.js.map