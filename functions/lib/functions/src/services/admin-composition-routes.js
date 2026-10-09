"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCompositionRoutes = registerCompositionRoutes;
const bldCodes_1 = require("../../../shared/bldCodes");
const bld_store_1 = require("./bld-store");
const assembly_store_1 = require("./assembly-store");
const composition_validation_1 = require("./composition-validation");
const assembly_records_1 = require("./assembly-records");
const serializable = (doc) => ({ ...doc.data(), id: doc.id, createdAt: doc.data().createdAt?.toDate?.().toISOString() ?? doc.data().createdAt ?? null });
function only(body, keys) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new bldCodes_1.BldValidationError('Expected an object.');
    const unknown = Object.keys(body).find(k => !keys.includes(k));
    if (unknown)
        throw new bldCodes_1.BldValidationError(`Field "${unknown}" cannot be changed here.`);
}
async function references(db, tx, kind, id) {
    const field = kind === 'bld' ? 'bldId' : 'assemblyId';
    const paths = kind === 'bld' ? ['assemblies', 'productPackets', 'admin_catalog_instances', 'admin_build_sessions'] : ['productPackets', 'admin_catalog_instances', 'admin_build_sessions'];
    return Promise.all(paths.map(name => tx.get(db.collection(name).where(field, '==', id))));
}
/** One route implementation for Cloud Functions and the development server. */
function registerCompositionRoutes(app, prefix, auth, deps, group = 'all') {
    const route = (fn) => async (req, res) => {
        try {
            await fn(deps.db(), req, res);
        }
        catch (error) {
            res.status(error.status || 400).json({ error: error.message });
        }
    };
    if (group !== 'assemblies') {
        app.get(`${prefix}/bld`, auth, route(async (db, req, res) => {
            const definitions = await (0, bld_store_1.listBldDefinitions)(db, req.query.context, req.query.layout);
            res.json({ success: true, definitions, count: definitions.length });
        }));
        app.post(`${prefix}/bld/create`, auth, route(async (db, req, res) => {
            const definition = await (0, bld_store_1.createBldDefinition)(db, deps.now, { ...req.body, source: 'admin' });
            res.json({ success: true, bldId: definition.bldId, definition });
        }));
        app.post(`${prefix}/bld`, auth, route(async (db, req, res) => {
            if (!req.body.working || typeof req.body.working !== 'object' || Array.isArray(req.body.working))
                throw new bldCodes_1.BldValidationError('working (builder snapshot) is required');
            const definition = await (0, bld_store_1.resolveBuilderBld)(db, deps.now, req.body.working);
            res.json({ success: true, bldId: definition.bldId, instanceCount: definition.instanceCount, buildSequence: definition.buildSequence });
        }));
        app.get(`${prefix}/bld/:bldId`, auth, route(async (db, req, res) => { res.json({ success: true, bld: await (0, bld_store_1.readBldDefinition)(db, req.params.bldId) }); }));
        app.get(`${prefix}/bld/:bldId/instances`, auth, route(async (db, req, res) => {
            const bld = await (0, bld_store_1.readBldDefinition)(db, req.params.bldId);
            res.json({ success: true, bldId: req.params.bldId, instances: bld.instances, count: bld.instances.length });
        }));
        app.patch(`${prefix}/bld/:bldId`, auth, route(async (db, req, res) => {
            only(req.body, ['name', 'instances']);
            await db.runTransaction(async (tx) => {
                const ref = db.collection('bld_definitions').doc(req.params.bldId), doc = await tx.get(ref);
                if (!doc.exists)
                    throw new bldCodes_1.BldValidationError('BLD not found.', 404);
                const updates = { ...req.body, ...(req.body.instances !== undefined ? { instanceCount: req.body.instances?.length } : {}), updatedAt: deps.now() };
                const error = (0, bldCodes_1.validateBldStructure)({ ...doc.data(), ...updates });
                if (error)
                    throw new bldCodes_1.BldValidationError(error);
                if (doc.data().bldId !== doc.id)
                    throw new bldCodes_1.BldValidationError('BLD document identity does not match its stored ID.');
                if (req.body.instances !== undefined && JSON.stringify(req.body.instances) !== JSON.stringify(doc.data().instances)) {
                    const refs = await references(db, tx, 'bld', doc.id);
                    const drafts = await tx.get(db.collection('admin_build_sessions').where('working.metadata.selectedBldId', '==', doc.id));
                    if (refs.some(s => !s.empty) || !drafts.empty)
                        throw new bldCodes_1.BldValidationError('This BLD is in use. Create a new definition for structural edits.', 409);
                }
                tx.update(ref, updates);
            });
            res.json({ success: true, definition: serializable(await db.collection('bld_definitions').doc(req.params.bldId).get()) });
        }));
        app.delete(`${prefix}/bld/:bldId`, auth, route(async (db, req, res) => {
            await db.runTransaction(async (tx) => {
                const ref = db.collection('bld_definitions').doc(req.params.bldId), doc = await tx.get(ref);
                if (!doc.exists)
                    throw new bldCodes_1.BldValidationError('BLD not found.', 404);
                const refs = await references(db, tx, 'bld', doc.id);
                const drafts = await tx.get(db.collection('admin_build_sessions').where('working.metadata.selectedBldId', '==', doc.id));
                if (refs.some(s => !s.empty) || !drafts.empty)
                    throw new bldCodes_1.BldValidationError('This BLD is still used by an Assembly, packet, catalog item, or saved build. Unlink those references before removing it.', 409);
                const slots = await tx.get(ref.collection('instances'));
                for (const slot of slots.docs)
                    tx.delete(slot.ref);
                tx.delete(ref);
            });
            res.json({ success: true, bldId: req.params.bldId });
        }));
    }
    if (group !== 'bld') {
        app.get(`${prefix}/assemblies`, auth, route(async (db, req, res) => {
            const snap = await db.collection('assemblies').orderBy('createdAt', 'desc').limit(200).get();
            const docs = snap.docs.filter((d) => (!req.query.qrgId || d.data().qrgId === req.query.qrgId) && (!req.query.bldId || d.data().bldId === req.query.bldId));
            const assemblies = await Promise.all(docs.map(async (d) => ({ ...serializable(d), ...await (0, composition_validation_1.inspectAssembly)(db, d.id, serializable(d)) })));
            res.json({ success: true, assemblies, count: assemblies.length });
        }));
        app.get(`${prefix}/assemblies/:assemblyId`, auth, route(async (db, req, res) => {
            const doc = await db.collection('assemblies').doc(req.params.assemblyId).get();
            if (!doc.exists)
                throw new bldCodes_1.BldValidationError('Assembly not found.', 404);
            res.json({ success: true, assembly: { ...serializable(doc), ...await (0, composition_validation_1.inspectAssembly)(db, doc.id, serializable(doc)) } });
        }));
        app.post(`${prefix}/assemblies`, auth, route(async (db, req, res) => {
            only(req.body, ['qrgId', 'bldId', 'name', 'mappings']);
            const definition = await db.runTransaction(async (tx) => {
                await (0, assembly_store_1.validateComposition)((0, composition_validation_1.transactionReader)(db, tx), req.body);
                const plan = await (0, assembly_records_1.prepareAssemblyDefinition)(db, tx, deps.now, { ...req.body, createdBy: req.user?.uid });
                plan.write();
                return plan.definition;
            });
            res.status(201).json({ success: true, assemblyId: definition.assemblyId, sequence: definition.sequence, mappingCount: definition.mappings.length });
        }));
        app.patch(`${prefix}/assemblies/:assemblyId`, auth, route(async (db, req, res) => {
            only(req.body, ['qrgId', 'bldId', 'name', 'mappings']);
            await db.runTransaction(async (tx) => {
                const ref = db.collection('assemblies').doc(req.params.assemblyId), doc = await tx.get(ref);
                if (!doc.exists)
                    throw new bldCodes_1.BldValidationError('Assembly not found.', 404);
                const refs = await references(db, tx, 'assembly', doc.id);
                const contentChange = ['qrgId', 'bldId', 'mappings'].some(k => k in req.body && JSON.stringify(req.body[k]) !== JSON.stringify(doc.data()[k]));
                if (contentChange && ((doc.data().packetIds || []).length || refs.some(s => !s.empty)))
                    throw new bldCodes_1.BldValidationError('This Assembly is in use. Rebuild the product to change its structure or content.', 409);
                if (req.body.name !== undefined && typeof req.body.name !== 'string')
                    throw new bldCodes_1.BldValidationError('Name must be text.');
                await (0, assembly_store_1.validateComposition)((0, composition_validation_1.transactionReader)(db, tx), { ...doc.data(), ...req.body });
                tx.update(ref, { ...req.body, updatedAt: deps.now() });
            });
            res.json({ success: true, assembly: serializable(await db.collection('assemblies').doc(req.params.assemblyId).get()) });
        }));
        app.delete(`${prefix}/assemblies/:assemblyId`, auth, route(async (db, req, res) => {
            await db.runTransaction(async (tx) => {
                const ref = db.collection('assemblies').doc(req.params.assemblyId), doc = await tx.get(ref);
                if (!doc.exists)
                    throw new bldCodes_1.BldValidationError('Assembly not found.', 404);
                const refs = await references(db, tx, 'assembly', doc.id);
                if ((doc.data().packetIds || []).length || refs.some(s => !s.empty))
                    throw new bldCodes_1.BldValidationError('This Assembly is still linked to a packet or saved build. Unlink those references first.', 409);
                tx.delete(ref);
            });
            res.json({ success: true, assemblyId: req.params.assemblyId });
        }));
    }
}
//# sourceMappingURL=admin-composition-routes.js.map