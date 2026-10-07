import { useEffect, useRef } from 'react';
import { useBuilderContext } from '../BuilderContext';
import { useToast } from '@/hooks/use-toast';

/** Existing deep links use exactly the same restore path as the Resume picker. */
export function DraftResumeHandler() {
  const { resumeSession } = useBuilderContext();
  const { toast } = useToast();
  const handledRef = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('resume');
    if (!id || handledRef.current) return;
    handledRef.current = true;
    void resumeSession(id).then(() => {
      url.searchParams.delete('resume');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      toast({ title: 'Build resumed' });
    }).catch((error: any) => toast({ title: 'Could not resume build', description: error.message, variant: 'destructive' }));
  }, [resumeSession, toast]);
  return null;
}
