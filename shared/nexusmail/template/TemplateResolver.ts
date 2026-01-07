/**
 * NEXUSMAIL TEMPLATE RESOLVER
 * 
 * Turns (templateSlug + payload) into (subject + html + text)
 * without tying to any specific storage or template language.
 * 
 * Responsibilities:
 * - Template resolution by SLUG
 * - Variable injection (safe + deterministic)
 * - Required-variable validation (final guard)
 * - Branding wrappers (site-specific but standardized)
 * - Output normalization (subject/html/text)
 */

import {
  TriggerName,
  NexusMailTemplate,
  NexusMailRenderedEmail,
  NexusMailMeta,
} from "../types";
import {
  extractVariables,
  injectVariables,
  findMissingVariables,
  nowISO,
} from "../utils";

// ============================================================================
// TEMPLATE STORE ADAPTER
// ============================================================================

/**
 * Interface for template storage.
 * Must be implemented by storage adapters (Firestore, memory, etc.)
 */
export interface TemplateStoreAdapter {
  getBySlug(slug: string): Promise<NexusMailTemplate | null>;
  list?(filters?: { category?: string; active?: boolean }): Promise<NexusMailTemplate[]>;
}

// ============================================================================
// BRANDING ADAPTER
// ============================================================================

/**
 * Interface for site-specific branding.
 * Wraps email content with headers, footers, logos, etc.
 */
export interface BrandingAdapter {
  wrapHtml(htmlInner: string, meta: NexusMailMeta): string;
  wrapText?(textInner: string, meta: NexusMailMeta): string;
  subjectPrefix?(subject: string, meta: NexusMailMeta): string;
}

// ============================================================================
// DEFAULT BRANDING ADAPTER
// ============================================================================

const defaultBrandingAdapter: BrandingAdapter = {
  wrapHtml: (html, _meta) => html,
  wrapText: (text, _meta) => text,
  subjectPrefix: (subject, _meta) => subject,
};

// ============================================================================
// RESOLVER OPTIONS
// ============================================================================

export interface TemplateResolverOptions {
  templateStore: TemplateStoreAdapter;
  brandingAdapter?: BrandingAdapter;
  logger?: TemplateResolverLogger;
  strictMode?: boolean; // Fail on any missing variable (default: true)
}

export interface TemplateResolverLogger {
  info(event: string, data: Record<string, any>): void;
  warn(event: string, data: Record<string, any>): void;
  error(event: string, data: Record<string, any>): void;
}

// ============================================================================
// RESOLVER RESULT TYPES
// ============================================================================

export type ResolveResult =
  | { success: true; rendered: NexusMailRenderedEmail }
  | { success: false; reason: ResolveFailReason; details?: string };

export type ResolveFailReason =
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_INACTIVE"
  | "MISSING_TEMPLATE_VARS"
  | "RENDER_ERROR";

// ============================================================================
// TEMPLATE RESOLVER CLASS
// ============================================================================

export class TemplateResolver {
  private templateStore: TemplateStoreAdapter;
  private brandingAdapter: BrandingAdapter;
  private logger: TemplateResolverLogger;
  private strictMode: boolean;

  constructor(options: TemplateResolverOptions) {
    this.templateStore = options.templateStore;
    this.brandingAdapter = options.brandingAdapter || defaultBrandingAdapter;
    this.logger = options.logger || {
      info: (e, d) => console.log(`[TemplateResolver:INFO] ${e}`, d),
      warn: (e, d) => console.warn(`[TemplateResolver:WARN] ${e}`, d),
      error: (e, d) => console.error(`[TemplateResolver:ERROR] ${e}`, d),
    };
    this.strictMode = options.strictMode !== false;
  }

