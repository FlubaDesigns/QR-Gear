export function claimedItemStatus(item: { status: string; hostingExpiresAt?: string | null }, now = Date.now()) {
  const isStatic = item.status === 'static';
  const expiry = item.hostingExpiresAt ? Date.parse(item.hostingExpiresAt) : NaN;
  const hasTerm = !isStatic && Number.isFinite(expiry);
  const daysRemaining = hasTerm ? Math.max(0, Math.ceil((expiry - now) / 86_400_000)) : null;
  const isActive = isStatic || (item.status === 'active' && hasTerm && expiry > now);
  return { isStatic, hasTerm, daysRemaining, isActive,
    label: isStatic ? 'Static QR' : isActive ? 'Active' : hasTerm && expiry <= now ? 'Expired' : 'Inactive',
  };
}
