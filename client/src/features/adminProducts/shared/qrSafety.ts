export type QrSafetyStatus = "safe" | "caution" | "risky" | "replace";

export const MIN_SAFE_QR_SIZE_PERCENT = 35;
export const MAX_SAFE_QR_SIZE_PERCENT = 100;
export const FORCE_BLOCK_REPLACE_QR = true;

export function clampQrPercent(value: number) {
  return Math.max(MIN_SAFE_QR_SIZE_PERCENT, Math.min(MAX_SAFE_QR_SIZE_PERCENT, value));
}

export function sanitizeQrReadableContent<T extends Record<string, any>>(partial: T): T {
  const next = { ...partial };
  if (typeof next.qrSizePercent === "number") {
    next.qrSizePercent = clampQrPercent(next.qrSizePercent);
  }
  if (typeof next.qrPositionX === "number") {
    next.qrPositionX = Math.max(0, Math.min(100, next.qrPositionX));
  }
  if (typeof next.qrPositionY === "number") {
    next.qrPositionY = Math.max(0, Math.min(100, next.qrPositionY));
  }
  if (FORCE_BLOCK_REPLACE_QR && next.areaImageMode === "replace-qr") {
    next.areaImageMode = "behind-qr";
  }
  return next;
}

export function getQrSafetyAssessment({
  qrSizePercent,
  areaImageMode,
  subBottomEnabled,
  headerEnabled,
  footerEnabled,
}: {
  qrSizePercent: number;
  areaImageMode?: string;
  subBottomEnabled?: boolean;
  headerEnabled?: boolean;
  footerEnabled?: boolean;
}) {
  if (areaImageMode === "replace-qr") {
    return {
      status: "replace" as QrSafetyStatus,
      label: "QR Replaced",
      score: 0,
      summary: "Center image is replacing the QR. This is not scannable as a QR code.",
      tips: ["Switch center image mode back to 'Behind QR' if readability matters."],
    };
  }

  let score = 100;
  const tips: string[] = [];

  if (qrSizePercent < 30) {
    score -= 45;
    tips.push("QR is too small. Raise it to at least 35–40% for more reliable scanning.");
  } else if (qrSizePercent < 40) {
    score -= 20;
    tips.push("QR is on the small side. Bigger is safer, especially for print.");
  }

  if (subBottomEnabled) {
    score -= 6;
    tips.push("Sub-bottom text reduces available QR area slightly. Keep enough breathing room.");
  }

  if (headerEnabled && footerEnabled) {
    score -= 6;
    tips.push("Top and bottom content both active means the QR zone is more crowded.");
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 85) {
    return {
      status: "safe" as QrSafetyStatus, label: "Safe", score,
      summary: "This layout looks comfortably readable for most normal use.",
      tips: tips.length ? tips : ["Still test on at least one phone before finalizing."],
    };
  }

  if (score >= 60) {
    return {
      status: "caution" as QrSafetyStatus, label: "Caution", score,
      summary: "This may scan fine, but you are getting closer to the edge.",
      tips,
    };
  }

  return {
    status: "risky" as QrSafetyStatus, label: "Risky", score,
    summary: "This layout is more likely to fail or become inconsistent across phones and print conditions.",
    tips,
  };
}

export function getQrSafetyClasses(status: QrSafetyStatus) {
  switch (status) {
    case "safe":
      return { wrap: "border-emerald-500/30 bg-emerald-500/10", badge: "bg-emerald-600 text-white", text: "text-emerald-200" };
    case "caution":
      return { wrap: "border-amber-500/30 bg-amber-500/10", badge: "bg-amber-500 text-black", text: "text-amber-100" };
    case "risky":
      return { wrap: "border-red-500/30 bg-red-500/10", badge: "bg-red-600 text-white", text: "text-red-100" };
    case "replace":
    default:
      return { wrap: "border-red-600/40 bg-red-600/15", badge: "bg-red-700 text-white", text: "text-red-100" };
  }
}
