import { Request, Response } from 'express';
import { requireAdmin } from '../middleware';
import { registerSourceCrop } from '../services/grf-registrar';
import { LibraryImageError } from '../services/grf-store';

export function registerAdminLibraryCrop(app: any): void {
  app.post('/admin/library/crop-mint', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try { res.json(await registerSourceCrop(req.body)); }
    catch (error: any) { res.status(error instanceof LibraryImageError ? error.status : 500).json({ error: error.message }); }
  });
}
