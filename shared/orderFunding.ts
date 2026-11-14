/** A sponsored reward has its own authority; it never impersonates Stripe payment. */
export function productionFundingDate(order: any): string | null {
  if (!order || order.productionHold || order.refund?.refundedAmountCents > 0) return null;
  if (order.paymentStatus === 'paid' && order.paymentVerifiedAt) return order.paymentVerifiedAt;
  const funding = order.funding;
  if (order.source !== 'partner_reward' || order.paymentStatus !== 'sponsored' || funding?.type !== 'partner_sponsored' ||
      !order.id || !funding.partnerId || !funding.claimId || !funding.previewId || !funding.authorization?.websiteOrderId ||
      !Number.isFinite(Date.parse(funding.authorization?.verifiedAt)) || !Number.isFinite(Date.parse(funding.authorizedAt))) return null;
  return funding.authorizedAt;
}


/** Keep legacy sponsored orders classified without rewriting historical records. */
export function commercialPurpose(order: any): string {
  return order.commercialPurpose || (order.source === 'partner_reward' && order.paymentStatus === 'sponsored' ? 'marketing_loss_leader' : 'sale');
}
