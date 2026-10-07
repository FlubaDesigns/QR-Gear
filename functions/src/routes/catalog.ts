import type express from 'express';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import { registerCatalogRoutes } from '../services/admin-catalog-routes';

export function register(app: express.Express): void {
  registerCatalogRoutes(app, '/admin', requireAdmin, { db: () => db, now: () => new Date().toISOString() });
}
