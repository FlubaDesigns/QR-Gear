"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultHealthConfig = exports.createProviderHealthMonitor = exports.ProviderHealthMonitor = exports.createOutboxService = exports.OutboxService = exports.isRetryableError = exports.isRetryableHttpStatus = exports.failureResult = exports.successResult = exports.ConsoleProviderAdapter = exports.MockProviderAdapter = exports.BaseProviderAdapter = exports.createTemplateResolver = exports.TemplateResolver = exports.createTriggerEngine = exports.TriggerEngine = exports.DefaultRetryConfig = exports.formatEmailDate = exports.nowISO = exports.isValidEmail = exports.validatePayload = exports.calculateNextAttemptAt = exports.calculateRetryDelay = exports.findMissingVariables = exports.injectVariables = exports.extractVariables = exports.generateUUID = exports.generateReplayIdempotencyKey = exports.generateIdempotencyKey = exports.getEnabledTriggers = exports.isTriggerEnabled = exports.getTriggerContract = exports.SiteTriggerEnablement = exports.TriggerRegistry = void 0;
// ============================================================================
// CONTRACTS
// ============================================================================
var contracts_1 = require("./contracts");
Object.defineProperty(exports, "TriggerRegistry", { enumerable: true, get: function () { return contracts_1.TriggerRegistry; } });
Object.defineProperty(exports, "SiteTriggerEnablement", { enumerable: true, get: function () { return contracts_1.SiteTriggerEnablement; } });
Object.defineProperty(exports, "getTriggerContract", { enumerable: true, get: function () { return contracts_1.getTriggerContract; } });
Object.defineProperty(exports, "isTriggerEnabled", { enumerable: true, get: function () { return contracts_1.isTriggerEnabled; } });
Object.defineProperty(exports, "getEnabledTriggers", { enumerable: true, get: function () { return contracts_1.getEnabledTriggers; } });
// ============================================================================
// UTILITIES
// ============================================================================
var utils_1 = require("./utils");
Object.defineProperty(exports, "generateIdempotencyKey", { enumerable: true, get: function () { return utils_1.generateIdempotencyKey; } });
Object.defineProperty(exports, "generateReplayIdempotencyKey", { enumerable: true, get: function () { return utils_1.generateReplayIdempotencyKey; } });
Object.defineProperty(exports, "generateUUID", { enumerable: true, get: function () { return utils_1.generateUUID; } });
Object.defineProperty(exports, "extractVariables", { enumerable: true, get: function () { return utils_1.extractVariables; } });
Object.defineProperty(exports, "injectVariables", { enumerable: true, get: function () { return utils_1.injectVariables; } });
Object.defineProperty(exports, "findMissingVariables", { enumerable: true, get: function () { return utils_1.findMissingVariables; } });
Object.defineProperty(exports, "calculateRetryDelay", { enumerable: true, get: function () { return utils_1.calculateRetryDelay; } });
Object.defineProperty(exports, "calculateNextAttemptAt", { enumerable: true, get: function () { return utils_1.calculateNextAttemptAt; } });
Object.defineProperty(exports, "validatePayload", { enumerable: true, get: function () { return utils_1.validatePayload; } });
Object.defineProperty(exports, "isValidEmail", { enumerable: true, get: function () { return utils_1.isValidEmail; } });
Object.defineProperty(exports, "nowISO", { enumerable: true, get: function () { return utils_1.nowISO; } });
Object.defineProperty(exports, "formatEmailDate", { enumerable: true, get: function () { return utils_1.formatEmailDate; } });
Object.defineProperty(exports, "DefaultRetryConfig", { enumerable: true, get: function () { return utils_1.DefaultRetryConfig; } });
// ============================================================================
// TRIGGER ENGINE
// ============================================================================
var engine_1 = require("./engine");
Object.defineProperty(exports, "TriggerEngine", { enumerable: true, get: function () { return engine_1.TriggerEngine; } });
Object.defineProperty(exports, "createTriggerEngine", { enumerable: true, get: function () { return engine_1.createTriggerEngine; } });
// ============================================================================
// TEMPLATE RESOLVER
// ============================================================================
var template_1 = require("./template");
Object.defineProperty(exports, "TemplateResolver", { enumerable: true, get: function () { return template_1.TemplateResolver; } });
Object.defineProperty(exports, "createTemplateResolver", { enumerable: true, get: function () { return template_1.createTemplateResolver; } });
// ============================================================================
// PROVIDER ADAPTERS
// ============================================================================
var provider_1 = require("./provider");
Object.defineProperty(exports, "BaseProviderAdapter", { enumerable: true, get: function () { return provider_1.BaseProviderAdapter; } });
Object.defineProperty(exports, "MockProviderAdapter", { enumerable: true, get: function () { return provider_1.MockProviderAdapter; } });
Object.defineProperty(exports, "ConsoleProviderAdapter", { enumerable: true, get: function () { return provider_1.ConsoleProviderAdapter; } });
Object.defineProperty(exports, "successResult", { enumerable: true, get: function () { return provider_1.successResult; } });
Object.defineProperty(exports, "failureResult", { enumerable: true, get: function () { return provider_1.failureResult; } });
Object.defineProperty(exports, "isRetryableHttpStatus", { enumerable: true, get: function () { return provider_1.isRetryableHttpStatus; } });
Object.defineProperty(exports, "isRetryableError", { enumerable: true, get: function () { return provider_1.isRetryableError; } });
// ============================================================================
// OUTBOX SERVICE
// ============================================================================
var outbox_1 = require("./outbox");
Object.defineProperty(exports, "OutboxService", { enumerable: true, get: function () { return outbox_1.OutboxService; } });
Object.defineProperty(exports, "createOutboxService", { enumerable: true, get: function () { return outbox_1.createOutboxService; } });
// ============================================================================
// PROVIDER HEALTH
// ============================================================================
var health_1 = require("./health");
Object.defineProperty(exports, "ProviderHealthMonitor", { enumerable: true, get: function () { return health_1.ProviderHealthMonitor; } });
Object.defineProperty(exports, "createProviderHealthMonitor", { enumerable: true, get: function () { return health_1.createProviderHealthMonitor; } });
Object.defineProperty(exports, "DefaultHealthConfig", { enumerable: true, get: function () { return health_1.DefaultHealthConfig; } });
//# sourceMappingURL=index.js.map