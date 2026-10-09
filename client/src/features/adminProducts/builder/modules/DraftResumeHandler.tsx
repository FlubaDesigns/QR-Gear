import { useEffect, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { useBuilderContext } from '../BuilderContext';
import { useToast } from '@/hooks/use-toast';
import { fetchTemplateLibrary } from '@/features/shared/templateLibrary';
import { Button } from '@/components/ui/button';

/** Deep links call the same commands as the Resume and Templates pickers. */
export function DraftResumeHandler() {
  const { resumeSession, startFromTemplate } = useBuilderContext();
  const { toast } = useToast();
  const search = useSearch();
  const handledRef = useRef('');
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const resumeId = url.searchParams.get('resume');
    const templateId = url.searchParams.get('template');
    const key = `${resumeId || templateId || ''}:${retry}`;
    if ((!resumeId && !templateId) || handledRef.current === key) return;
    handledRef.current = key;
    setError(null);
    const load = async () => {
      if (resumeId) await resumeSession(resumeId);
      else {
        const template = (await fetchTemplateLibrary()).find(item => item.id === templateId);
        if (!template) throw new Error('This template is no longer available.');
        await startFromTemplate(template);
      }
      url.searchParams.delete(resumeId ? 'resume' : 'template');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      toast({ title: resumeId ? 'Build resumed' : 'Template loaded', description: resumeId ? undefined : 'A separate draft is ready to edit.' });
    };
    void load().catch((failure: Error) => {
      setError(failure.message);
      toast({ title: 'Could not load build', description: failure.message, variant: 'destructive' });
    });
  }, [search, retry, resumeSession, startFromTemplate, toast]);
  return error ? <div role="alert" className="p-3 border border-destructive rounded-md space-y-2">
    <p>{error}</p><Button className="min-h-[44px]" onClick={() => setRetry(value => value + 1)}>Retry loading</Button>
  </div> : null;
}
