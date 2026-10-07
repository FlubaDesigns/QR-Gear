import { Request, Response } from 'express';
import { requireAdmin } from '../middleware';
import { registerSourceImage } from '../services/grf-registrar';
import { LibraryImageError } from '../services/grf-store';

export function registerAdminLibrarySource(app: any): void {
  app.post('/admin/library/upload-source', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try { res.json(await registerSourceImage(req.body)); }
    catch (error: any) { res.status(error instanceof LibraryImageError ? error.status : 500).json({ error: error.message }); }
  });
}
