/**
 * NEXUSMAIL TRIGGER ENGINE
 * 
 * The execution layer between system completion points and email delivery.
 * Responsibilities:
 * - Confirm trigger exists and is registered
 * - Confirm trigger is ACTIVE for this site
 * - Validate required payload variables
 * - Generate idempotency key
 * - Check whether trigger already fired
 * - Resolve template slug
 * - Hand off to delivery adapter
 * - Log success or failure
 */

import {
  TriggerName,
  EntityType,
  NexusMailMessage,
  NexusMailMeta,
  TriggerContract,
} from "../types";
import { TriggerRegistry, isTriggerEnabled, SiteId } from "../contracts";
import {
  generateIdempotencyKey,
  generateUUID,
  validatePayload,
  isValidEmail,
  nowISO,
} from "../utils";

// ============================================================================
// TRIGGER ENGINE RESULT TYPES
// ============================================================================

export type TriggerResult =
  | { success: true; message: NexusMailMessage }
  | { success: false; reason: TriggerFailReason; details?: string };

export type TriggerFailReason =
  | "TRIGGER_NOT_FOUND"
  | "TRIGGER_DISABLED"
  | "PAYLOAD_VALIDATION_FAILED"
  | "INVALID_RECIPIENT"
  | "ALREADY_SENT"
  | "GOVERNANCE_BLOCKED";

// ============================================================================
// IDEMPOTENCY STORE INTERFACE
// ============================================================================

/**
 * Interface for checking/storing idempotency state.
 * Must be implemented by storage adapters (Firestore, memory, etc.)
 */
export interface IdempotencyStore {
  hasBeenSent(idempotencyKey: string): Promise<boolean>;
  markAsSent(idempotencyKey: string, messageId: string): Promise<void>;
}

// ============================================================================
// GOVERNANCE CHECK INTERFACE
// ============================================================================

/**
 * Interface for governance configuration checks.
 * Returns whether sending is allowed for a trigger/template.
 */
export interface GovernanceChecker {
  isSendingEnabled(siteId: SiteId): Promise<boolean>;
  isTriggerDisabled(triggerName: TriggerName, siteId: SiteId): Promise<boolean>;
  isTemplateDisabled(templateSlug: string, siteId: SiteId): Promise<boolean>;
}

// ============================================================================
// TRIGGER ENGINE OPTIONS
// ============================================================================

export interface TriggerEngineOptions {
  siteId: SiteId;
  environment: "prod" | "staging" | "dev";
  idempotencyStore?: IdempotencyStore;
  governanceChecker?: GovernanceChecker;
  logger?: TriggerEngineLogger;
}

export interface TriggerEngineLogger {
  info(event: string, data: Record<string, any>): void;
  warn(event: string, data: Record<string, any>): void;
  error(event: string, data: Record<string, any>): void;
}

// ============================================================================
// DEFAULT LOGGER
// ============================================================================

const defaultLogger: TriggerEngineLogger = {
  info: (event, data) => console.log(`[NexusMail:INFO] ${event}`, data),
  warn: (event, data) => console.warn(`[NexusMail:WARN] ${event}`, data),
  error: (event, data) => console.error(`[NexusMail:ERROR] ${event}`, data),
};

// ============================================================================
// TRIGGER ENGINE CLASS
// ============================================================================

export class TriggerEngine {
  private siteId: SiteId;
  private environment: "prod" | "staging" | "dev";
  private idempotencyStore?: IdempotencyStore;
  private governanceChecker?: GovernanceChecker;
  private logger: TriggerEngineLogger;

  constructor(options: TriggerEngineOptions) {
    this.siteId = options.siteId;
    this.environment = options.environment;
    this.idempotencyStore = options.idempotencyStore;
    this.governanceChecker = options.governanceChecker;
    this.logger = options.logger || defaultLogger;
  }

