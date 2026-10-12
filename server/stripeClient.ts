import Stripe from 'stripe';

import {readFlubaProviderKey} from './fluba-provider-keys';
async function getCredentials() {
 const secretKey=await readFlubaProviderKey('STRIPE_SECRET_KEY');
 if(!secretKey)throw Error('Stripe is not configured in Fluba.');
 return {secretKey,publishableKey:process.env.STRIPE_PUBLISHABLE_KEY||process.env.VITE_STRIPE_PUBLISHABLE_KEY||''};
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();

  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
