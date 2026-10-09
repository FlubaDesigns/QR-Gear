import type { Request, Response, RequestHandler } from 'express';
import { IMAGE_LIBRARY_MAX_BYTES, ImageLibraryError } from '../../../shared/imageLibrary';
import type { createAdminImageLibrary } from './admin-image-library';

const MAX_MULTIPART_BYTES = IMAGE_LIBRARY_MAX_BYTES + 64 * 1024;
export async function parseImageUpload(req: Request) {
  const contentType = req.headers['content-type'] || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new ImageLibraryError('Expected multipart/form-data');
  let rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_MULTIPART_BYTES) throw new ImageLibraryError('Image upload exceeds the size limit');
      chunks.push(bytes);
    }
    rawBody = Buffer.concat(chunks);
  }
  if (rawBody.length > MAX_MULTIPART_BYTES) throw new ImageLibraryError('Image upload exceeds the size limit');
  let form: FormData;
  try { form = await new globalThis.Response(new Uint8Array(rawBody), { headers: { 'Content-Type': contentType } }).formData(); }
  catch { throw new ImageLibraryError('Invalid multipart image upload'); }
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new ImageLibraryError('Choose an image file');
  return { bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type,
    name: String(form.get('name') || file.name), folder: String(form.get('folder') || 'general') };
}
// Both Express adapters expose this route-registration surface (their type versions differ).
type RegisterRoute = (path: string, ...handlers: any[]) => unknown;
interface ImageRoutesApp { get: RegisterRoute; post: RegisterRoute; patch: RegisterRoute; delete: RegisterRoute }
export function registerAdminImageRoutes(app: ImageRoutesApp, prefix: string, requireAdmin: (...args: any[]) => unknown, library: ReturnType<typeof createAdminImageLibrary>) {
  const route = (handler: (req: Request, res: Response) => Promise<void>): RequestHandler => async (req, res) => {
    try { await handler(req, res); } catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
  };
  app.get(`${prefix}/images`, requireAdmin, route(async (req, res) => { res.json(await library.list(typeof req.query.folder === 'string' ? req.query.folder : undefined)); }));
  app.get(`${prefix}/images/folders`, requireAdmin, route(async (_req, res) => { res.json(await library.listFolders()); }));
  app.post(`${prefix}/images/folders`, requireAdmin, route(async (req, res) => {
    if (typeof req.body.name !== 'string') throw new ImageLibraryError('Folder name is required');
    res.json({ ok: true, ...await library.createFolder(req.body.name) });
  }));
  app.post(`${prefix}/images`, requireAdmin, route(async (req, res) => { res.json(await library.upload(await parseImageUpload(req))); }));
  app.patch(`${prefix}/images/:id`, requireAdmin, route(async (req, res) => { await library.update(req.params.id, req.body); res.json({ success: true }); }));
  app.delete(`${prefix}/images/:id`, requireAdmin, route(async (req, res) => { await library.archive(req.params.id); res.json({ success: true }); }));
  app.get(`${prefix}/images/:id/file`, requireAdmin, route(async (req, res) => {
    const asset = await library.getFile(req.params.id);
    if (!asset) { res.status(404).json({ error: 'Image not found' }); return; }
    res.set('Content-Type', asset.mimeType);
    res.set('Cache-Control', 'private, max-age=86400');
    const stream = asset.file.createReadStream();
    stream.on('error', () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
    stream.pipe(res);
  }));
}
