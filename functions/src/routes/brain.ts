import { readBuildRules, saveBuildRules } from '../services/ai-build-rules';
import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import { ADMIN_BUILD_SESSIONS_COLLECTION } from '../constants';
import { brainRequest } from '../services/brain-client';
import { aiProductContext, aiProductPrompt, validateAiProductProposal, type AiProductRequest } from '../../../shared/aiProductBuilder';

export function register(app: Express): void {
  app.get('/admin/ai-build-rules',requireAdmin,async(_req:Request,res:Response)=>{
    try{res.json(await readBuildRules(db));}catch(e:any){res.status(e.status||500).json({error:e.message});}
  });
  app.put('/admin/ai-build-rules',requireAdmin,async(req:Request,res:Response)=>{
    try{res.json(await saveBuildRules(db,req.body,(req as any).user.uid));}catch(e:any){res.status(e.status||500).json({error:e.message});}
  });
  const path = '/admin/build-sessions/:id/ai';
  app.get(path, requireAdmin, async (req: Request, res: Response) => {
    try {
      const snap = await db.collection(ADMIN_BUILD_SESSIONS_COLLECTION).doc(req.params.id).get();
      if (!snap.exists) { res.status(404).json({ error: 'Build session not found' }); return; }
      res.json({ ai: snap.data()!.ai ?? null });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  app.post(path, requireAdmin, async (req: Request, res: Response) => {
    try {
      const ref = db.collection(ADMIN_BUILD_SESSIONS_COLLECTION).doc(req.params.id);
      const { prompt, retry } = req.body;
      if (!retry && (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000)) { res.status(400).json({ error: 'Describe your product in 1–4000 characters.' }); return; }
      const rulebook=await readBuildRules(db);
      const ai = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('Build session not found.');
        const session = snap.data()!;
        if (!['working', 'artifact_ready'].includes(session.status)) throw new Error('Open an editable product draft first.');
        if (retry) {
          if (!session.ai || session.ai.status !== 'submitting') throw new Error('There is no interrupted request to retry.');
          return session.ai as AiProductRequest;
        }
        if (session.ai && ['submitting', 'pending'].includes(session.ai.status)) throw new Error('Check or retry the existing AI request first.');
        const next: AiProductRequest = { idempotencyKey: crypto.randomUUID(), prompt: prompt.trim(), status: 'submitting',
          base: aiProductContext(session.working), brainPrompt: aiProductPrompt(prompt.trim(), session.working, session.ai?.proposal, rulebook.rules) };
        tx.update(ref, { ai: next });
        return next;
      });
      const result = await brainRequest(String(req.headers['x-firebase-appcheck'] || ''), { prompt: ai.brainPrompt, idempotencyKey: ai.idempotencyKey });
      if (typeof result.requestId !== 'string' || !result.requestId) throw new Error('Brain did not return a request identity. Retry this request.');
      const next = { ...ai, requestId: result.requestId, status: 'pending' as const };
      await ref.update({ ai: next });
      res.status(202).json({ ai: next });
    } catch (error: any) { res.status(400).json({ error: error.message }); }
  });
  app.post(`${path}/check`, requireAdmin, async (req: Request, res: Response) => {
    try {
      const ref = db.collection(ADMIN_BUILD_SESSIONS_COLLECTION).doc(req.params.id);
      const snap = await ref.get();
      const ai = snap.data()?.ai as AiProductRequest | undefined;
      if (!ai?.requestId) { res.status(400).json({ error: 'No accepted AI request to check.' }); return; }
      if (ai.status !== 'pending') { res.json({ ai }); return; }
      const result = await brainRequest(String(req.headers['x-firebase-appcheck'] || ''), { requestId: ai.requestId });
      if (result.requestId !== ai.requestId) throw new Error('Brain response identity mismatch.');
      let next = ai;
      if (['failed', 'error', 'blocked'].includes(result.status)) next = { ...ai, status: 'failed', error: String(result.error || 'Brain could not complete this request.').slice(0, 1000) };
      else if (['completed', 'complete', 'done', 'success'].includes(result.status)) {
        try { next = { ...ai, status: 'ready', proposal: validateAiProductProposal(result.response ?? result.result) }; }
        catch (error: any) { next = { ...ai, status: 'failed', error: error.message }; }
      }
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data()?.ai;
        if (current?.idempotencyKey === ai.idempotencyKey && current.status === 'pending') tx.update(ref, { ai: next });
      });
      res.json({ ai: next });
    } catch (error: any) { res.status(502).json({ error: error.message }); }
  });
}
