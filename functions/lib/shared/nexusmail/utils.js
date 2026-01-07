"use strict";
/**
 * NEXUSMAIL UTILITIES
 * Portable utility functions for NexusMail.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultRetryConfig = void 0;
exports.generateIdempotencyKey = generateIdempotencyKey;
exports.generateReplayIdempotencyKey = generateReplayIdempotencyKey;
exports.generateUUID = generateUUID;
exports.extractVariables = extractVariables;
exports.injectVariables = injectVariables;
exports.findMissingVariables = findMissingVariables;
exports.calculateRetryDelay = calculateRetryDelay;
exports.calculateNextAttemptAt = calculateNextAttemptAt;
exports.validatePayload = validatePayload;
exports.isValidEmail = isValidEmail;
exports.nowISO = nowISO;
exports.formatEmailDate = formatEmailDate;
// ============================================================================
// IDEMPOTENCY KEY GENERATION
// ============================================================================
/**
 * Generate a canonical idempotency key for a trigger execution.
 * Format: `${triggerName}:${entityType}:${entityId}:${newState}`
 */
function generateIdempotencyKey(triggerName, entityType, entityId, newState) {
    return `${triggerName}:${entityType}:${entityId}:${newState}`;
}
/**
 * Generate a replay idempotency key (for admin rescues).
 * Appends `:replay:N` to allow re-sending dead letters.
 */
function generateReplayIdempotencyKey(originalKey, replayCount) {
    return `${originalKey}:replay:${replayCount}`;
}
// ============================================================================
// UUID GENERATION
// ============================================================================
/**
 * Generate a UUID v4.
 * Works in both browser and Node.js environments.
 */
function generateUUID() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
// ============================================================================
// VARIABLE EXTRACTION
// ============================================================================
/**
 * Extract all variable names from a template string.
 * Variables use the `{{variable_name}}` syntax.
 */
function extractVariables(template) {
    const regex = /\{\{([^}]+)\}\}/g;
    const vars = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
        const varName = match[1].trim();
        if (!vars.includes(varName)) {
            vars.push(varName);
        }
    }
    return vars;
}
/**
 * Inject variables into a template string.
 * Returns the rendered string with all `{{var}}` replaced.
 */
function injectVariables(template, payload) {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, varName) => {
        const key = varName.trim();
        const value = payload[key];
        if (value === undefined || value === null) {
            return `{{${key}}}`; // Leave unreplaced for validation to catch
        }
        return String(value);
    });
}
/**
 * Check for missing variables in a payload.
 * Returns array of missing variable names.
 */
function findMissingVariables(template, payload) {
    const required = extractVariables(template);
    return required.filter((v) => {
        const value = payload[v];
        return value === undefined || value === null || value === "";
    });
}
exports.DefaultRetryConfig = {
    maxAttempts: 6,
    baseDelayMs: 30000, // 30 seconds
    backoffMultiplier: 2,
    jitterPercent: 20,
    maxDelayMs: 600000, // 10 minutes
};
/**
 * Calculate the next retry delay with exponential backoff and jitter.
 */
function calculateRetryDelay(attemptNumber, config = exports.DefaultRetryConfig) {
    const baseDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
    const cappedDelay = Math.min(baseDelay, config.maxDelayMs);
    // Apply jitter
    const jitterRange = cappedDelay * (config.jitterPercent / 100);
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.round(cappedDelay + jitter);
}
/**
 * Calculate the next attempt timestamp.
 */
function calculateNextAttemptAt(attemptNumber, config) {
    const delay = calculateRetryDelay(attemptNumber, config);
    return new Date(Date.now() + delay).toISOString();
}
// ============================================================================
// VALIDATION HELPERS
// ============================================================================
/**
 * Validate that all required variables are present and non-empty.
 */
function validatePayload(payload, requiredVars) {
    const missing = requiredVars.filter((v) => {
        const value = payload[v];
        return value === undefined || value === null || value === "";
    });
    return {
        valid: missing.length === 0,
        missing,
    };
}
/**
 * Validate email address format.
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
// ============================================================================
// TIMESTAMP HELPERS
// ============================================================================
/**
 * Get current ISO timestamp.
 */
function nowISO() {
    return new Date().toISOString();
}
/**
 * Format a date for display in emails.
 */
function formatEmailDate(date) {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
//# sourceMappingURL=utils.js.map