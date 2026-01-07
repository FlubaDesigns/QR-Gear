"use strict";
/**
 * NEXUSMAIL FIREBASE MODULE
 *
 * Main entry point for NexusMail in Firebase Cloud Functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultTemplates = exports.DEFAULT_TEMPLATES = exports.createQRGearBranding = exports.QRGearBrandingAdapter = exports.createFirestoreHealthStore = exports.createFirestoreIdempotencyStore = exports.createFirestoreTemplateStore = exports.createFirestoreOutboxRepository = exports.FirestoreHealthStore = exports.FirestoreIdempotencyStore = exports.FirestoreTemplateStore = exports.FirestoreOutboxRepository = exports.createResendProviderFromEnv = exports.createResendProvider = exports.ResendProviderAdapter = exports.sendShippingNotification = exports.sendOrderConfirmation = exports.getNexusMailService = exports.NexusMailService = void 0;
// Service
var NexusMailService_1 = require("./NexusMailService");
Object.defineProperty(exports, "NexusMailService", { enumerable: true, get: function () { return NexusMailService_1.NexusMailService; } });
Object.defineProperty(exports, "getNexusMailService", { enumerable: true, get: function () { return NexusMailService_1.getNexusMailService; } });
Object.defineProperty(exports, "sendOrderConfirmation", { enumerable: true, get: function () { return NexusMailService_1.sendOrderConfirmation; } });
Object.defineProperty(exports, "sendShippingNotification", { enumerable: true, get: function () { return NexusMailService_1.sendShippingNotification; } });
// Provider
var ResendProviderAdapter_1 = require("./ResendProviderAdapter");
Object.defineProperty(exports, "ResendProviderAdapter", { enumerable: true, get: function () { return ResendProviderAdapter_1.ResendProviderAdapter; } });
Object.defineProperty(exports, "createResendProvider", { enumerable: true, get: function () { return ResendProviderAdapter_1.createResendProvider; } });
Object.defineProperty(exports, "createResendProviderFromEnv", { enumerable: true, get: function () { return ResendProviderAdapter_1.createResendProviderFromEnv; } });
// Firestore Adapters
var FirestoreAdapters_1 = require("./FirestoreAdapters");
Object.defineProperty(exports, "FirestoreOutboxRepository", { enumerable: true, get: function () { return FirestoreAdapters_1.FirestoreOutboxRepository; } });
Object.defineProperty(exports, "FirestoreTemplateStore", { enumerable: true, get: function () { return FirestoreAdapters_1.FirestoreTemplateStore; } });
Object.defineProperty(exports, "FirestoreIdempotencyStore", { enumerable: true, get: function () { return FirestoreAdapters_1.FirestoreIdempotencyStore; } });
Object.defineProperty(exports, "FirestoreHealthStore", { enumerable: true, get: function () { return FirestoreAdapters_1.FirestoreHealthStore; } });
Object.defineProperty(exports, "createFirestoreOutboxRepository", { enumerable: true, get: function () { return FirestoreAdapters_1.createFirestoreOutboxRepository; } });
Object.defineProperty(exports, "createFirestoreTemplateStore", { enumerable: true, get: function () { return FirestoreAdapters_1.createFirestoreTemplateStore; } });
Object.defineProperty(exports, "createFirestoreIdempotencyStore", { enumerable: true, get: function () { return FirestoreAdapters_1.createFirestoreIdempotencyStore; } });
Object.defineProperty(exports, "createFirestoreHealthStore", { enumerable: true, get: function () { return FirestoreAdapters_1.createFirestoreHealthStore; } });
// Branding
var QRGearBranding_1 = require("./QRGearBranding");
Object.defineProperty(exports, "QRGearBrandingAdapter", { enumerable: true, get: function () { return QRGearBranding_1.QRGearBrandingAdapter; } });
Object.defineProperty(exports, "createQRGearBranding", { enumerable: true, get: function () { return QRGearBranding_1.createQRGearBranding; } });
// Templates
var defaultTemplates_1 = require("./defaultTemplates");
Object.defineProperty(exports, "DEFAULT_TEMPLATES", { enumerable: true, get: function () { return defaultTemplates_1.DEFAULT_TEMPLATES; } });
Object.defineProperty(exports, "seedDefaultTemplates", { enumerable: true, get: function () { return defaultTemplates_1.seedDefaultTemplates; } });
//# sourceMappingURL=index.js.map