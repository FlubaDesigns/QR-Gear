"use strict";
/**
 * NEXUSMAIL OUTBOX SERVICE
 *
 * Queue-first email delivery with retry scheduling, status management,
 * and integration with provider health scoring.
 *
 * Core Principles:
 * - Trigger Engine creates intent → Outbox queues it
 * - Sender worker processes outbox items
 * - Retries are safe and controlled
 * - Provider outages don't break app flows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxService = void 0;
exports.createOutboxService = createOutboxService;
const utils_1 = require("../utils");
// ============================================================================
// OUTBOX SERVICE CLASS
// ============================================================================
class OutboxService {
    constructor(options) {
        this.repository = options.repository;
        this.provider = options.provider;
        this.retryConfig = options.retryConfig || utils_1.DefaultRetryConfig;
        this.logger = options.logger || {
            info: (e, d) => console.log(`[OutboxService:INFO] ${e}`, d),
            warn: (e, d) => console.warn(`[OutboxService:WARN] ${e}`, d),
            error: (e, d) => console.error(`[OutboxService:ERROR] ${e}`, d),
        };
        this.onSent = options.onSent;
        this.onFailed = options.onFailed;
        this.onDead = options.onDead;
    }
    /**
     * Enqueue a message for delivery.
     * Creates an outbox record with QUEUED status.
     */
    async enqueue(message, rendered) {
        // Check for duplicate by idempotency key
        const existing = await this.repository.getByIdempotencyKey(message.idempotencyKey);
        if (existing) {
            this.logger.info("duplicate_enqueue_skipped", {
                idempotencyKey: message.idempotencyKey,
                existingOutboxId: existing.outboxId,
                existingStatus: existing.status,
            });
            return { success: true, outboxId: existing.outboxId, status: "DUPLICATE" };
        }
        const now = (0, utils_1.nowISO)();
        const outboxId = (0, utils_1.generateUUID)();
        const record = {
            outboxId,
            messageId: message.messageId,
            idempotencyKey: message.idempotencyKey,
            triggerName: message.triggerName,
            templateSlug: message.templateSlug,
            siteId: message.meta.siteId,
            recipientEmail: message.recipient.email,
            recipientName: message.recipient.name,
            rendered: {
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
                templateVersion: rendered.meta.templateVersion,
            },
            status: "QUEUED",
            attempts: 0,
            maxAttempts: this.retryConfig.maxAttempts,
            nextAttemptAt: now, // Ready immediately
            provider: {
                name: this.provider.providerName,
            },
            meta: message.meta,
            createdAt: now,
            updatedAt: now,
        };
        await this.repository.create(record);
        this.logger.info("queued_outbox", {
            outboxId,
            messageId: message.messageId,
            idempotencyKey: message.idempotencyKey,
            triggerName: message.triggerName,
            recipient: message.recipient.email,
        });
        return { success: true, outboxId, status: "QUEUED" };
    }
    /**
     * Process a single outbox record.
     * Attempts to send and updates status accordingly.
     */
    async processOne(record) {
        const now = (0, utils_1.nowISO)();
        // Mark as SENDING
        await this.repository.update(record.outboxId, {
            status: "SENDING",
            updatedAt: now,
        });
        // Attempt to send
        const result = await this.provider.send({ email: record.recipientEmail, name: record.recipientName }, {
            slug: record.templateSlug,
            subject: record.rendered.subject,
            html: record.rendered.html,
            text: record.rendered.text,
            meta: {
                renderedAt: now,
                templateVersion: record.rendered.templateVersion,
                siteId: record.siteId,
                triggerName: record.triggerName,
            },
        });
        const newAttempts = record.attempts + 1;
        if (result.success) {
            // SUCCESS
            await this.repository.update(record.outboxId, {
                status: "SENT",
                attempts: newAttempts,
                lastAttemptAt: now,
                updatedAt: now,
                provider: {
                    ...record.provider,
                    providerMessageId: result.providerMessageId,
                },
            });
            this.logger.info("sent_success", {
                outboxId: record.outboxId,
                messageId: record.messageId,
                attempts: newAttempts,
                providerMessageId: result.providerMessageId,
            });
            if (this.onSent) {
                await this.onSent({ ...record, status: "SENT", attempts: newAttempts });
            }
            return { outboxId: record.outboxId, status: "SENT", attempts: newAttempts, providerResult: result };
        }
        // FAILURE
        const shouldRetry = result.retryable && newAttempts < record.maxAttempts;
        if (shouldRetry) {
            // Schedule retry
            const nextAttemptAt = (0, utils_1.calculateNextAttemptAt)(newAttempts, this.retryConfig);
            await this.repository.update(record.outboxId, {
                status: "FAILED",
                attempts: newAttempts,
                lastAttemptAt: now,
                nextAttemptAt,
                updatedAt: now,
                provider: {
                    ...record.provider,
                    lastErrorCode: result.errorCode,
                    lastErrorMessage: result.errorMessage,
                    lastErrorRetryable: result.retryable,
                },
            });
            this.logger.warn("send_failed_retryable", {
                outboxId: record.outboxId,
                attempts: newAttempts,
                maxAttempts: record.maxAttempts,
                nextAttemptAt,
                errorCode: result.errorCode,
                errorMessage: result.errorMessage,
            });
            if (this.onFailed) {
                await this.onFailed({ ...record, status: "FAILED", attempts: newAttempts }, result);
            }
            return { outboxId: record.outboxId, status: "FAILED", attempts: newAttempts, providerResult: result };
        }
        // DEAD (max attempts exceeded or non-retryable)
        await this.repository.update(record.outboxId, {
            status: "DEAD",
            attempts: newAttempts,
            lastAttemptAt: now,
            updatedAt: now,
            provider: {
                ...record.provider,
                lastErrorCode: result.errorCode,
                lastErrorMessage: result.errorMessage,
                lastErrorRetryable: result.retryable,
            },
        });
        this.logger.error("dead_letter_created", {
            outboxId: record.outboxId,
            messageId: record.messageId,
            attempts: newAttempts,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
            retryable: result.retryable,
        });
        if (this.onDead) {
            await this.onDead({ ...record, status: "DEAD", attempts: newAttempts });
        }
        return { outboxId: record.outboxId, status: "DEAD", attempts: newAttempts, providerResult: result };
    }
    /**
     * Process all ready-to-send outbox records.
     * Returns array of process results.
     */
    async processReady(limit = 10) {
        const ready = await this.repository.getReadyToSend(limit);
        const results = [];
        for (const record of ready) {
            try {
                const result = await this.processOne(record);
                results.push(result);
            }
            catch (error) {
                this.logger.error("process_error", {
                    outboxId: record.outboxId,
                    error: error?.message || String(error),
                });
                results.push({
                    outboxId: record.outboxId,
                    status: record.status,
                    attempts: record.attempts,
                });
            }
        }
        return results;
    }
    /**
     * Retry failed records that are due for retry.
     */
    async retryFailed(limit = 10) {
        const failed = await this.repository.getByStatus("FAILED", limit);
        const now = new Date().getTime();
        const results = [];
        for (const record of failed) {
            // Check if ready for retry
            const nextAttempt = new Date(record.nextAttemptAt).getTime();
            if (nextAttempt > now)
                continue;
            // Re-queue as QUEUED
            await this.repository.update(record.outboxId, {
                status: "QUEUED",
                updatedAt: (0, utils_1.nowISO)(),
            });
            const result = await this.processOne({
                ...record,
                status: "QUEUED",
            });
            results.push(result);
        }
        return results;
    }
    /**
     * Mark a record as SKIPPED (admin override).
     */
    async skip(outboxId, reason) {
        await this.repository.update(outboxId, {
            status: "SKIPPED",
            updatedAt: (0, utils_1.nowISO)(),
            provider: {
                name: this.provider.providerName,
                lastErrorMessage: reason || "Skipped by admin",
            },
        });
        this.logger.info("skipped_by_admin", { outboxId, reason });
    }
    /**
     * Replay a DEAD record (admin rescue).
     */
    async replay(outboxId) {
        const record = await this.repository.getById(outboxId);
        if (!record)
            return null;
        if (record.status !== "DEAD" && record.status !== "FAILED") {
            this.logger.warn("replay_invalid_status", {
                outboxId,
                currentStatus: record.status,
            });
            return null;
        }
        // Reset for retry
        await this.repository.update(outboxId, {
            status: "QUEUED",
            attempts: 0,
            nextAttemptAt: (0, utils_1.nowISO)(),
            updatedAt: (0, utils_1.nowISO)(),
        });
        return this.processOne({ ...record, status: "QUEUED", attempts: 0 });
    }
    /**
     * Get outbox statistics.
     */
    async getStats() {
        const statuses = ["QUEUED", "SENDING", "SENT", "FAILED", "DEAD", "SKIPPED"];
        const stats = {};
        for (const status of statuses) {
            stats[status] = await this.repository.countByStatus(status);
        }
        return stats;
    }
}
exports.OutboxService = OutboxService;
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
function createOutboxService(options) {
    return new OutboxService(options);
}
//# sourceMappingURL=OutboxService.js.map