"use strict";
/**
 * NEXUSMAIL SERVICE
 *
 * Main orchestrator for NexusMail in Firebase Cloud Functions.
 * Combines all components: TriggerEngine → TemplateResolver → OutboxService → Provider
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NexusMailService = void 0;
exports.getNexusMailService = getNexusMailService;
exports.sendOrderConfirmation = sendOrderConfirmation;
exports.sendShippingNotification = sendShippingNotification;
const nexusmail_1 = require("../../../shared/nexusmail");
const ResendProviderAdapter_1 = require("./ResendProviderAdapter");
const FirestoreAdapters_1 = require("./FirestoreAdapters");
const QRGearBranding_1 = require("./QRGearBranding");
// ============================================================================
// NEXUSMAIL SERVICE CLASS
// ============================================================================
class NexusMailService {
    constructor(config) {
        this.outboxService = null;
        this.config = config;
        // Initialize Firestore adapters
        this.outboxRepo = (0, FirestoreAdapters_1.createFirestoreOutboxRepository)(config.db);
        this.templateStore = (0, FirestoreAdapters_1.createFirestoreTemplateStore)(config.db);
        this.idempotencyStore = (0, FirestoreAdapters_1.createFirestoreIdempotencyStore)(config.db);
        const healthStore = (0, FirestoreAdapters_1.createFirestoreHealthStore)(config.db);
        // Initialize provider
        this.provider = (0, ResendProviderAdapter_1.createResendProviderFromEnv)();
        // Initialize health monitor
        this.healthMonitor = new nexusmail_1.ProviderHealthMonitor({
            store: healthStore,
        });
        // Initialize trigger engine
        this.triggerEngine = new nexusmail_1.TriggerEngine({
            siteId: config.siteId,
            environment: config.environment,
            idempotencyStore: this.idempotencyStore,
            logger: {
                info: (e, d) => console.log(`[NexusMail:Trigger] ${e}`, JSON.stringify(d)),
                warn: (e, d) => console.warn(`[NexusMail:Trigger] ${e}`, JSON.stringify(d)),
                error: (e, d) => console.error(`[NexusMail:Trigger] ${e}`, JSON.stringify(d)),
            },
        });
        // Initialize template resolver with QR Gear branding
        this.templateResolver = new nexusmail_1.TemplateResolver({
            templateStore: this.templateStore,
            brandingAdapter: (0, QRGearBranding_1.createQRGearBranding)(),
            logger: {
                info: (e, d) => console.log(`[NexusMail:Template] ${e}`, JSON.stringify(d)),
                warn: (e, d) => console.warn(`[NexusMail:Template] ${e}`, JSON.stringify(d)),
                error: (e, d) => console.error(`[NexusMail:Template] ${e}`, JSON.stringify(d)),
            },
        });
        // Initialize outbox service (only if provider available)
        if (this.provider) {
            this.outboxService = new nexusmail_1.OutboxService({
                repository: this.outboxRepo,
                provider: this.provider,
                logger: {
                    info: (e, d) => console.log(`[NexusMail:Outbox] ${e}`, JSON.stringify(d)),
                    warn: (e, d) => console.warn(`[NexusMail:Outbox] ${e}`, JSON.stringify(d)),
                    error: (e, d) => console.error(`[NexusMail:Outbox] ${e}`, JSON.stringify(d)),
                },
                onSent: async (record) => {
                    // Mark idempotency key as sent
                    await this.idempotencyStore.markAsSent(record.idempotencyKey, record.messageId);
                    // Record health outcome
                    await this.healthMonitor.recordOutcome('resend', {
                        success: true,
                        retryable: false,
                        timestamp: (0, nexusmail_1.nowISO)(),
                    });
                },
                onFailed: async (_record, result) => {
                    // Record health outcome
                    await this.healthMonitor.recordOutcome('resend', {
                        success: false,
                        retryable: result.retryable,
                        errorCode: result.errorCode,
                        timestamp: (0, nexusmail_1.nowISO)(),
                    });
                },
                onDead: async (record) => {
                    console.error('[NexusMail] Dead letter:', {
                        outboxId: record.outboxId,
                        triggerName: record.triggerName,
                        recipient: record.recipientEmail,
                    });
                },
            });
        }
    }
    /**
     * Send an email via trigger.
     * This is the main entry point for sending emails.
     */
    async send(triggerName, entityId, newState, payload, overrides) {
        // Step 1: Fire trigger to create message
        const triggerResult = await this.triggerEngine.fire(triggerName, entityId, newState, payload, overrides);
        if (!triggerResult.success) {
            return {
                success: false,
                reason: triggerResult.reason,
                details: triggerResult.details,
            };
        }
        const message = triggerResult.message;
        // Step 2: Resolve template
        const resolveResult = await this.templateResolver.resolve(message.templateSlug, message.payload, message.meta, message.triggerName);
        if (!resolveResult.success) {
            return {
                success: false,
                reason: resolveResult.reason,
                details: resolveResult.details,
            };
        }
        const rendered = resolveResult.rendered;
        // Step 3: Check if provider is healthy
        if (this.healthMonitor.isPaused('resend')) {
            console.warn('[NexusMail] Provider is paused - queueing only');
        }
        // Step 4: Enqueue in outbox
        if (!this.outboxService) {
            return {
                success: false,
                reason: 'PROVIDER_NOT_CONFIGURED',
                details: 'Email provider (Resend) is not configured',
            };
        }
        const enqueueResult = await this.outboxService.enqueue(message, rendered);
        if (!enqueueResult.success) {
            return {
                success: false,
                reason: 'ENQUEUE_FAILED',
                details: enqueueResult.reason,
            };
        }
        // Step 5: If healthy, process immediately
        if (!this.healthMonitor.isPaused('resend') && enqueueResult.status === 'QUEUED') {
            const record = await this.outboxRepo.getById(enqueueResult.outboxId);
            if (record) {
                await this.outboxService.processOne(record);
            }
        }
        return {
            success: true,
            outboxId: enqueueResult.outboxId,
            messageId: message.messageId,
        };
    }
    /**
     * Process pending outbox items.
     * Called by scheduled function or on-demand.
     */
    async processOutbox(limit = 10) {
        if (!this.outboxService) {
            console.warn('[NexusMail] Cannot process outbox - provider not configured');
            return 0;
        }
        if (this.healthMonitor.isPaused('resend')) {
            console.warn('[NexusMail] Provider is paused - skipping outbox processing');
            return 0;
        }
        const concurrency = this.healthMonitor.getConcurrency('resend');
        if (concurrency === 0) {
            return 0;
        }
        const results = await this.outboxService.processReady(Math.min(limit, concurrency));
        return results.filter((r) => r.status === 'SENT').length;
    }
    /**
     * Retry failed outbox items.
     */
    async retryFailed(limit = 10) {
        if (!this.outboxService) {
            return 0;
        }
        const results = await this.outboxService.retryFailed(limit);
        return results.filter((r) => r.status === 'SENT').length;
    }
    /**
     * Get outbox statistics.
     */
    async getStats() {
        if (!this.outboxService) {
            return null;
        }
        return this.outboxService.getStats();
    }
    /**
     * Get provider health score.
     */
    getHealthScore() {
        return this.healthMonitor.getScore('resend');
    }
    /**
     * Check if NexusMail is ready (provider configured).
     */
    isReady() {
        return this.provider !== null && this.outboxService !== null;
    }
    /**
     * Get template store for admin operations.
     */
    getTemplateStore() {
        return this.templateStore;
    }
    /**
     * Get outbox repository for admin operations.
     */
    getOutboxRepo() {
        return this.outboxRepo;
    }
}
exports.NexusMailService = NexusMailService;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let nexusMailInstance = null;
function getNexusMailService(db) {
    if (!nexusMailInstance) {
        nexusMailInstance = new NexusMailService({
            siteId: 'qrgear',
            environment: process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
            db,
        });
    }
    return nexusMailInstance;
}
// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================
/**
 * Send order confirmation email via NexusMail.
 */
