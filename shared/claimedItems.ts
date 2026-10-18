export interface ClaimedItem { id: string; status: string; hostingExpiresAt?: string | null; productName?: string; previewImageUrl?: string; qrgBaseCode?: string; qrgId?: string; }
export type ClaimedItemsResponse = ClaimedItem[];
export function claimedItemLifecycle(item: Pick<ClaimedItem, 'status' | 'hostingExpiresAt'>, now = Date.now()) {
  const isStatic = item.status === 'static', expiry = item.hostingExpiresAt ? Date.parse(item.hostingExpiresAt) : NaN;
  return { isStatic, isActive: isStatic || (item.status === 'active' && expiry > now),
    daysRemaining: isStatic || !Number.isFinite(expiry) ? null : Math.max(0, Math.ceil((expiry - now) / 86400000)) };
}
