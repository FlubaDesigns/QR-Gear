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

export function validateQRContent(content: string, type: "text" | "image"): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  if (type === "text") {
    return content.length <= 2953;
  }

  if (type === "image") {
    try {
      new URL(content);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
