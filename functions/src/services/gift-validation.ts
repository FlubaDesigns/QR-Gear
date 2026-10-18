export function isFreeGiftPromotion(pkg: any): boolean {
  return pkg?.isActive === true && pkg.isFreePromotion === true &&
    (typeof pkg.price === 'number' || (typeof pkg.price === 'string' && pkg.price.trim() !== '')) && Number(pkg.price) === 0;
}
export function giftExpiry(value: any): Date | null {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : new Date(value));
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}
export function assertRedeemableGift(gift: any) {
  if (!gift || gift.status !== 'active') throw Object.assign(new Error('Gift code is not active'), { status: 409 });
  const expires = giftExpiry(gift.expiresAt);
  if (!expires || expires.getTime() <= Date.now()) throw Object.assign(new Error('Gift code has expired'), { status: 410 });
}
