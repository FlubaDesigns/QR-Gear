import { decodeVideoUpload } from './video-validation';
import { createGrfRegistrar } from './grf-store';
import { createBuildDeletion } from './build-deletion';
import { BUILD_TARGETS } from '../../../shared/buildLifecycle';
import { decodeLibraryImage } from './image-validation';
import { inspectGrfAsset } from '../../../shared/GRF_engine';

/** Both HTTP adapters use these same GRF reads, writes and deletion rules. */
export function registerGrfRoutes(app: any, prefix: string, auth: any, deps: { db: () => any; bucket: () => any; now: () => any }) {
  const route = (handler: any) => async (req: any, res: any) => {
    try { await handler(req, res); }
    catch (error: any) { res.status(error.status || 400).json({ error: error.message }); }
  };
  const deletion = () => createBuildDeletion({ ...deps, db: deps.db() });
  app.get(`${prefix}/graphics`, auth, route(async (req: any, res: any) => {
    const snapshot = await deps.db().collection('grf_assets').where('isActive', '==', true).get();
    const assets = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id,
      validationErrors: inspectGrfAsset(doc.data()), createdAt: doc.data().createdAt?.toDate?.().toISOString() ?? doc.data().createdAt ?? null }));
    res.json(assets.filter((asset: any) => ['assetClass','mediaType','channel','purpose','format'].every(key => !req.query[key] || asset[key] === req.query[key]))
      .sort((a: any,b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
  }));
  app.post(`${prefix}/graphics/save-grf`, auth, route(async (req: any, res: any) => {
    const { imageUrl, ...input } = req.body;
    if (typeof imageUrl !== 'string' || !imageUrl) throw new Error('An image or media URL is required.');
    const registrar = createGrfRegistrar({ ...deps, db: deps.db() });
    const source = imageUrl.startsWith('data:')
      ? input.mediaType === '1' ? decodeLibraryImage(imageUrl, input.mimeType) : input.mediaType === '2' ? decodeVideoUpload(imageUrl, input.mimeType) : { imageData: imageUrl.replace(/^data:[^;]+;base64,/, '') }
      : { sourceUrl: imageUrl };
    const result = await registrar.registerGrfAsset({ ...input, ...source });
    const doc = await deps.db().collection('grf_assets').doc(result.grfId).get();
    res.json({ success: true, grfId: result.grfId, asset: { ...doc.data(), id: doc.id } });
  }));
  app.get(`${prefix}/graphics/deletions/pending`, auth, route(async (_req: any, res: any) => res.json(await deletion().pending())));
  app.post(`${prefix}/graphics/deletions/:operationId/retry`, auth, route(async (req: any, res: any) => res.json(await deletion().finish(req.params.operationId))));
  for (const kind of Object.keys(BUILD_TARGETS) as (keyof typeof BUILD_TARGETS)[]) {
    app.get(`${prefix}/${kind}/:id/deletion-preview`, auth, route(async (req: any, res: any) => res.json(await deletion().preview({ kind, id: req.params.id }))));
    app.delete(`${prefix}/${kind}/:id`, auth, route(async (req: any, res: any) => res.json(await deletion().remove({ kind, id: req.params.id }, req.body?.token))));
  }
}
