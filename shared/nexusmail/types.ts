/**
 * NEXUSMAIL CORE TYPES
 * Portable type definitions for the NexusMail email system.
 * These types are provider/storage agnostic.
 */

// ============================================================================
// TRIGGER TYPES
// ============================================================================

export type TriggerName =
  | "BUSINESS_APPROVED"
  | "CHURCH_APPROVED"
  | "BUSINESS_APPROVED_CHURCH"
  | "CHURCH_APPROVED_BUSINESS"
  | "MEMBER_WELCOME"
  | "MEMBER_ROLE_CHANGE"
  | "ORDER_CONFIRMATION"
  | "ORDER_SHIPPED"
  | "PASSWORD_RESET"
  | "GENERIC_NOTIFICATION";

export type EntityType = "business" | "church" | "user" | "member" | "order";

export interface TriggerContract {
  triggerName: TriggerName;
  templateSlug: string;
  requiredVars: string[];
  optionalVars?: string[];
  recipientResolver: (payload: Record<string, any>) => string;
  entityType: EntityType;
  terminalStates: string[];
  description?: string;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface NexusMailRecipient {
  email: string;
  name?: string;
}

export interface NexusMailMeta {
  siteId: string;
  environment: "prod" | "staging" | "dev";
  entityType: EntityType;
  entityId: string;
  initiatedBy?: "system" | "admin" | "user";
  hostDomain?: string;
}

export interface NexusMailTimestamps {
  createdAt: string;
  triggeredAt: string;
}

export interface NexusMailMessage {
  messageId: string;
  idempotencyKey: string;
  triggerName: TriggerName;
  templateSlug: string;
  recipient: NexusMailRecipient;
  payload: Record<string, any>;
  meta: NexusMailMeta;
  timestamps: NexusMailTimestamps;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface NexusMailTemplate {
  slug: string;
  version?: string;
  active: boolean;
  subject: string;
  htmlBody: string;
  textBody?: string;
  requiredVars?: string[];
  category?: string;
  updatedAt?: string;
}

export interface NexusMailRenderedEmail {
  slug: string;
  subject: string;
  html: string;
  text?: string;
  meta: {
    renderedAt: string;
    templateVersion?: string;
    siteId: string;
    triggerName: TriggerName;
  };
}

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export interface ProviderResult {
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable: boolean;
  rawResponse?: any;
}

export interface NexusMailProviderAdapter {
  providerName: string;
  send(
    recipient: NexusMailRecipient,
    rendered: NexusMailRenderedEmail
  ): Promise<ProviderResult>;
}

// ============================================================================
// OUTBOX TYPES
// ============================================================================

export type OutboxStatus =
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "DEAD"
  | "SKIPPED";

export interface OutboxProviderInfo {
  name: string;
  providerMessageId?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  lastErrorRetryable?: boolean;
}

export interface NexusMailOutboxRecord {
  outboxId: string;
  messageId: string;
  idempotencyKey: string;
  triggerName: TriggerName;
  templateSlug: string;
  siteId: string;
  recipientEmail: string;
  recipientName?: string;
  rendered: {
    subject: string;
    html: string;
    text?: string;
    templateVersion?: string;
  };
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastAttemptAt?: string;
  provider: OutboxProviderInfo;
  meta: NexusMailMeta;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// HEALTH TYPES
// ============================================================================

export type ProviderHealthState = "HEALTHY" | "DEGRADED" | "UNHEALTHY";

export interface ProviderHealthScore {
  providerName: string;
  state: ProviderHealthState;
  failureRate: number;
  consecutiveFailures: number;
  lastCheckAt: string;
  windowSize: number;
  recentAttempts: number;
  recentFailures: number;
}

export interface NexusMailSendState {
  siteId: string;
  isPaused: boolean;
  pausedReason?: string;
  pausedAt?: string;
  resumeCheckAt?: string;
  adminOverride?: boolean;
}

// ============================================================================
// GOVERNANCE TYPES
// ============================================================================

export interface NexusMailGovernanceConfig {
  siteId: string;
  sendingEnabled: boolean;
  paused: boolean;
  disabledTriggers: TriggerName[];
  disabledTemplates: string[];
  maxAttempts: number;
  concurrencyHealthy: number;
  concurrencyDegraded: number;
}

// ============================================================================
// LOGGING TYPES
// ============================================================================

export type NexusMailLogStatus =
  | "SENT"
  | "FAILED"
  | "DEAD"
  | "SKIPPED"
  | "QUEUED"
  | "RENDERED";

export interface NexusMailLogEntry {
  outboxId: string;
  messageId: string;
  idempotencyKey: string;
  providerName: string;
  attemptNumber: number;
  status: NexusMailLogStatus;
  retryable?: boolean;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}
