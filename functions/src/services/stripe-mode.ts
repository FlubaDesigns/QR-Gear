import { requireLiveCommerce } from '../runtime-config';

/** One Main commerce policy, independent of success status, amount and signatures. */
export function assertLiveStripeObject(value: { livemode?: boolean } | null | undefined): void {
  requireLiveCommerce('Stripe payment processing');
  if (value?.livemode !== true) {
    throw Object.assign(new Error('Test-mode or unverified Stripe data cannot fund Main commerce.'), { status: 409 });
  }
}

/** Never print a credential in a configuration error. Restricted live keys are valid. */
export function assertLiveStripeKey(key: string | undefined | null, kind: 'secret' | 'publishable' = 'secret'): void {
  requireLiveCommerce('Stripe checkout');
  const valid = kind === 'publishable' ? /^pk_live_[A-Za-z0-9]+$/ : /^(sk|rk)_live_[A-Za-z0-9]+$/;
  if (!key || !valid.test(key)) {
    throw Object.assign(new Error('Live payments are unavailable. QR Gear payment configuration needs administrator attention.'), { status: 503 });
  }
}
