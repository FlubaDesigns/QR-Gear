import { useEffect, useState } from 'react';
import { signInWithAuthorizationEngine } from '@/lib/firebase';

export function AuthorizationEngineSignIn({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [request, setRequest] = useState<{ requestId: string; expiresAtMs: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!request) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (Date.now() >= request.expiresAtMs) throw new Error();
        const response = await fetch(`/api/auth/engine/session/${request.requestId}`, {
          method: 'POST', credentials: 'same-origin', signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        if (response.status === 202) { timer = setTimeout(poll, 3000); return; }
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (typeof result.customToken !== 'string') throw new Error();
        await signInWithAuthorizationEngine(result.customToken);
        if (!abort.signal.aborted) await onSignedIn();
      } catch {
        if (!abort.signal.aborted) {
          setRequest(null);
          setError('Sign-in could not complete. Start a new request.');
          setBusy(false);
        }
      }
    };
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [request]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/engine/session', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error();
      setRequest(await response.json());
    } catch {
      setError('Authorization Engine sign-in is unavailable.');
      setBusy(false);
    }
  };

  return <div className="qr-auth-container"><div className="qr-auth-card">
    <div className="qr-auth-header">
      <h1 className="qr-auth-title">QR Gear admin sign-in</h1>
      <p className="qr-auth-subtitle">Authorize this browser with the Authorization Engine.</p>
    </div>
    {error && <p role="alert" className="qr-auth-error">{error}</p>}
    {request ? <div role="status">
      <p>Waiting for Authorization Engine approval.</p>
      <p>Request ID: <code data-testid="engine-request-id">{request.requestId}</code></p>
      <p>This request expires in 10 minutes. Keep this tab open.</p>
    </div> : <button className="qr-auth-button qr-auth-button-primary" disabled={busy} onClick={start}>
      {busy ? 'Starting…' : 'Request authorized sign-in'}
    </button>}
  </div></div>;
}
