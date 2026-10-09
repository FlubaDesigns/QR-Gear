import type express from 'express';
import { db, admin } from '../core';
import { requireAdmin } from '../middleware';
import { registerCompositionRoutes } from '../services/admin-composition-routes';
export function registerBld(app: express.Express): void {
  registerCompositionRoutes(app, '/admin', requireAdmin, { db: () => db, now: () => admin.firestore.FieldValue.serverTimestamp() }, 'bld');
}
