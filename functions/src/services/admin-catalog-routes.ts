import { CATALOG_OVERLAY_FIELDS, CATALOG_SECTIONS, catalogOverlays } from '../../../shared/catalogs';
import { isValidMasterCatalogDocId } from '../../../shared/qrgCodes';
import { updateCatalogImageSelection } from '../../../shared/productImages';

class CatalogError extends Error {
  constructor(message: string, public status = 400, public failedBlankId?: string) { super(message); }
}
function key(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) throw new CatalogError('A valid record ID is required.');
  return value;
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !v)) throw new CatalogError('blankIds must be an array of IDs.');
  return Array.from(new Set<string>(value));
}
function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new CatalogError('Catalog name is required.');
  return value.trim();
}
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new CatalogError('Text must be a string.');
  return value.trim();
}
function tier(value: unknown) {
  if (value !== null && !['good', 'better', 'best'].includes(value as string)) throw new CatalogError('Tier must be good, better, best, or null.');
  return value;
}

/** One HTTP implementation and one transaction boundary for both server adapters. */
export function registerCatalogRoutes(app: any, prefix: string, auth: any, deps: { db: () => any; now: () => string }) {
  const route = (fn: any) => async (req: any, res: any) => {
    try { await fn(deps.db(), req, res); }
    catch (error: any) {
      console.error('[Catalogs]', error.message);
      res.status(error.status || 500).json({ error: error.message, ...(error.failedBlankId ? { failedBlankId: error.failedBlankId } : {}) });
    }
  };
  const catalogRef = (db: any, id: unknown) => db.collection('catalogs').doc(key(id));
  const readCatalog = async (db: any, tx: any, id: unknown) => {
    const ref = catalogRef(db, id), doc = await tx.get(ref);
    if (!doc.exists) throw new CatalogError('Catalog not found.', 404);
    return { ref, data: doc.data() };
  };
  const requireBlank = async (db: any, tx: any, id: string) => {
    if (!isValidMasterCatalogDocId(id)) throw new CatalogError('Choose a classified QRG blank before adding or editing it.', 400, id);
    const doc = await tx.get(db.collection('master_catalog').doc(id));
    const data = doc.data();
    if (!doc.exists || data.isActive === false || data.status === 'archived') throw new CatalogError('Blank is missing or archived. Remove its catalog reference or choose an active blank.', 400, id);
    if (data.qrgBlankId != null && data.qrgBlankId !== id.slice(4)) throw new CatalogError('Blank identity disagrees with its QRG record.', 400, id);
  };
  const add = async (db: any, targetId: string, blankIds: string[], sourceId?: string) => db.runTransaction(async (tx: any) => {
    const target = await readCatalog(db, tx, targetId);
    const source = sourceId ? await readCatalog(db, tx, sourceId) : null;
    for (const id of blankIds) {
      if (source && !source.data.blankIds?.includes(id)) throw new CatalogError('Blank is not in the selected source catalog.', 400, id);
      await requireBlank(db, tx, id);
    }
    const existing: string[] = target.data.blankIds || [];
    const merged = Array.from(new Set([...existing, ...blankIds]));
    const overlays = catalogOverlays(target.data, merged);
    if (source) for (const field of CATALOG_OVERLAY_FIELDS) {
      for (const id of blankIds) if (!(id in overlays[field]) && Object.prototype.hasOwnProperty.call(source.data[field] || {}, id)) overlays[field][id] = source.data[field][id];
    }
    tx.update(target.ref, { blankIds: merged, ...overlays, updatedAt: deps.now() });
    return { success: true, added: merged.length - existing.length, total: merged.length };
  });

  app.get(`${prefix}/catalogs`, auth, route(async (db: any, _req: any, res: any) => {
    const snap = await db.collection('catalogs').get();
    res.json({ catalogs: snap.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))) });
  }));
  app.post(`${prefix}/catalogs`, auth, route(async (db: any, req: any, res: any) => {
    const data = { name: name(req.body.name), description: text(req.body.description), blankIds: [], ...catalogOverlays({}, []), tierConfig: {}, createdAt: deps.now(), updatedAt: deps.now() };
    const ref = db.collection('catalogs').doc();
    await ref.create(data); res.status(201).json({ ...data, id: ref.id });
  }));
  app.patch(`${prefix}/catalogs/:catalogId`, auth, route(async (db: any, req: any, res: any) => {
    if (Object.keys(req.body).some(k => !['name', 'description'].includes(k))) throw new CatalogError('Use the catalog blank controls to change membership.');
    await db.runTransaction(async (tx: any) => {
      const { ref } = await readCatalog(db, tx, req.params.catalogId);
      const update: any = { updatedAt: deps.now() };
      if (req.body.name !== undefined) update.name = name(req.body.name);
      if (req.body.description !== undefined) update.description = text(req.body.description);
      tx.update(ref, update);
    });
    res.json({ success: true });
  }));
  app.delete(`${prefix}/catalogs/:catalogId`, auth, route(async (db: any, req: any, res: any) => {
    await db.runTransaction(async (tx: any) => {
      const { ref } = await readCatalog(db, tx, req.params.catalogId);
      const settings = db.collection('systemSettings');
      const assignments = (await tx.get(settings.doc('catalog-assignments'))).data() || {};
      const defaults = (await tx.get(settings.doc('catalog-defaults'))).data() || {};
      const used = CATALOG_SECTIONS.find(section => assignments[section] === ref.id);
      if (used) throw new CatalogError(`Catalog is assigned to ${used}. Unassign it first.`, 409);
      tx.delete(ref);
      if (defaults.defaultCatalogId === ref.id) tx.set(settings.doc('catalog-defaults'), { defaultCatalogId: null, updatedAt: deps.now() }, { merge: true });
    });
    res.json({ success: true });
  }));
  app.post(`${prefix}/catalogs/:catalogId/blanks`, auth, route(async (db: any, req: any, res: any) => {
    res.json(await add(db, req.params.catalogId, ids(req.body.blankIds), req.body.sourceCatalogId ? key(req.body.sourceCatalogId) : undefined));
  }));
  app.delete(`${prefix}/catalogs/:catalogId/blanks`, auth, route(async (db: any, req: any, res: any) => {
    const remove = new Set(ids(req.body.blankIds));
    const result = await db.runTransaction(async (tx: any) => {
      const { ref, data } = await readCatalog(db, tx, req.params.catalogId);
      // Removal acts on existing membership, even if the master blank no longer exists.
      const remaining = (data.blankIds || []).filter((id: string) => !remove.has(id));
      tx.update(ref, { blankIds: remaining, ...catalogOverlays(data, remaining), updatedAt: deps.now() });
      return { success: true, removed: (data.blankIds || []).length - remaining.length, total: remaining.length };
    });
    res.json(result);
  }));
  app.post(`${prefix}/catalogs/:catalogId/bulk-copy`, auth, route(async (db: any, req: any, res: any) => {
    res.json(await add(db, key(req.body.targetCatalogId), ids(req.body.blankIds), req.params.catalogId));
  }));
  app.post(`${prefix}/catalogs/:catalogId/duplicate`, auth, route(async (db: any, req: any, res: any) => {
    const ref = db.collection('catalogs').doc();
    const copy = await db.runTransaction(async (tx: any) => {
      const { data } = await readCatalog(db, tx, req.params.catalogId);
      const blankIds = ids(data.blankIds || []);
      for (const id of blankIds) await requireBlank(db, tx, id);
      const copy = { name: req.body?.name === undefined ? `${data.name} (Copy)` : name(req.body.name), description: data.description || '', blankIds,
        ...catalogOverlays(data, blankIds), tierConfig: data.tierConfig || {}, createdAt: deps.now(), updatedAt: deps.now() };
      tx.create(ref, copy); return copy;
    });
    res.status(201).json({ ...copy, id: ref.id });
  }));

  const fields = { 'blank-title': ['blankTitles', 'title'], 'blank-description': ['blankDescriptions', 'description'],
    'blank-tier': ['blankTiers', 'tier'], 'blank-colors': ['blankColors', 'colors'], 'blank-images': ['blankImages', 'images'] } as const;
  for (const [endpoint, [field, param]] of Object.entries(fields)) {
    app.put(`${prefix}/catalogs/:catalogId/${endpoint}`, auth, route(async (db: any, req: any, res: any) => {
      const id = key(req.body.blankId);
      const result = await db.runTransaction(async (tx: any) => {
        const { ref, data } = await readCatalog(db, tx, req.params.catalogId);
        if (!data.blankIds?.includes(id)) throw new CatalogError('Add this blank to the catalog before editing it.', 409, id);
        await requireBlank(db, tx, id);
        let value = req.body[param];
        if (field === 'blankTitles' || field === 'blankDescriptions') value = text(value);
        if (field === 'blankTiers') value = tier(value);
        if (field === 'blankColors') {
          if (!Array.isArray(value) || value.some(c => !c || typeof c.name !== 'string' || !c.name.trim() || typeof c.hex !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.hex))) throw new CatalogError('Colors require a name and valid hex value.');
        }
        if (field === 'blankImages' && (!Array.isArray(value) || value.some(url => typeof url !== 'string' || !/^https:\/\//.test(url)))) throw new CatalogError('Images must be HTTPS URLs.');
        const overlays = catalogOverlays(data, data.blankIds);
        const map = { ...overlays[field] };
        if (field === 'blankImages') overlays[field] = updateCatalogImageSelection(map, id, value, req.body.restore === true);
        else if (value === '' || value === null) { delete map[id]; overlays[field] = map; }
        else { map[id] = value; overlays[field] = map; }
        tx.update(ref, { ...overlays, updatedAt: deps.now() });
        return { success: true, blankId: id, [field]: overlays[field] };
      });
      res.json(result);
    }));
  }
  for (const endpoint of ['tiers', 'tier-config']) {
    app.put(`${prefix}/catalogs/:catalogId/${endpoint}`, auth, route(async (db: any, req: any, res: any) => {
      await db.runTransaction(async (tx: any) => {
        const { ref, data } = await readCatalog(db, tx, req.params.catalogId);
        const update: any = { updatedAt: deps.now() };
        if (req.body.blankTiers !== undefined) {
          if (endpoint !== 'tiers' || !req.body.blankTiers || typeof req.body.blankTiers !== 'object' || Array.isArray(req.body.blankTiers)) throw new CatalogError('Invalid tier assignments.');
          update.blankTiers = {};
          for (const [id, value] of Object.entries(req.body.blankTiers)) {
            if (!data.blankIds?.includes(id)) throw new CatalogError('Tier blank is not a catalog member.', 400, id);
            await requireBlank(db, tx, id); if (tier(value) !== null) update.blankTiers[id] = value;
          }
        }
        if (req.body.tierConfig !== undefined) {
          const config = req.body.tierConfig;
          if (!config || typeof config !== 'object' || Array.isArray(config)) throw new CatalogError('Invalid tier configuration.');
          for (const [level, settings] of Object.entries(config)) {
            tier(level);
            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new CatalogError('Invalid tier configuration.');
            for (const [field, value] of Object.entries(settings)) if (!['displayName','description','tagline'].includes(field) || typeof value !== 'string') throw new CatalogError('Invalid tier configuration field.');
          }
          update.tierConfig = config;
        }
        tx.update(ref, update);
      });
      res.json({ success: true });
    }));
  }
  for (const setting of ['catalog-defaults', 'catalog-assignments']) {
    const fields = setting === 'catalog-defaults' ? ['defaultCatalogId'] : [...CATALOG_SECTIONS];
    app.get(`${prefix}/${setting}`, auth, route(async (db: any, _req: any, res: any) => {
      const data = (await db.collection('systemSettings').doc(setting).get()).data() || {};
      res.json(Object.fromEntries(fields.map(field => [field, data[field] || null])));
    }));
    app.put(`${prefix}/${setting}`, auth, route(async (db: any, req: any, res: any) => {
      if (Object.keys(req.body).some(field => !fields.includes(field))) throw new CatalogError('Unknown catalog setting.');
      await db.runTransaction(async (tx: any) => {
        const update: any = { updatedAt: deps.now() };
        for (const field of fields) if (req.body[field] !== undefined) {
          const value = req.body[field];
          if (value !== null) await readCatalog(db, tx, value);
          update[field] = value;
        }
        tx.set(db.collection('systemSettings').doc(setting), update, { merge: true });
      });
      res.json({ success: true });
    }));
  }
}
