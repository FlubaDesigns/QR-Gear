import type express from 'express';
import { registerMarketplaceOAuth } from '../services/marketplace-oauth';

export function register(app: express.Express): void {
  registerMarketplaceOAuth(app, 'amazon');
}
