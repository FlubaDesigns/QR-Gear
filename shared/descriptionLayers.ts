export interface DescriptionLayers {
  providerDescription?: string | null;
  adminCatalogDescription?: string | null;
  memberPacketDescription?: string | null;
  effectiveDescription?: string | null;
}

export function resolveDescription(layers: DescriptionLayers): string {
  if (layers.memberPacketDescription) return layers.memberPacketDescription;
  if (layers.adminCatalogDescription) return layers.adminCatalogDescription;
  if (layers.providerDescription) return layers.providerDescription;
  return '';
}

export function resolvePublicDescription(layers: Pick<DescriptionLayers, 'adminCatalogDescription' | 'providerDescription'>): string {
  if (layers.adminCatalogDescription) return layers.adminCatalogDescription;
  if (layers.providerDescription) return layers.providerDescription;
  return '';
}

export function buildDescriptionSnapshot(layers: DescriptionLayers): DescriptionLayers {
  return {
    providerDescription: layers.providerDescription || null,
    adminCatalogDescription: layers.adminCatalogDescription || null,
    memberPacketDescription: layers.memberPacketDescription || null,
    effectiveDescription: resolveDescription(layers),
  };
}
