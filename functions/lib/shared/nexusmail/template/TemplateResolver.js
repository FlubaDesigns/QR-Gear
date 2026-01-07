"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateResolver = void 0;
exports.createTemplateResolver = createTemplateResolver;
const utils_1 = require("../utils");
// ============================================================================
// DEFAULT BRANDING ADAPTER
// ============================================================================
const defaultBrandingAdapter = {
    wrapHtml: (html, _meta) => html,
    wrapText: (text, _meta) => text,
    subjectPrefix: (subject, _meta) => subject,
};
// ============================================================================
// TEMPLATE RESOLVER CLASS
// ============================================================================
class TemplateResolver {
    constructor(options) {
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
    async resolve(templateSlug, payload, meta, triggerName) {
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
                const missing = template.requiredVars.filter((v) => payload[v] === undefined || payload[v] === null || payload[v] === "");
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
            const subjectVars = (0, utils_1.extractVariables)(template.subject);
            const htmlVars = (0, utils_1.extractVariables)(template.htmlBody);
            const textVars = template.textBody ? (0, utils_1.extractVariables)(template.textBody) : [];
            const allReferencedVars = Array.from(new Set([...subjectVars, ...htmlVars, ...textVars]));
            // Step 5: Check for missing referenced variables
            const missingVars = (0, utils_1.findMissingVariables)(`${template.subject} ${template.htmlBody} ${template.textBody || ""}`, payload);
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
            const renderedSubject = (0, utils_1.injectVariables)(template.subject, payload);
            const renderedHtml = (0, utils_1.injectVariables)(template.htmlBody, payload);
            const renderedText = template.textBody
                ? (0, utils_1.injectVariables)(template.textBody, payload)
                : undefined;
            // Step 7: Apply branding
            const brandedSubject = this.brandingAdapter.subjectPrefix
                ? this.brandingAdapter.subjectPrefix(renderedSubject, meta)
                : renderedSubject;
            const brandedHtml = this.brandingAdapter.wrapHtml(renderedHtml, meta);
            const brandedText = renderedText && this.brandingAdapter.wrapText
                ? this.brandingAdapter.wrapText(renderedText, meta)
                : renderedText;
            // Step 8: Build final output
            const rendered = {
                slug: templateSlug,
                subject: brandedSubject,
                html: brandedHtml,
                text: brandedText,
                meta: {
                    renderedAt: (0, utils_1.nowISO)(),
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
        }
        catch (error) {
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
    async preview(templateSlug, samplePayload, meta, triggerName) {
        // Use non-strict mode for preview to show partial renders
        const originalStrict = this.strictMode;
        this.strictMode = false;
        const result = await this.resolve(templateSlug, samplePayload, meta, triggerName);
        this.strictMode = originalStrict;
        return result;
    }
}
exports.TemplateResolver = TemplateResolver;
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
function createTemplateResolver(options) {
    return new TemplateResolver(options);
}
//# sourceMappingURL=TemplateResolver.js.map