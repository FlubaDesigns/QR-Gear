/** Shared display ordering; never writes generated images into the catalog snapshot. */
export function imageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return Array.from(new Set(images.map(image => typeof image === 'string' ? image : image?.url)
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0).map(url => url.trim())));
}

export function resolveProductImages(layers: { mockups?: unknown; proofs?: unknown }): string[] {
  return imageUrls([...imageUrls(layers.mockups), ...imageUrls(layers.proofs)]);
}

/** An empty selection is intentional. Only a missing override inherits the originals. */
export function resolveCatalogImages(originals: unknown, selected?: unknown): string[] {
  return imageUrls(Array.isArray(selected) ? selected : originals);
}

export function masterBlankImages(blank: Record<string, any>): string[] {
  return imageUrls([
    ...imageUrls(blank.printifyImages), ...imageUrls(blank.printfulImages), ...imageUrls(blank.images),
    blank.imageUrl || blank.image_url || blank.thumbnailUrl || blank.thumbnail || blank.image,
  ]);
}

/** The base snapshot is the product's saved catalog selection, not its generated gallery. */
export function instanceCatalogImages(instance: Record<string, any>): string[] {
  return resolveCatalogImages(instance.baseSnapshot?.images ?? instance.resolved?.images, instance.overrides?.images);
}

const PLACEMENT_ORDER = ['front', 'front-center', 'back', 'left_sleeve', 'right_sleeve'];
export function buildPacketImageOrder(packet: Record<string, any>, additionalMockups: unknown = []): string[] {
  const placements = packet.placementMockupUrls || {};
  const keys = Object.keys(placements);
  const orderedKeys = [...PLACEMENT_ORDER.filter(key => keys.includes(key)), ...keys.filter(key => !PLACEMENT_ORDER.includes(key))];
  return resolveProductImages({
    mockups: [...orderedKeys.map(key => placements[key]), packet.priorityMockupUrl, packet.lifestyleMockupUrl, ...imageUrls(additionalMockups)],
    proofs: [packet.compositeUrl || packet.productGraphicUrl, ...Object.values(packet.sleeveCompositeUrls || {}), packet.sleeveCompositeUrl, packet.landingPageSnapshotUrl, packet.qrOnlyUrl],
  });
}

/** Explicit restore is the only operation that removes a saved image override. */
export function updateCatalogImageSelection(existing: Record<string, unknown>, blankId: string, images: unknown[], restore: boolean): Record<string, unknown> {
  const next = { ...existing };
  if (restore) delete next[blankId];
  else next[blankId] = imageUrls(images);
  return next;
}
