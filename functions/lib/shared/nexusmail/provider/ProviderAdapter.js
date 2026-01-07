"use strict";
/**
 * NEXUSMAIL PROVIDER ADAPTER
 *
 * Defines the provider adapter contract and base implementations.
 * Provider adapters handle the actual email delivery without making
 * business decisions about retries or validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleProviderAdapter = exports.MockProviderAdapter = exports.BaseProviderAdapter = void 0;
exports.successResult = successResult;
exports.failureResult = failureResult;
exports.isRetryableHttpStatus = isRetryableHttpStatus;
exports.isRetryableError = isRetryableError;
// ============================================================================
// PROVIDER RESULT HELPERS
// ============================================================================
/**
 * Create a successful provider result.
 */
function successResult(providerMessageId, rawResponse) {
    return {
        success: true,
        providerMessageId,
        retryable: false,
        rawResponse,
    };
}
/**
 * Create a failed provider result with retryable flag.
 */
function failureResult(errorCode, errorMessage, retryable, rawResponse) {
    return {
        success: false,
        errorCode,
        errorMessage,
        retryable,
        rawResponse,
    };
}
/**
 * Determine if an HTTP status code indicates a retryable error.
 */
function isRetryableHttpStatus(status) {
    // Retry on rate limits and server errors
    if (status === 429)
        return true; // Rate limited
    if (status >= 500 && status < 600)
        return true; // Server errors
    return false;
}
/**
 * Determine if an error indicates a retryable failure.
 */
function isRetryableError(error) {
    const message = (error?.message || "").toLowerCase();
    return (message.includes("timeout") ||
        message.includes("network") ||
        message.includes("failed to fetch") ||
        message.includes("econnrefused") ||
        message.includes("socket") ||
        message.includes("429") ||
        message.includes("rate"));
}
// ============================================================================
// BASE PROVIDER ADAPTER (ABSTRACT)
// ============================================================================
/**
 * Abstract base class for provider adapters.
 * Provides common functionality and enforces the contract.
 */
class BaseProviderAdapter {
    /**
     * Validate that required fields are present before sending.
     * Returns null if valid, or an error message if invalid.
     */
    validateSendRequest(recipient, rendered) {
        if (!recipient.email) {
            return "Recipient email is required";
        }
        if (!rendered.subject) {
            return "Email subject is required";
        }
        if (!rendered.html) {
            return "Email HTML body is required";
        }
        return null;
    }
}
exports.BaseProviderAdapter = BaseProviderAdapter;
/**
 * Mock provider adapter for testing.
 * Can simulate successes, failures, and delays.
 */
class MockProviderAdapter extends BaseProviderAdapter {
    constructor(options = {}) {
        super();
        this.providerName = "mock";
        this.sentMessages = [];
        this.options = options;
    }
    async send(recipient, rendered) {
        // Validate
        const validationError = this.validateSendRequest(recipient, rendered);
        if (validationError) {
            return failureResult("VALIDATION_ERROR", validationError, false);
        }
        // Simulate delay
        if (this.options.delay) {
            await new Promise((r) => setTimeout(r, this.options.delay));
        }
        // Simulate failure
        const shouldFail = this.options.simulateFailure ||
            (this.options.failureRate && Math.random() < this.options.failureRate);
        if (shouldFail) {
            return failureResult("SIMULATED_FAILURE", "Mock provider simulated failure", this.options.retryable ?? true);
        }
        // Success
        const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this.sentMessages.push({
            recipient,
            rendered,
            timestamp: new Date().toISOString(),
        });
        return successResult(messageId);
    }
    /**
     * Get all sent messages (for testing).
     */
    getSentMessages() {
        return [...this.sentMessages];
    }
    /**
     * Clear sent messages (for testing).
     */
    clearSentMessages() {
        this.sentMessages = [];
    }
}
exports.MockProviderAdapter = MockProviderAdapter;
// ============================================================================
// CONSOLE PROVIDER (FOR DEV)
// ============================================================================
/**
 * Console provider that logs emails instead of sending.
 * Useful for development without real email delivery.
 */
class ConsoleProviderAdapter extends BaseProviderAdapter {
    constructor() {
        super(...arguments);
        this.providerName = "console";
    }
    async send(recipient, rendered) {
        const validationError = this.validateSendRequest(recipient, rendered);
        if (validationError) {
            return failureResult("VALIDATION_ERROR", validationError, false);
        }
        console.log("\n========== NEXUSMAIL (Console Provider) ==========");
        console.log(`To: ${recipient.email}${recipient.name ? ` (${recipient.name})` : ""}`);
        console.log(`Subject: ${rendered.subject}`);
        console.log(`Template: ${rendered.slug}`);
        console.log(`Site: ${rendered.meta.siteId}`);
        console.log(`Trigger: ${rendered.meta.triggerName}`);
        console.log("---------------------------------------------------");
        console.log("HTML Body Preview (first 500 chars):");
        console.log(rendered.html.slice(0, 500) + (rendered.html.length > 500 ? "..." : ""));
        console.log("===================================================\n");
        return successResult(`console_${Date.now()}`);
    }
}
exports.ConsoleProviderAdapter = ConsoleProviderAdapter;
//# sourceMappingURL=ProviderAdapter.js.map