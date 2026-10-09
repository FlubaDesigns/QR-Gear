/** Canonical lifecycle endpoints and their owned record types. */
export const BUILD_TARGETS = {
  graphics: 'grf_assets',
  packets: 'productPackets',
  'catalog-instances': 'admin_catalog_instances',
} as const;
export type BuildTarget = { kind: keyof typeof BUILD_TARGETS; id: string };
