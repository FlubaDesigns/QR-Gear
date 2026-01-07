/**
 * NEXUSMAIL SERVICE
 * 
 * Main orchestrator for NexusMail in Firebase Cloud Functions.
 * Combines all components: TriggerEngine → TemplateResolver → OutboxService → Provider
 */

import * as admin from 'firebase-admin';
import {
  TriggerEngine,
  TemplateResolver,
  OutboxService,
  ProviderHealthMonitor,
  TriggerName,
  NexusMailMessage,
  NexusMailRenderedEmail,
  SiteId,
  nowISO,
} from '../../../shared/nexusmail';

import { createResendProviderFromEnv, ResendProviderAdapter } from './ResendProviderAdapter';
import {
  createFirestoreOutboxRepository,
  createFirestoreTemplateStore,
  createFirestoreIdempotencyStore,
  createFirestoreHealthStore,
  FirestoreOutboxRepository,
  FirestoreTemplateStore,
  FirestoreIdempotencyStore,
} from './FirestoreAdapters';
import { createQRGearBranding } from './QRGearBranding';

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

export interface NexusMailServiceConfig {
  siteId: SiteId;
  environment: 'prod' | 'staging' | 'dev';
  db: admin.firestore.Firestore;
}

// ============================================================================
// SEND RESULT
// ============================================================================

export type SendResult =
  | { success: true; outboxId: string; messageId: string }
  | { success: false; reason: string; details?: string };

// ============================================================================
// NEXUSMAIL SERVICE CLASS
// ============================================================================

export class NexusMailService {
  private config: NexusMailServiceConfig;
  private triggerEngine: TriggerEngine;
  private templateResolver: TemplateResolver;
  private outboxService: OutboxService | null = null;
  private healthMonitor: ProviderHealthMonitor;
  private provider: ResendProviderAdapter | null;
  
  // Repositories
  private outboxRepo: FirestoreOutboxRepository;
  private templateStore: FirestoreTemplateStore;
  private idempotencyStore: FirestoreIdempotencyStore;

  constructor(config: NexusMailServiceConfig) {
    this.config = config;

    // Initialize Firestore adapters
    this.outboxRepo = createFirestoreOutboxRepository(config.db);
    this.templateStore = createFirestoreTemplateStore(config.db);
    this.idempotencyStore = createFirestoreIdempotencyStore(config.db);
    const healthStore = createFirestoreHealthStore(config.db);

    // Initialize provider
    this.provider = createResendProviderFromEnv();

    // Initialize health monitor
    this.healthMonitor = new ProviderHealthMonitor({
      store: healthStore,
    });

    // Initialize trigger engine
    this.triggerEngine = new TriggerEngine({
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
    this.templateResolver = new TemplateResolver({
      templateStore: this.templateStore,
      brandingAdapter: createQRGearBranding(),
      logger: {
        info: (e, d) => console.log(`[NexusMail:Template] ${e}`, JSON.stringify(d)),
        warn: (e, d) => console.warn(`[NexusMail:Template] ${e}`, JSON.stringify(d)),
        error: (e, d) => console.error(`[NexusMail:Template] ${e}`, JSON.stringify(d)),
      },
    });

    // Initialize outbox service (only if provider available)
    if (this.provider) {
      this.outboxService = new OutboxService({
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
            timestamp: nowISO(),
          });
        },
        onFailed: async (_record, result) => {
          // Record health outcome
          await this.healthMonitor.recordOutcome('resend', {
            success: false,
            retryable: result.retryable,
            errorCode: result.errorCode,
            timestamp: nowISO(),
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
  async send(
    triggerName: TriggerName,
    entityId: string,
    newState: string,
    payload: Record<string, any>,
    overrides?: {
      recipientEmail?: string;
      initiatedBy?: 'system' | 'admin' | 'user';
    }
  ): Promise<SendResult> {
    // Step 1: Fire trigger to create message
    const triggerResult = await this.triggerEngine.fire(
      triggerName,
      entityId,
      newState,
      payload,
      overrides
    );

    if (!triggerResult.success) {
      return {
        success: false,
        reason: triggerResult.reason,
        details: triggerResult.details,
      };
    }

    const message = triggerResult.message;

    // Step 2: Resolve template
    const resolveResult = await this.templateResolver.resolve(
      message.templateSlug,
      message.payload,
      message.meta,
      message.triggerName
    );

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
  async processOutbox(limit: number = 10): Promise<number> {
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
  async retryFailed(limit: number = 10): Promise<number> {
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
  isReady(): boolean {
    return this.provider !== null && this.outboxService !== null;
  }

  /**
   * Get template store for admin operations.
   */
  getTemplateStore(): FirestoreTemplateStore {
    return this.templateStore;
  }

  /**
   * Get outbox repository for admin operations.
   */
  getOutboxRepo(): FirestoreOutboxRepository {
    return this.outboxRepo;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let nexusMailInstance: NexusMailService | null = null;

export function getNexusMailService(db: admin.firestore.Firestore): NexusMailService {
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
export async function sendOrderConfirmation(
  db: admin.firestore.Firestore,
  orderId: string,
  customerEmail: string,
  customerName: string,
  orderItems: Array<{ productName: string; quantity: number; price: string }>,
  totalAmount: string,
  shippingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    region: string;
    zip: string;
    country: string;
  }
): Promise<SendResult> {
  const service = getNexusMailService(db);
  
  return service.send(
    'ORDER_CONFIRMATION',
    orderId,
    'CONFIRMED',
    {
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
    },
    { recipientEmail: customerEmail }
  );
}

/**
 * Send shipping notification email via NexusMail.
 */
export async function sendShippingNotification(
  db: admin.firestore.Firestore,
  orderId: string,
  customerEmail: string,
  customerName: string,
  trackingNumber: string,
  carrier: string,
  trackingUrl?: string
): Promise<SendResult> {
  const service = getNexusMailService(db);

  return service.send(
    'ORDER_SHIPPED',
    orderId,
    'SHIPPED',
    {
      order_number: orderId.slice(0, 8).toUpperCase(),
      customer_name: customerName,
      customer_email: customerEmail,
      tracking_number: trackingNumber,
      carrier,
      tracking_url: trackingUrl || '',
    },
    { recipientEmail: customerEmail }
  );
}
