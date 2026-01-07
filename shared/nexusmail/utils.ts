/**
 * NEXUSMAIL UTILITIES
 * Portable utility functions for NexusMail.
 */

import { TriggerName, EntityType } from "./types";

// ============================================================================
// IDEMPOTENCY KEY GENERATION
// ============================================================================

/**
 * Generate a canonical idempotency key for a trigger execution.
 * Format: `${triggerName}:${entityType}:${entityId}:${newState}`
 */
export function generateIdempotencyKey(
  triggerName: TriggerName,
  entityType: EntityType,
  entityId: string,
  newState: string
): string {
  return `${triggerName}:${entityType}:${entityId}:${newState}`;
}

/**
 * Generate a replay idempotency key (for admin rescues).
 * Appends `:replay:N` to allow re-sending dead letters.
 */
export function generateReplayIdempotencyKey(
  originalKey: string,
  replayCount: number
): string {
  return `${originalKey}:replay:${replayCount}`;
}

// ============================================================================
// UUID GENERATION
// ============================================================================

/**
 * Generate a UUID v4.
 * Works in both browser and Node.js environments.
 */
export function generateUUID(): string {
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
export function extractVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const vars: string[] = [];
  let match: RegExpExecArray | null;

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
export function injectVariables(
  template: string,
  payload: Record<string, any>
): string {
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
export function findMissingVariables(
  template: string,
  payload: Record<string, any>
): string[] {
  const required = extractVariables(template);
  return required.filter((v) => {
    const value = payload[v];
    return value === undefined || value === null || value === "";
  });
}

// ============================================================================
// RETRY SCHEDULING
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  backoffMultiplier: number;
  jitterPercent: number;
  maxDelayMs: number;
}

export const DefaultRetryConfig: RetryConfig = {
  maxAttempts: 6,
  baseDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterPercent: 20,
  maxDelayMs: 600000, // 10 minutes
};

/**
 * Calculate the next retry delay with exponential backoff and jitter.
 */
export function calculateRetryDelay(
  attemptNumber: number,
  config: RetryConfig = DefaultRetryConfig
): number {
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
export function calculateNextAttemptAt(
  attemptNumber: number,
  config?: RetryConfig
): string {
  const delay = calculateRetryDelay(attemptNumber, config);
  return new Date(Date.now() + delay).toISOString();
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that all required variables are present and non-empty.
 */
export function validatePayload(
  payload: Record<string, any>,
  requiredVars: string[]
): { valid: boolean; missing: string[] } {
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
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// TIMESTAMP HELPERS
// ============================================================================

/**
 * Get current ISO timestamp.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Format a date for display in emails.
 */
export function formatEmailDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
