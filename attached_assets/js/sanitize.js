/**
 * Kingdom Connects - Security & Sanitization Utilities
 * Protects against XSS (Cross-Site Scripting) attacks
 * Use these functions whenever displaying user-generated content
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * Use this for displaying ANY user input in HTML
 * @param {string} text - The text to escape
 * @returns {string} - HTML-safe text
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Strips all HTML tags from text
 * Use this when you need plain text only
 * @param {string} html - The HTML to strip
 * @returns {string} - Plain text with no HTML
 */
export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Validates and sanitizes URLs to prevent javascript: and data: attacks
 * @param {string} url - The URL to sanitize
 * @returns {string} - Safe URL or empty string if invalid
 */
export function sanitizeUrl(url) {
  if (!url) return '';
  
  const trimmed = url.trim();
  
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = trimmed.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      console.warn('Blocked dangerous URL protocol:', protocol);
      return '';
    }
  }
  
  // Only allow http, https, mailto, tel
  if (!lowerUrl.startsWith('http://') && 
      !lowerUrl.startsWith('https://') && 
      !lowerUrl.startsWith('mailto:') && 
      !lowerUrl.startsWith('tel:')) {
    // If no protocol, assume https
    return 'https://' + trimmed;
  }
  
  return trimmed;
}

/**
 * Validates email format
 * @param {string} email - The email to validate
 * @returns {boolean} - True if valid email format
 */
export function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone number (US format)
 * @param {string} phone - The phone number to validate
 * @returns {boolean} - True if valid phone format
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // US phone numbers should have 10 digits (or 11 with country code)
  return digits.length === 10 || digits.length === 11;
}

/**
 * Sanitizes and validates form input
 * @param {string} input - The input to sanitize
 * @param {Object} options - Validation options
 * @param {number} options.maxLength - Maximum length allowed
 * @param {RegExp} options.pattern - Pattern to validate against
 * @param {boolean} options.stripHtml - Whether to strip HTML tags
 * @returns {Object} - {valid: boolean, value: string, error: string}
 */
export function sanitizeInput(input, options = {}) {
  if (!input) {
    return { valid: true, value: '', error: null };
  }
  
  let sanitized = input.trim();
  
  // Strip HTML if requested
  if (options.stripHtml) {
    sanitized = stripHtml(sanitized);
  }
  
  // Check max length
  if (options.maxLength && sanitized.length > options.maxLength) {
    return {
      valid: false,
      value: sanitized.substring(0, options.maxLength),
      error: `Input exceeds maximum length of ${options.maxLength} characters`
    };
  }
  
  // Check pattern
  if (options.pattern && !options.pattern.test(sanitized)) {
    return {
      valid: false,
      value: sanitized,
      error: 'Input does not match required format'
    };
  }
  
  return { valid: true, value: sanitized, error: null };
}

/**
 * Safely renders user content into a DOM element
 * Use this instead of innerHTML for user-generated content
 * @param {HTMLElement} element - The element to render into
 * @param {string} content - The content to render (will be escaped)
 */
export function safeRender(element, content) {
  if (!element) {
    console.error('safeRender: element is null or undefined');
    return;
  }
  element.textContent = content || '';
}

/**
 * Safely renders HTML content with escaped user data
 * Use for templates where you need HTML structure but user data must be escaped
 * @param {HTMLElement} element - The element to render into
 * @param {string} template - HTML template with placeholders
 * @param {Object} data - Object with user data (will be auto-escaped)
 */
export function safeRenderTemplate(element, template, data = {}) {
  if (!element) {
    console.error('safeRenderTemplate: element is null or undefined');
    return;
  }
  
  // Escape all data values
  const escapedData = {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      escapedData[key] = escapeHtml(String(data[key]));
    }
  }
  
  // Replace placeholders in template
  let rendered = template;
  for (const key in escapedData) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, escapedData[key]);
  }
  
  element.innerHTML = rendered;
}

/**
 * Creates a safe link element
 * @param {string} url - The URL (will be sanitized)
 * @param {string} text - The link text (will be escaped)
 * @returns {HTMLAnchorElement} - Safe anchor element
 */
export function createSafeLink(url, text) {
  const a = document.createElement('a');
  a.href = sanitizeUrl(url);
  a.textContent = text || url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer'; // Security: prevent window.opener access
  return a;
}

/**
 * Rate limiting helper for form submissions
 * Prevents rapid-fire submissions
 */
export class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = [];
  }
  
  /**
   * Check if action is allowed
   * @returns {boolean} - True if allowed, false if rate limited
   */
  isAllowed() {
    const now = Date.now();
    
    // Remove old attempts outside the window
    this.attempts = this.attempts.filter(time => now - time < this.windowMs);
    
    // Check if under limit
    if (this.attempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Record this attempt
    this.attempts.push(now);
    return true;
  }
  
  /**
   * Get time until next allowed attempt
   * @returns {number} - Milliseconds until next attempt allowed
   */
  getTimeUntilReset() {
    if (this.attempts.length === 0) return 0;
    const oldest = Math.min(...this.attempts);
    const resetTime = oldest + this.windowMs;
    return Math.max(0, resetTime - Date.now());
  }
}

// Export default object with all functions
export default {
  escapeHtml,
  stripHtml,
  sanitizeUrl,
  isValidEmail,
  isValidPhone,
  sanitizeInput,
  safeRender,
  safeRenderTemplate,
  createSafeLink,
  RateLimiter
};
