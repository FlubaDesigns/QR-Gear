"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QR_GEAR_FROM_EMAIL = void 0;
exports.getResendApiKey = getResendApiKey;
exports.getResendClient = getResendClient;
const resend_1 = require("resend");
// ============ EMAIL SERVICE (QR Gear - Separate from KC) ============
function getResendApiKey() {
    return process.env.QR_RESEND_API_KEY || '';
}
function getResendClient() {
    const apiKey = getResendApiKey();
    if (!apiKey || apiKey.length < 10) {
        return null;
    }
    return new resend_1.Resend(apiKey);
}
const QR_GEAR_FROM_EMAIL = 'QR Gear <noreply@qrgear.com>';
exports.QR_GEAR_FROM_EMAIL = QR_GEAR_FROM_EMAIL;
//# sourceMappingURL=email.js.map