/**
 * RESEND PROVIDER ADAPTER
 * 
 * Firebase Cloud Functions implementation of NexusMail provider
 * using Resend as the email delivery service.
 */

import { Resend } from 'resend';
import {
  NexusMailRecipient,
  NexusMailRenderedEmail,
  ProviderResult,
  BaseProviderAdapter,
  successResult,
  failureResult,
  isRetryableHttpStatus,
} from '../../../shared/nexusmail';

// ============================================================================
// RESEND PROVIDER CONFIGURATION
// ============================================================================

export interface ResendProviderConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

// ============================================================================
// RESEND PROVIDER ADAPTER
// ============================================================================

export class ResendProviderAdapter extends BaseProviderAdapter {
  providerName = 'resend';
  private client: Resend;
  private fromEmail: string;
  private fromName: string;
  private replyTo?: string;

  constructor(config: ResendProviderConfig) {
    super();
    this.client = new Resend(config.apiKey);
    this.fromEmail = config.fromEmail;
    this.fromName = config.fromName || 'QR Gear';
    this.replyTo = config.replyTo;
  }

  async send(
    recipient: NexusMailRecipient,
    rendered: NexusMailRenderedEmail
  ): Promise<ProviderResult> {
    // Validate request
    const validationError = this.validateSendRequest(recipient, rendered);
    if (validationError) {
      return failureResult('VALIDATION_ERROR', validationError, false);
    }

    try {
      const result = await this.client.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: this.replyTo,
        tags: [
          { name: 'site', value: rendered.meta.siteId },
          { name: 'trigger', value: rendered.meta.triggerName },
          { name: 'template', value: rendered.slug },
        ],
      });

      if (result.error) {
        // Resend returns error in result object
        const errorMessage = result.error.message || 'Unknown Resend error';
        const retryable = this.isResendErrorRetryable(result.error);
        
        console.error('[ResendProvider] Send failed:', {
          recipient: recipient.email,
          error: result.error,
        });

        return failureResult(
          result.error.name || 'RESEND_ERROR',
          errorMessage,
          retryable,
          result
        );
      }

      if (result.data?.id) {
        console.log('[ResendProvider] Send successful:', {
          recipient: recipient.email,
          messageId: result.data.id,
          trigger: rendered.meta.triggerName,
        });

        return successResult(result.data.id, result);
      }

      // Unexpected response format
      return failureResult(
        'UNEXPECTED_RESPONSE',
        'Resend returned unexpected response format',
        true,
        result
      );
    } catch (error: any) {
      console.error('[ResendProvider] Exception during send:', {
        recipient: recipient.email,
        error: error?.message || String(error),
      });

      // Determine if retryable based on error type
      const retryable = this.isExceptionRetryable(error);
      
      return failureResult(
        error?.name || 'SEND_EXCEPTION',
        error?.message || 'Failed to send email',
        retryable,
        { error: error?.message, stack: error?.stack }
      );
    }
  }

  /**
   * Determine if a Resend API error is retryable.
   */
  private isResendErrorRetryable(error: any): boolean {
    // Resend rate limit
    if (error.name === 'rate_limit_exceeded') return true;
    if (error.statusCode && isRetryableHttpStatus(error.statusCode)) return true;
    
    // Validation errors are not retryable
    if (error.name === 'validation_error') return false;
    if (error.name === 'missing_required_field') return false;
    
    // Auth errors are not retryable
    if (error.name === 'missing_api_key') return false;
    if (error.name === 'invalid_api_key') return false;
    
    // Default to retryable for unknown errors (safer)
    return true;
  }

  /**
   * Determine if an exception is retryable.
   */
  private isExceptionRetryable(error: any): boolean {
    const message = (error?.message || '').toLowerCase();
    
    // Network errors
    if (message.includes('network')) return true;
    if (message.includes('timeout')) return true;
    if (message.includes('econnrefused')) return true;
    if (message.includes('socket')) return true;
    if (message.includes('fetch')) return true;
    
    // Rate limits
    if (message.includes('rate')) return true;
    if (message.includes('429')) return true;
    
    // Server errors
    if (message.includes('500')) return true;
    if (message.includes('502')) return true;
    if (message.includes('503')) return true;
    if (message.includes('504')) return true;
    
    return false;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createResendProvider(config: ResendProviderConfig): ResendProviderAdapter {
  return new ResendProviderAdapter(config);
}

/**
 * Create Resend provider from environment variables.
 */
export function createResendProviderFromEnv(): ResendProviderAdapter | null {
  const apiKey = process.env.QR_RESEND_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    console.warn('[ResendProvider] QR_RESEND_API_KEY not configured');
    return null;
  }

  return new ResendProviderAdapter({
    apiKey,
    fromEmail: 'noreply@qrgear.com',
    fromName: 'QR Gear',
  });
}
