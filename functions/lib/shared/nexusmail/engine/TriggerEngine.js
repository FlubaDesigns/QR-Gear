"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerEngine = void 0;
exports.createTriggerEngine = createTriggerEngine;
const contracts_1 = require("../contracts");
const utils_1 = require("../utils");
// ============================================================================
// DEFAULT LOGGER
// ============================================================================
const defaultLogger = {
    info: (event, data) => console.log(`[NexusMail:INFO] ${event}`, data),
    warn: (event, data) => console.warn(`[NexusMail:WARN] ${event}`, data),
    error: (event, data) => console.error(`[NexusMail:ERROR] ${event}`, data),
};
// ============================================================================
// TRIGGER ENGINE CLASS
// ============================================================================
class TriggerEngine {
    constructor(options) {
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
    async fire(triggerName, entityId, newState, payload, overrides) {
        const now = (0, utils_1.nowISO)();
        // Step 1: Confirm trigger exists
        const contract = contracts_1.TriggerRegistry[triggerName];
        if (!contract) {
            this.logger.error("trigger_not_found", { triggerName });
            return { success: false, reason: "TRIGGER_NOT_FOUND" };
        }
        // Step 2: Confirm trigger is ACTIVE for this site
        if (!(0, contracts_1.isTriggerEnabled)(triggerName, this.siteId)) {
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
            const triggerDisabled = await this.governanceChecker.isTriggerDisabled(triggerName, this.siteId);
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
            const templateDisabled = await this.governanceChecker.isTemplateDisabled(contract.templateSlug, this.siteId);
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
        const validation = (0, utils_1.validatePayload)(payload, contract.requiredVars);
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
        if (!recipientEmail || !(0, utils_1.isValidEmail)(recipientEmail)) {
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
        const idempotencyKey = (0, utils_1.generateIdempotencyKey)(triggerName, contract.entityType, entityId, newState);
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
        const messageId = (0, utils_1.generateUUID)();
        const message = {
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
    getContract(triggerName) {
        return contracts_1.TriggerRegistry[triggerName];
    }
    /**
     * Check if a trigger is enabled for the current site.
     */
    isEnabled(triggerName) {
        return (0, contracts_1.isTriggerEnabled)(triggerName, this.siteId);
    }
    /**
     * List all enabled triggers for the current site.
     */
    listEnabledTriggers() {
        return Object.keys(contracts_1.TriggerRegistry).filter((name) => (0, contracts_1.isTriggerEnabled)(name, this.siteId));
    }
}
exports.TriggerEngine = TriggerEngine;
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
/**
 * Create a TriggerEngine instance with options.
 */
function createTriggerEngine(options) {
    return new TriggerEngine(options);
}
//# sourceMappingURL=TriggerEngine.js.map