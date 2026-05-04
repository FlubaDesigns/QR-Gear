export function getCanonicalBlankKey(product: { id: number | string; fulfillmentProvider?: string; docId?: string }): string {
  if ((product as any).docId) return (product as any).docId;
  const id = String(product.id);
  if (product.fulfillmentProvider === 'printful') {
    return id.startsWith('pf:') ? id : `pf:${id}`;
  }
  return id;
}

export function getMasterDocKey(product: { id: number | string; fulfillmentProvider?: string; docId?: string }): string {
  if ((product as any).docId) return (product as any).docId;
  const id = String(product.id);
  if (product.fulfillmentProvider === 'printful') {
    return id.startsWith('pf_') ? id : `pf_${id}`;
  }
  return id.startsWith('py_') ? id : `py_${id}`;
}

export function safeBlankId(id: unknown): string {
  return String(id ?? '');
}

export function isProviderPrintful(blankKey: string): boolean {
  return safeBlankId(blankKey).startsWith('pf:');
}

export function getProviderFromKey(blankKey: string): 'printify' | 'printful' {
  return isProviderPrintful(blankKey) ? 'printful' : 'printify';
}

export function getRawIdFromKey(blankKey: string): string {
  const safe = safeBlankId(blankKey);
  return safe.startsWith('pf:') ? safe.slice(3) : safe;
}

// ── QRG Blank ID helpers ──────────────────────────────────────────────────────

/**
 * Validates a 4-digit QRG blank number (BBBB segment).
 * Valid range: 1000–6999 (first digit 1–6, three more digits).
 * Regex: ^[1-6][0-9]{3}$
 * Examples: 1101, 1201, 2101, 4101, 6101
 * Legacy 3-digit codes (101, 201, etc.) are NOT valid under current law.
 */
export function isValidQRGBlankNumber(num: number | string): boolean {
  return /^[1-6][0-9]{3}$/.test(String(num));
}

/**
 * Returns true for doc IDs in the current QRG BBBB numbering format:
 * "qrg_1101", "qrg_1201", "qrg_2101", etc.
 * Legacy 3-digit IDs like "qrg_101" return false.
 */
export function isQRGBlankId(id: string): boolean {
  const safe = safeBlankId(id);
  if (!safe.startsWith('qrg_')) return false;
  return isValidQRGBlankNumber(safe.slice(4));
}

/**
 * Returns true for blank doc IDs that are pending QRG classification:
 * "pending_py_123", "pending_pf_456", etc.
 */
export function isPendingBlankId(id: string): boolean {
  return safeBlankId(id).startsWith('pending_');
}

/**
 * Extracts the numeric BBBB portion from a QRG blank ID.
 * Returns null for non-QRG IDs or legacy 3-digit IDs.
 */
export function getQRGBlankNumber(id: string): number | null {
  if (!isQRGBlankId(id)) return null;
  const num = parseInt(safeBlankId(id).slice(4), 10);
  return isNaN(num) ? null : num;
}
