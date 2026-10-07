/** Supported roles for the stores collection, shared by the picker and its writers. */
export const STORE_ROLES = [
  { id: 'internal', name: 'Internal', description: 'Products for QR Gear stores and channels', icon: 'building' },
  { id: 'external', name: 'External', description: 'Products for external stores', icon: 'globe' },
  { id: 'member', name: 'Member', description: 'Member-created personalized products', icon: 'user' },
  { id: 'marketplace', name: 'Marketplace', description: 'Products listed on Etsy, eBay, Amazon', icon: 'shopping-bag' },
] as const;
export type StoreRole = typeof STORE_ROLES[number]['id'];
export function isStoreRole(value: unknown): value is StoreRole {
  return STORE_ROLES.some(role => role.id === value);
}
