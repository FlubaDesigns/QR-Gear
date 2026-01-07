/**
 * NEXUSMAIL FIREBASE MODULE
 * 
 * Main entry point for NexusMail in Firebase Cloud Functions.
 */

// Service
export {
  NexusMailService,
  getNexusMailService,
  sendOrderConfirmation,
  sendShippingNotification,
} from './NexusMailService';
export type { NexusMailServiceConfig, SendResult } from './NexusMailService';

// Provider
export { ResendProviderAdapter, createResendProvider, createResendProviderFromEnv } from './ResendProviderAdapter';
export type { ResendProviderConfig } from './ResendProviderAdapter';

// Firestore Adapters
export {
  FirestoreOutboxRepository,
  FirestoreTemplateStore,
  FirestoreIdempotencyStore,
  FirestoreHealthStore,
  createFirestoreOutboxRepository,
  createFirestoreTemplateStore,
  createFirestoreIdempotencyStore,
  createFirestoreHealthStore,
} from './FirestoreAdapters';

// Branding
export { QRGearBrandingAdapter, createQRGearBranding } from './QRGearBranding';

// Templates
export { DEFAULT_TEMPLATES, seedDefaultTemplates } from './defaultTemplates';
