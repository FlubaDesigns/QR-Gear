import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { adminFetch } from '@/lib/adminFetch';
import { brainAttestation } from '@/lib/flubaBrainClient';
import { AI_PRODUCT_FIELDS, aiProductContext, aiProductValues, type AiProductField, type AiProductRequest } from '@shared/aiProductBuilder';
import { buildWorkingSnapshot } from '@shared/builderSnapshot';
import { useBuilderContext } from '../BuilderContext';

export function AiProductBuilder() {
  const builder = useBuilderContext();
  const { state, busy, saveWorking, beginBuildActivity, applyAiProposal } = builder;
  const [prompt, setPrompt] = useState('');
  const [ai, setAi] = useState<AiProductRequest | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [applied, setApplied] = useState(false);
  const mounted = useRef(true);
  const sessionId = state.activeSessionId;
  const path = `/build-sessions/${sessionId}/ai`;
  const snapshot = buildWorkingSnapshot(state, builder);
  const values = aiProductValues(snapshot);
  const editable = !!sessionId && ['working', 'artifact_ready'].includes(state.sessionStatus || '');
  const stale = !!ai && ai.base !== aiProductContext(snapshot);
  const pending = ai?.status === 'pending' || ai?.status === 'submitting';
  const load = async () => {
    if (!sessionId) return;
    setLoading(true); setError('');
    try {
      const data = await adminFetch<{ ai: AiProductRequest | null }>(path);
      if (mounted.current) { setAi(data.ai); setLoaded(true); }
    } catch (e: any) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [sessionId]);
  const request = async (action: 'submit' | 'retry' | 'check') => {
    let finish: (() => void) | undefined;
    try {
      finish = beginBuildActivity(action === 'check' ? 'Checking AI suggestion…' : 'Sending product idea…');
      setLoading(true); setError('');
      // Fetch attestation before writing a pending request; failure remains actionable.
      const headers = await brainAttestation(action !== 'check');
      if (action === 'submit') await saveWorking();
      const data = await adminFetch<{ ai: AiProductRequest }>(action === 'check' ? `${path}/check` : path, {
        method: 'POST', headers, json: action === 'check' ? {} : action === 'retry' ? { retry: true } : { prompt },
      });
      if (mounted.current) { setAi(data.ai); setApplied(false); if (action === 'submit') setPrompt(''); }
    } catch (e: any) {
      if (mounted.current) {
        setError(e.message);
        // A timed-out submission may already exist. Recover its retry identity.
        try { const data = await adminFetch<{ ai: AiProductRequest | null }>(path); if (mounted.current) setAi(data.ai); } catch { /* Keep the original error and manual reload. */ }
      }
    } finally { finish?.(); if (mounted.current) setLoading(false); }
  };
  return <section className="rounded-xl border p-4 my-4 space-y-4" aria-label="AI product assistant">
    <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5" /> Build with AI</h2>
    {!editable && <p className="text-sm">Select a product below or resume an editable draft to start.</p>}
    {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
    {sessionId && !loaded && <Button className="min-h-12" variant="outline" disabled={loading} onClick={() => void load()}>Reload AI request</Button>}
    {ai && <div className="space-y-3" aria-live="polite">
      <p className="text-sm whitespace-pre-wrap"><strong>Your idea:</strong> {ai.prompt}</p>
      {ai.status === 'submitting' && <><p className="text-sm">Submission was interrupted. Retry keeps the same request identity.</p><Button className="min-h-12" disabled={!!busy || loading || !editable} onClick={() => void request('retry')}>Retry request</Button></>}
      {ai.status === 'pending' && <><p className="text-sm">Brain is working on your idea. You can leave and resume this draft.</p><Button className="min-h-12" disabled={!!busy || loading} onClick={() => void request('check')}>Check suggestion</Button></>}
      {ai.status === 'failed' && <p role="alert" className="text-sm text-destructive">{ai.error}</p>}
      {ai.proposal && <>
        <p className="text-sm whitespace-pre-wrap">{ai.proposal.message}</p>
        <div className="space-y-3">{Object.entries(ai.proposal.changes).map(([field, value]) => <div key={field} className="rounded-lg bg-muted p-3 text-sm break-words">
          <strong>{AI_PRODUCT_FIELDS[field as AiProductField].label}</strong>
          <p className="mt-1 text-muted-foreground whitespace-pre-wrap">Current: {values[field as AiProductField] || '(empty)'}</p>
          <p className="mt-1 whitespace-pre-wrap">Suggested: {value || '(empty)'}</p>
        </div>)}</div>
        {Object.keys(ai.proposal.changes).length > 0 && <Button className="min-h-12 w-full" disabled={!editable || !!busy || loading || stale || applied} onClick={() => {
          try { applyAiProposal(ai.proposal!, ai.base); setApplied(true); setError(''); } catch (e: any) { setError(e.message); }
        }}>{applied ? 'Applied to your draft' : 'Apply suggestion to draft'}</Button>}
        {stale && !applied && <p className="text-sm">Your build has changed. Ask again to get a suggestion for its current values.</p>}
        {applied && <p className="text-sm">Changes are in your build below. Review the preview, then Save or Generate.</p>}
      </>}
    </div>}
    <label className="block text-sm font-medium" htmlFor="ai-product-prompt">What would you like to create or change?</label>
    <Textarea id="ai-product-prompt" rows={4} maxLength={4000} value={prompt} disabled={!editable || loading || !!pending} onChange={event => setPrompt(event.target.value)} placeholder="A shirt for our summer event. Suggest a title, description, and short graphic text." />
    <Button className="min-h-12 w-full" disabled={!editable || !loaded || !prompt.trim() || !!busy || loading || !!pending} onClick={() => void request('submit')}>Ask AI</Button>
  </section>;
}
