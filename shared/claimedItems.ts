export interface ClaimedItem { id: string; status: string; hostingExpiresAt?: string | null; productName?: string; previewImageUrl?: string; qrgBaseCode?: string; qrgId?: string; }
export type ClaimedItemsResponse = ClaimedItem[];
export interface HostingStatusResponse {
  instance: Pick<ClaimedItem, 'id' | 'hostingExpiresAt' | 'status'>;
  isActive: boolean;
  renewalOptions: Array<{ code: string; name: string; amountCents: number; currency: string; durationYears: number }>;
}
export function claimedItemLifecycle(item: Pick<ClaimedItem, 'status' | 'hostingExpiresAt'>, now = Date.now()) {
  const isStatic = item.status === 'static', expiry = item.hostingExpiresAt ? Date.parse(item.hostingExpiresAt) : NaN;
  const hasTerm = !isStatic && Number.isFinite(expiry);
  const isActive = isStatic || (item.status === 'active' && hasTerm && expiry > now);
  return { isStatic, hasTerm, isActive,
    daysRemaining: hasTerm ? Math.max(0, Math.ceil((expiry - now) / 86400000)) : null,
    label: isStatic ? 'Static QR' : isActive ? 'Active' : hasTerm && expiry <= now ? 'Expired' : 'Inactive' };
}