async function sendOrderConfirmation(db, orderId, customerEmail, customerName, orderItems, totalAmount, shippingAddress) {
    const service = getNexusMailService(db);
    return service.send('ORDER_CONFIRMATION', orderId, 'CONFIRMED', {
        order_number: orderId.slice(0, 8).toUpperCase(),
        customer_name: customerName,
        customer_email: customerEmail,
        order_total: totalAmount,
        order_items: orderItems
            .map((item) => `${item.productName} x${item.quantity} - $${item.price}`)
            .join('\n'),
        shipping_address: shippingAddress
            ? `${shippingAddress.address1}${shippingAddress.address2 ? ', ' + shippingAddress.address2 : ''}, ${shippingAddress.city}, ${shippingAddress.region} ${shippingAddress.zip}, ${shippingAddress.country}`
            : '',
    }, { recipientEmail: customerEmail });
}
/**
 * Send shipping notification email via NexusMail.
 */
async function sendShippingNotification(db, orderId, customerEmail, customerName, trackingNumber, carrier, trackingUrl) {
    const service = getNexusMailService(db);
    return service.send('ORDER_SHIPPED', orderId, 'SHIPPED', {
        order_number: orderId.slice(0, 8).toUpperCase(),
        customer_name: customerName,
        customer_email: customerEmail,
        tracking_number: trackingNumber,
        carrier,
        tracking_url: trackingUrl || '',
    }, { recipientEmail: customerEmail });
}
//# sourceMappingURL=NexusMailService.js.map