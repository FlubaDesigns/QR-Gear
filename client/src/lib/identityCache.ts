import type { QueryClient } from '@tanstack/react-query';

const identities = new WeakMap<QueryClient, string | null>();
export function resetIdentityCache(client: QueryClient, uid: string | null): void {
  if (identities.has(client) && identities.get(client) === uid) return;
  identities.set(client, uid);
  void client.cancelQueries();
  client.clear();
}

export function privateQueryKey(path: string, uid: string | undefined | null) {
  return [path, { scopeUid: uid ?? null }] as const;
}
