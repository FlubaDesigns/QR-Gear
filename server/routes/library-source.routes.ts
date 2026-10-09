import type { Express } from 'express';
import { isAdmin } from '../firebaseAuth';
import { getGrfRegistrar } from '../lib/schema-commit';
import { LibraryImageError } from '../../functions/src/services/grf-store';

export function registerLibrarySourceRoutes(app: Express): void {
  app.post('/api/admin/library/upload-source', isAdmin, async (req: any, res) => {
    try { res.json(await (await getGrfRegistrar()).registerSourceImage(req.body)); }
    catch (error: any) { res.status(error instanceof LibraryImageError ? error.status : 500).json({ error: error.message }); }
  });
}
