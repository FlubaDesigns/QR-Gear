/** Current handoff wins; an invalid handoff never revives an older stored intent. */
export function safeLoginReturn(value: string | null): string {
 if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/';
 try {
  const decoded = decodeURIComponent(value);
  if (decoded.startsWith('//') || /[\\\x00-\x1f]/.test(decoded)) return '/';
  const url = new URL(value, 'https://return.invalid');
  if (url.origin !== 'https://return.invalid' || /^\/(?:login|api)(?:\/|$)/.test(url.pathname)) return '/';
  return url.pathname + url.search + url.hash;
 } catch { return '/'; }
}
export function loginReturnPath(search: string, stored: string | null): string {
 const params = new URLSearchParams(search);
 return safeLoginReturn(params.has('redirect') ? params.get('redirect') : stored);
}
