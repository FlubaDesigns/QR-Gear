"use strict";
/**
 * QR GEAR BRANDING ADAPTER
 *
 * Site-specific branding for QR Gear emails.
 * Wraps email content with QR Gear header, footer, and styling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRGearBrandingAdapter = void 0;
exports.createQRGearBranding = createQRGearBranding;
// ============================================================================
// QR GEAR BRAND COLORS
// ============================================================================
const COLORS = {
    primary: '#2563eb', // Blue
    primaryDark: '#1d4ed8',
    background: '#f9fafb',
    cardBg: '#ffffff',
    text: '#333333',
    textMuted: '#666666',
    border: '#e5e7eb',
};
// ============================================================================
// QR GEAR BRANDING ADAPTER
// ============================================================================
class QRGearBrandingAdapter {
    constructor(baseUrl = 'https://qrgear-c1ffd.web.app') {
        this.baseUrl = baseUrl;
    }
    wrapHtml(htmlInner, meta) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Gear</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${COLORS.background}; color: ${COLORS.text};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${COLORS.background};">
    <tr>
      <td align="center" style="padding: 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 24px 0; text-align: center;">
              <a href="${this.baseUrl}" style="text-decoration: none;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${COLORS.primary};">QR Gear</h1>
              </a>
              <p style="margin: 8px 0 0; font-size: 14px; color: ${COLORS.textMuted};">Custom QR Products</p>
            </td>
          </tr>
          
          <!-- Content Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${COLORS.cardBg}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <tr>
                  <td style="padding: 32px;">
                    ${htmlInner}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 14px; color: ${COLORS.textMuted};">
                Questions? Reply to this email or contact us at <a href="mailto:support@qrgear.com" style="color: ${COLORS.primary};">support@qrgear.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: ${COLORS.textMuted};">
                &copy; ${new Date().getFullYear()} QR Gear by Fluba Designs LLC. All rights reserved.
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: ${COLORS.textMuted};">
                <a href="${this.baseUrl}" style="color: ${COLORS.textMuted}; text-decoration: underline;">Visit our store</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
    wrapText(textInner, meta) {
        return `
QR GEAR
Custom QR Products
================================

${textInner}

================================
Questions? Contact us at support@qrgear.com

© ${new Date().getFullYear()} QR Gear by Fluba Designs LLC
Visit: ${this.baseUrl}
`;
    }
    subjectPrefix(subject, meta) {
        // No prefix for QR Gear - keep subjects clean
        return subject;
    }
}
exports.QRGearBrandingAdapter = QRGearBrandingAdapter;
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
function createQRGearBranding(baseUrl) {
    return new QRGearBrandingAdapter(baseUrl);
}
//# sourceMappingURL=QRGearBranding.js.map