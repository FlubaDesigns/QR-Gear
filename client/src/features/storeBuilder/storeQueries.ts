import type { QueryClient } from '@tanstack/react-query';
/** Refresh the existing consumers in Build and Place after a store change. */
export function refreshStoreViews(client: QueryClient) {
  return Promise.all(['stores', 'channels', 'collections', 'all-channels', 'admin-instances', 'admin-instances-unplaced', '/api/admin/stores', '/api/admin/partner-stores', '/api/members/allowed-products'].map(key => client.invalidateQueries({ queryKey: [key] })));
}
