export function getCanonicalBlankKey(product: { id: number | string; fulfillmentProvider?: string }): string {
  const id = String(product.id);
  if (product.fulfillmentProvider === 'printful') {
    return id.startsWith('pf:') ? id : `pf:${id}`;
  }
  return id;
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
