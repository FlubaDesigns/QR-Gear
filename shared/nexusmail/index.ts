/**
 * NEXUSMAIL - Portable Self-Healing Email System
 * 
 * NexusMail is a domain-specific module of the Nexus self-healing architecture.
 * It provides queue-first, idempotent, provider-agnostic email delivery.
 * 
 * Core Principles:
 * - State-driven triggers (NOT UI-triggered)
 * - Idempotency at every layer
 * - Queue-first sending (outbox pattern)
 * - Provider health monitoring with auto-pause
 * - Portable across sites (KC, QR Gear, etc.)
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type {
  TriggerName,
  EntityType,
  TriggerContract,
  NexusMailRecipient,
  NexusMailMeta,
  NexusMailTimestamps,
  NexusMailMessage,
  NexusMailTemplate,
  NexusMailRenderedEmail,
  ProviderResult,
  NexusMailProviderAdapter,
  OutboxStatus,
  OutboxProviderInfo,
  NexusMailOutboxRecord,
  ProviderHealthState,
  ProviderHealthScore,
  NexusMailSendState,
  NexusMailGovernanceConfig,
  NexusMailLogStatus,
  NexusMailLogEntry,
} from "./types";

// ============================================================================
// CONTRACTS
// ============================================================================

export {
  TriggerRegistry,
  SiteTriggerEnablement,
  getTriggerContract,
  isTriggerEnabled,
  getEnabledTriggers,
} from "./contracts";
export type { SiteId } from "./contracts";

// ============================================================================
// UTILITIES
// ============================================================================

export {
  generateIdempotencyKey,
  generateReplayIdempotencyKey,
  generateUUID,
  extractVariables,
  injectVariables,
  findMissingVariables,
  calculateRetryDelay,
  calculateNextAttemptAt,
  validatePayload,
  isValidEmail,
  nowISO,
  formatEmailDate,
  DefaultRetryConfig,
} from "./utils";
export type { RetryConfig } from "./utils";

// ============================================================================
// TRIGGER ENGINE
// ============================================================================

export { TriggerEngine, createTriggerEngine } from "./engine";
export type {
  TriggerResult,
  TriggerFailReason,
  IdempotencyStore,
  GovernanceChecker,
  TriggerEngineOptions,
  TriggerEngineLogger,
} from "./engine";

// ============================================================================
// TEMPLATE RESOLVER
// ============================================================================

export { TemplateResolver, createTemplateResolver } from "./template";
export type {
  TemplateStoreAdapter,
  BrandingAdapter,
  TemplateResolverOptions,
  TemplateResolverLogger,
  ResolveResult,
  ResolveFailReason,
} from "./template";

// ============================================================================
// PROVIDER ADAPTERS
// ============================================================================

export {
  BaseProviderAdapter,
  MockProviderAdapter,
  ConsoleProviderAdapter,
  successResult,
  failureResult,
  isRetryableHttpStatus,
  isRetryableError,
} from "./provider";
export type { MockProviderOptions } from "./provider";

// ============================================================================
// OUTBOX SERVICE
// ============================================================================

export { OutboxService, createOutboxService } from "./outbox";
export type {
  OutboxRepository,
  OutboxServiceOptions,
  OutboxLogger,
  EnqueueResult,
  ProcessResult,
} from "./outbox";

// ============================================================================
// PROVIDER HEALTH
// ============================================================================

export {
  ProviderHealthMonitor,
  createProviderHealthMonitor,
  DefaultHealthConfig,
} from "./health";
export type {
  HealthConfig,
  HealthStore,
  SendOutcome,
  HealthLogger,
} from "./health";
