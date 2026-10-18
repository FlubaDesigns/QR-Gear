import type Stripe from 'stripe';

/** A profile is a lookup hint, never proof of ownership of a financial account. */
export function assertConnectAccountOwner(account: Stripe.Account | Stripe.DeletedAccount, entityId: string): asserts account is Stripe.Account {
  if ('deleted' in account || account.type !== 'express' || account.metadata?.entityId !== entityId) {
    throw Object.assign(new Error('Stripe account ownership could not be verified. Contact support.'), { status: 403 });
  }
}

export async function retrieveOwnedConnectAccount(stripe: Stripe, entityId: string, accountId: string): Promise<Stripe.Account> {
  const account = await stripe.accounts.retrieve(accountId);
  assertConnectAccountOwner(account, entityId);
  return account;
}
