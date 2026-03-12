/**
 * NEXUSMAIL TRIGGER CONTRACTS
 * Canonical trigger definitions for all sites.
 * Each trigger defines: name, template, required vars, recipient resolution.
 */

import { TriggerContract, TriggerName } from "./types";

// ============================================================================
// TRIGGER REGISTRY
// ============================================================================

export const TriggerRegistry: Record<TriggerName, TriggerContract> = {
  BUSINESS_APPROVED: {
    triggerName: "BUSINESS_APPROVED",
    templateSlug: "business_approved",
    requiredVars: ["business_name", "dashboard_url", "approval_date"],
    entityType: "business",
    terminalStates: ["APPROVED"],
    recipientResolver: (p) => p.owner_email,
    description: "Sent when a business is approved to join the platform",
  },

  CHURCH_APPROVED: {
    triggerName: "CHURCH_APPROVED",
    templateSlug: "church_approved",
    requiredVars: ["church_name", "dashboard_url", "approval_date"],
    entityType: "church",
    terminalStates: ["APPROVED"],
    recipientResolver: (p) => p.admin_email,
    description: "Sent when a church is approved to join the platform",
  },

  BUSINESS_APPROVED_CHURCH: {
    triggerName: "BUSINESS_APPROVED_CHURCH",
    templateSlug: "business_approved_church",
    requiredVars: ["business_name", "church_name", "connection_date"],
    entityType: "church",
    terminalStates: ["CONNECTED"],
    recipientResolver: (p) => p.church_admin_email,
    description: "Sent to church when a business connection is approved",
  },

  CHURCH_APPROVED_BUSINESS: {
    triggerName: "CHURCH_APPROVED_BUSINESS",
    templateSlug: "church_approved_business",
    requiredVars: ["church_name", "business_name", "connection_date"],
    entityType: "business",
    terminalStates: ["CONNECTED"],
    recipientResolver: (p) => p.business_owner_email,
    description: "Sent to business when a church connection is approved",
  },

  MEMBER_WELCOME: {
    triggerName: "MEMBER_WELCOME",
    templateSlug: "member_welcome",
    requiredVars: ["recipient_name", "organization_name", "login_url"],
    entityType: "member",
    terminalStates: ["ACTIVE"],
    recipientResolver: (p) => p.recipient_email,
    description: "Sent when a new member joins an organization",
  },

  MEMBER_ROLE_CHANGE: {
    triggerName: "MEMBER_ROLE_CHANGE",
    templateSlug: "member_role_change",
    requiredVars: ["recipient_name", "old_role", "new_role", "organization_name"],
    entityType: "member",
    terminalStates: ["ROLE_UPDATED"],
    recipientResolver: (p) => p.recipient_email,
    description: "Sent when a member's role changes",
  },

  ORDER_CONFIRMATION: {
    triggerName: "ORDER_CONFIRMATION",
    templateSlug: "order_confirmation",
    requiredVars: ["order_number", "customer_name", "order_total", "order_items"],
    optionalVars: ["shipping_address", "estimated_delivery"],
    entityType: "order",
    terminalStates: ["CONFIRMED", "PAID"],
    recipientResolver: (p) => p.customer_email,
    description: "Sent when an order is placed and confirmed",
  },

  ORDER_SHIPPED: {
    triggerName: "ORDER_SHIPPED",
    templateSlug: "order_shipped",
    requiredVars: ["order_number", "customer_name", "tracking_number", "carrier"],
    optionalVars: ["tracking_url", "estimated_delivery"],
    entityType: "order",
    terminalStates: ["SHIPPED", "FULFILLED"],
    recipientResolver: (p) => p.customer_email,
    description: "Sent when an order ships with tracking info",
  },

  PASSWORD_RESET: {
    triggerName: "PASSWORD_RESET",
    templateSlug: "password_reset",
    requiredVars: ["recipient_name", "reset_url", "expiry_time"],
    entityType: "user",
    terminalStates: ["RESET_REQUESTED"],
    recipientResolver: (p) => p.recipient_email,
    description: "Sent when a password reset is requested",
  },

  GENERIC_NOTIFICATION: {
    triggerName: "GENERIC_NOTIFICATION",
    templateSlug: "generic_notification",
    requiredVars: ["recipient_name", "notification_title", "notification_body"],
    entityType: "user",
    terminalStates: ["NOTIFIED"],
    recipientResolver: (p) => p.recipient_email,
    description: "Generic notification for custom messages",
  },
};

// ============================================================================
// SITE-SPECIFIC TRIGGER ENABLEMENT
// ============================================================================

/**
 * Site identifiers for multi-tenant email.
 * 'qrgear' = the QR Gear platform itself.
 * 'kingdom_connects' = KC partner site (external partner, not a platform alias).
 * 'default' = fallback for unrecognized sites.
 */
export type SiteId = "qrgear" | "kingdom_connects" | "default";

/**
 * Defines which triggers are enabled per site.
 * A trigger must be listed here AND in the registry to be usable.
 */
export const SiteTriggerEnablement: Record<SiteId, TriggerName[]> = {
  qrgear: [
    "ORDER_CONFIRMATION",
    "ORDER_SHIPPED",
    "PASSWORD_RESET",
    "GENERIC_NOTIFICATION",
  ],
  kingdom_connects: [
    "BUSINESS_APPROVED",
    "CHURCH_APPROVED",
    "BUSINESS_APPROVED_CHURCH",
    "CHURCH_APPROVED_BUSINESS",
    "MEMBER_WELCOME",
    "MEMBER_ROLE_CHANGE",
    "PASSWORD_RESET",
    "GENERIC_NOTIFICATION",
  ],
  default: ["PASSWORD_RESET", "GENERIC_NOTIFICATION"],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a trigger contract by name.
 */
export function getTriggerContract(
  triggerName: TriggerName
): TriggerContract | undefined {
  return TriggerRegistry[triggerName];
}

/**
 * Check if a trigger is enabled for a specific site.
 */
export function isTriggerEnabled(
  triggerName: TriggerName,
  siteId: SiteId
): boolean {
  const enabledTriggers = SiteTriggerEnablement[siteId] || SiteTriggerEnablement.default;
  return enabledTriggers.includes(triggerName);
}

/**
 * Get all enabled triggers for a site.
 */
export function getEnabledTriggers(siteId: SiteId): TriggerContract[] {
  const enabledNames = SiteTriggerEnablement[siteId] || SiteTriggerEnablement.default;
  return enabledNames
    .map((name) => TriggerRegistry[name])
    .filter((contract): contract is TriggerContract => !!contract);
}