  /**
   * Resolve a template by slug and render with payload.
   */
  async resolve(
    templateSlug: string,
    payload: Record<string, any>,
    meta: NexusMailMeta,
    triggerName: TriggerName
  ): Promise<ResolveResult> {
    try {
      // Step 1: Fetch template by slug
      const template = await this.templateStore.getBySlug(templateSlug);
      if (!template) {
        this.logger.error("template_not_found", { templateSlug });
        return {
          success: false,
          reason: "TEMPLATE_NOT_FOUND",
          details: `Template not found: ${templateSlug}`,
        };
      }

      // Step 2: Check if template is active
      if (!template.active) {
        this.logger.warn("template_inactive", { templateSlug });
        return {
          success: false,
          reason: "TEMPLATE_INACTIVE",
          details: `Template is inactive: ${templateSlug}`,
        };
      }

      // Step 3: Stage 2 validation - check template-level required vars
      if (template.requiredVars && template.requiredVars.length > 0) {
        const missing = template.requiredVars.filter(
          (v) => payload[v] === undefined || payload[v] === null || payload[v] === ""
        );
        if (missing.length > 0) {
          this.logger.error("missing_template_vars", {
            templateSlug,
            missing,
            triggerName,
          });
          return {
            success: false,
            reason: "MISSING_TEMPLATE_VARS",
            details: `Missing required template variables: ${missing.join(", ")}`,
          };
        }
      }

      // Step 4: Auto-discover referenced variables
      const subjectVars = extractVariables(template.subject);
      const htmlVars = extractVariables(template.htmlBody);
      const textVars = template.textBody ? extractVariables(template.textBody) : [];
      const allReferencedVars = Array.from(new Set([...subjectVars, ...htmlVars, ...textVars]));

      // Step 5: Check for missing referenced variables
      const missingVars = findMissingVariables(
        `${template.subject} ${template.htmlBody} ${template.textBody || ""}`,
        payload
      );

      if (this.strictMode && missingVars.length > 0) {
        this.logger.error("missing_referenced_vars", {
          templateSlug,
          missingVars,
          triggerName,
        });
        return {
          success: false,
          reason: "MISSING_TEMPLATE_VARS",
          details: `Missing referenced variables: ${missingVars.join(", ")}`,
        };
      }

      // Step 6: Inject variables
      const renderedSubject = injectVariables(template.subject, payload);
      const renderedHtml = injectVariables(template.htmlBody, payload);
      const renderedText = template.textBody
        ? injectVariables(template.textBody, payload)
        : undefined;

      // Step 7: Apply branding
      const brandedSubject = this.brandingAdapter.subjectPrefix
        ? this.brandingAdapter.subjectPrefix(renderedSubject, meta)
        : renderedSubject;
      const brandedHtml = this.brandingAdapter.wrapHtml(renderedHtml, meta);
      const brandedText =
        renderedText && this.brandingAdapter.wrapText
          ? this.brandingAdapter.wrapText(renderedText, meta)
          : renderedText;

      // Step 8: Build final output
      const rendered: NexusMailRenderedEmail = {
        slug: templateSlug,
        subject: brandedSubject,
        html: brandedHtml,
        text: brandedText,
        meta: {
          renderedAt: nowISO(),
          templateVersion: template.version,
          siteId: meta.siteId,
          triggerName,
        },
      };

      this.logger.info("template_rendered", {
        templateSlug,
        triggerName,
        referencedVarsCount: allReferencedVars.length,
      });

      return { success: true, rendered };
    } catch (error: any) {
      this.logger.error("render_error", {
        templateSlug,
        error: error?.message || String(error),
      });
      return {
        success: false,
        reason: "RENDER_ERROR",
        details: error?.message || "Unknown render error",
      };
    }
  }

  /**
   * Preview a template without sending.
   * Useful for admin preview functionality.
   */
  async preview(
    templateSlug: string,
    samplePayload: Record<string, any>,
    meta: NexusMailMeta,
    triggerName: TriggerName
  ): Promise<ResolveResult> {
    // Use non-strict mode for preview to show partial renders
    const originalStrict = this.strictMode;
    this.strictMode = false;
    const result = await this.resolve(templateSlug, samplePayload, meta, triggerName);
    this.strictMode = originalStrict;
    return result;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createTemplateResolver(options: TemplateResolverOptions): TemplateResolver {
  return new TemplateResolver(options);
}