  /**
   * Fire a trigger to create a mail message.
   * This is the main entry point for sending emails.
   */
  async fire(
    triggerName: TriggerName,
    entityId: string,
    newState: string,
    payload: Record<string, any>,
    overrides?: {
      recipientEmail?: string;
      initiatedBy?: "system" | "admin" | "user";
      hostDomain?: string;
    }
  ): Promise<TriggerResult> {
    const now = nowISO();

    // Step 1: Confirm trigger exists
    const contract = TriggerRegistry[triggerName];
    if (!contract) {
      this.logger.error("trigger_not_found", { triggerName });
      return { success: false, reason: "TRIGGER_NOT_FOUND" };
    }

    // Step 2: Confirm trigger is ACTIVE for this site
    if (!isTriggerEnabled(triggerName, this.siteId)) {
      this.logger.warn("trigger_disabled_for_site", {
        triggerName,
        siteId: this.siteId,
      });
      return {
        success: false,
        reason: "TRIGGER_DISABLED",
        details: `Trigger ${triggerName} is not enabled for site ${this.siteId}`,
      };
    }

    // Step 3: Check governance (if checker provided)
    if (this.governanceChecker) {
      const sendingEnabled = await this.governanceChecker.isSendingEnabled(this.siteId);
      if (!sendingEnabled) {
        this.logger.warn("sending_disabled", { siteId: this.siteId });
        return {
          success: false,
          reason: "GOVERNANCE_BLOCKED",
          details: "Sending is globally disabled for this site",
        };
      }

      const triggerDisabled = await this.governanceChecker.isTriggerDisabled(
        triggerName,
        this.siteId
      );
      if (triggerDisabled) {
        this.logger.warn("trigger_disabled_governance", {
          triggerName,
          siteId: this.siteId,
        });
        return {
          success: false,
          reason: "GOVERNANCE_BLOCKED",
          details: `Trigger ${triggerName} is disabled by governance`,
        };
      }

      const templateDisabled = await this.governanceChecker.isTemplateDisabled(
        contract.templateSlug,
        this.siteId
      );
      if (templateDisabled) {
        this.logger.warn("template_disabled_governance", {
          templateSlug: contract.templateSlug,
          siteId: this.siteId,
        });
        return {
          success: false,
          reason: "GOVERNANCE_BLOCKED",
          details: `Template ${contract.templateSlug} is disabled by governance`,
        };
      }
    }

    // Step 4: Validate required payload variables
    const validation = validatePayload(payload, contract.requiredVars);
    if (!validation.valid) {
      this.logger.error("payload_validation_failed", {
        triggerName,
        missing: validation.missing,
      });
      return {
        success: false,
        reason: "PAYLOAD_VALIDATION_FAILED",
        details: `Missing required variables: ${validation.missing.join(", ")}`,
      };
    }

    // Step 5: Resolve recipient
    const recipientEmail = overrides?.recipientEmail || contract.recipientResolver(payload);
    if (!recipientEmail || !isValidEmail(recipientEmail)) {
      this.logger.error("invalid_recipient", {
        triggerName,
        recipientEmail,
      });
      return {
        success: false,
        reason: "INVALID_RECIPIENT",
        details: `Invalid or missing recipient email: ${recipientEmail}`,
      };
    }

    // Step 6: Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
      triggerName,
      contract.entityType,
      entityId,
      newState
    );

    // Step 7: Check idempotency (if store provided)
    if (this.idempotencyStore) {
      const alreadySent = await this.idempotencyStore.hasBeenSent(idempotencyKey);
      if (alreadySent) {
        this.logger.info("already_sent", { idempotencyKey, triggerName });
        return {
          success: false,
          reason: "ALREADY_SENT",
          details: `Email already sent for key: ${idempotencyKey}`,
        };
      }
    }

    // Step 8: Create the message object
    const messageId = generateUUID();
    const message: NexusMailMessage = {
      messageId,
      idempotencyKey,
      triggerName,
      templateSlug: contract.templateSlug,
      recipient: {
        email: recipientEmail,
        name: payload.recipient_name || payload.customer_name || payload.business_name,
      },
      payload,
      meta: {
        siteId: this.siteId,
        environment: this.environment,
        entityType: contract.entityType,
        entityId,
        initiatedBy: overrides?.initiatedBy || "system",
        hostDomain: overrides?.hostDomain,
      },
      timestamps: {
        createdAt: now,
        triggeredAt: now,
      },
    };

    this.logger.info("trigger_fired", {
      triggerName,
      messageId,
      idempotencyKey,
      recipient: recipientEmail,
      entityType: contract.entityType,
      entityId,
    });

    return { success: true, message };
  }

  /**
   * Get a trigger contract by name.
   */
  getContract(triggerName: TriggerName): TriggerContract | undefined {
    return TriggerRegistry[triggerName];
  }

  /**
   * Check if a trigger is enabled for the current site.
   */
  isEnabled(triggerName: TriggerName): boolean {
    return isTriggerEnabled(triggerName, this.siteId);
  }

  /**
   * List all enabled triggers for the current site.
   */
  listEnabledTriggers(): TriggerName[] {
    return Object.keys(TriggerRegistry).filter((name) =>
      isTriggerEnabled(name as TriggerName, this.siteId)
    ) as TriggerName[];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a TriggerEngine instance with options.
 */
export function createTriggerEngine(options: TriggerEngineOptions): TriggerEngine {
  return new TriggerEngine(options);
}
