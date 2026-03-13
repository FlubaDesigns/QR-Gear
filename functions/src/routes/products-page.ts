import express from 'express';
import { register as registerPricingPackets } from './pp-pricing-packets';
import { register as registerCatalog } from './pp-catalog';
import { register as registerBuilder } from './pp-builder';

export function register(app: express.Express): void {
  registerPricingPackets(app);
  registerCatalog(app);
  registerBuilder(app);
}
