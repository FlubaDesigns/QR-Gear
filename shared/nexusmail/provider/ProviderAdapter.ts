/**
 * NEXUSMAIL PROVIDER ADAPTER
 * 
 * Defines the provider adapter contract and base implementations.
 * Provider adapters handle the actual email delivery without making
 * business decisions about retries or validation.
 */

import {
  NexusMailRecipient,
  NexusMailRenderedEmail,
  ProviderResult,
  NexusMailProviderAdapter,
} from "../types";

// ============================================================================
// PROVIDER RESULT HELPERS
// ============================================================================

/**
 * Create a successful provider result.
 */
export function successResult(providerMessageId: string, rawResponse?: any): ProviderResult {
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
export function failureResult(
  errorCode: string,
  errorMessage: string,
  retryable: boolean,
  rawResponse?: any
): ProviderResult {
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
export function isRetryableHttpStatus(status: number): boolean {
  // Retry on rate limits and server errors
  if (status === 429) return true; // Rate limited
  if (status >= 500 && status < 600) return true; // Server errors
  return false;
}

/**
 * Determine if an error indicates a retryable failure.
 */
export function isRetryableError(error: any): boolean {
  const message = (error?.message || "").toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("econnrefused") ||
    message.includes("socket") ||
    message.includes("429") ||
    message.includes("rate")
  );
}

// ============================================================================
// BASE PROVIDER ADAPTER (ABSTRACT)
// ============================================================================

/**
 * Abstract base class for provider adapters.
 * Provides common functionality and enforces the contract.
 */
export abstract class BaseProviderAdapter implements NexusMailProviderAdapter {
  abstract providerName: string;

  abstract send(
    recipient: NexusMailRecipient,
    rendered: NexusMailRenderedEmail
  ): Promise<ProviderResult>;

  /**
   * Validate that required fields are present before sending.
   * Returns null if valid, or an error message if invalid.
   */
  protected validateSendRequest(
    recipient: NexusMailRecipient,
    rendered: NexusMailRenderedEmail
  ): string | null {
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

// ============================================================================
// MOCK PROVIDER (FOR TESTING)
// ============================================================================

export interface MockProviderOptions {
  simulateFailure?: boolean;
  failureRate?: number; // 0-1 probability of failure
  retryable?: boolean;
  delay?: number; // Simulated delay in ms
}

/**
 * Mock provider adapter for testing.
 * Can simulate successes, failures, and delays.
 */
export class MockProviderAdapter extends BaseProviderAdapter {
  providerName = "mock";
  private options: MockProviderOptions;
  private sentMessages: Array<{
    recipient: NexusMailRecipient;
    rendered: NexusMailRenderedEmail;
    timestamp: string;
  }> = [];

  constructor(options: MockProviderOptions = {}) {
    super();
    this.options = options;
  }

  async send(
    recipient: NexusMailRecipient,
    rendered: NexusMailRenderedEmail
  ): Promise<ProviderResult> {
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
    const shouldFail =
      this.options.simulateFailure ||
      (this.options.failureRate && Math.random() < this.options.failureRate);

    if (shouldFail) {
      return failureResult(
        "SIMULATED_FAILURE",
        "Mock provider simulated failure",
        this.options.retryable ?? true
      );
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

// ============================================================================
// CONSOLE PROVIDER (FOR DEV)
// ============================================================================

/**
 * Console provider that logs emails instead of sending.
 * Useful for development without real email delivery.
 */
export class ConsoleProviderAdapter extends BaseProviderAdapter {
  providerName = "console";

  async send(
    recipient: NexusMailRecipient,
    rendered: NexusMailRenderedEmail
  ): Promise<ProviderResult> {
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
