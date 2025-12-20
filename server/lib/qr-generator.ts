import QRCode from "qrcode";

interface QRCodeStyle {
  color?: string;
  backgroundColor?: string;
  logoUrl?: string;
}

export async function generateTextQRCode(
  text: string,
  style: QRCodeStyle = {}
): Promise<string> {
  const options = {
    errorCorrectionLevel: "H" as const,
    type: "image/png" as const,
    quality: 1,
    margin: 1,
    color: {
      dark: style.color || "#000000",
      light: style.backgroundColor || "#FFFFFF",
    },
  };

  try {
    const dataUrl = await QRCode.toDataURL(text, options);
    return dataUrl;
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error}`);
  }
}

export async function generateImageQRCode(
  imageUrl: string,
  style: QRCodeStyle = {}
): Promise<string> {
  const options = {
    errorCorrectionLevel: "H" as const,
    type: "image/png" as const,
    quality: 1,
    margin: 1,
    color: {
      dark: style.color || "#000000",
      light: style.backgroundColor || "#FFFFFF",
    },
  };

  try {
    const dataUrl = await QRCode.toDataURL(imageUrl, options);
    return dataUrl;
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error}`);
  }
}

const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:'];
const SUSPICIOUS_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /\beval\s*\(/i,
  /\bdocument\./i,
  /\bwindow\./i,
];

export function sanitizeQRContent(content: string): string {
  if (!content) return '';
  
  let sanitized = content.trim();
  
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return sanitized;
}

export function validateQRContent(content: string, type: "text" | "image"): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  const lowerContent = content.toLowerCase().trim();
  
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (lowerContent.startsWith(protocol)) {
      return false;
    }
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      return false;
    }
  }

  if (type === "text") {
    return content.length <= 2953;
  }

  if (type === "image") {
    try {
      const url = new URL(content);
      const allowedProtocols = ['http:', 'https:'];
      if (!allowedProtocols.includes(url.protocol)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
