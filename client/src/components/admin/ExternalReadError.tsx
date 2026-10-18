import { Button } from '@/components/ui/button';
export function ExternalReadError({ retry }: { retry: () => void }) {
 return <div role="alert" className="rounded border border-destructive p-4 space-y-2"><p>This report could not be loaded. Its totals and records are unavailable.</p><Button onClick={retry}>Retry</Button></div>;
}
