import { builderBldLayoutMode, extractBldInstances, validateBldStructure } from './bldCodes';

export interface BuilderSnapshotContext { selectedRole: string | null; selectedStore: Record<string, any> | null; selectedChannel: Record<string, any> | null; selectedCollection: Record<string, any> | null; }
/** Structural draft uses the same extraction as the server commit. */
function buildBldDraft(state: Record<string, any>): Record<string, any> {
  const instances = extractBldInstances({ graphics: { content: state.content, loadedBackground: state.loadedBackground } });
  return { context: 'S', layoutMode: builderBldLayoutMode(state.content.graphicLayoutMode), instanceCount: instances.length, instances };
}

/**
 * Sanitize a snapshot for safe transmission to the server.
 * JSON.stringify drops undefined values; the replacer also converts
 * NaN/Infinity → null so the server never receives non-finite numbers.
 */
export function sanitizeSnapshot(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_, v) => {
    if (v === undefined) return null;
    if (typeof v === 'number' && !isFinite(v)) return null;
    return v;
  }));
}

export function buildWorkingSnapshot(state: Record<string, any>, ctx: BuilderSnapshotContext): Record<string, any> {
  const { playMediaFile, playMediaPreview, ...serializableContent } = state.content;
  // PROGRESSIVE TRUTH — WRITE STRICT PACKET VALUES ONLY.
  // NULL = "no explicit packet value". Display fallback is handled by
  // shared/descriptionLayers.ts at render time — NEVER at save time.
  // Do NOT fall back to masterTitle, masterDescription, or any upstream layer here.
  const packetTitle = state.adminCatalogTitle !== null && state.adminCatalogTitle !== undefined
    ? state.adminCatalogTitle : null;
  const titleSource: string = state.titleSource ?? null;
  const packetDescription = state.productDescription !== null && state.productDescription !== undefined
    ? state.productDescription : null;
  const descriptionSource: string = state.descriptionSource ?? null;
  const adminCatalogDescription = state.adminCatalogDescription !== null && state.adminCatalogDescription !== undefined
    ? state.adminCatalogDescription : null;
  return {
    title: packetTitle,
    titleSource,
    description: packetDescription,
    adminCatalogDescription,
    descriptionSource,
    images: state.selectedProduct?.images ?? [],
    graphics: {
      content: serializableContent,
      loadedBackground: state.loadedBackground,
      loadedGraphic: state.loadedGraphic,
      loadedTemplate: state.loadedTemplate,
    },
    qrConfig: {
      qrProductState: state.qrProductState,
      selectedColor: state.selectedColor,
      templateProductHint: state.templateProductHint,
    },
    layoutConfig: {
      selectedPlacements: state.selectedPlacements,
      providerLayouts: Object.fromEntries((state.selectedProduct?.placements || [])
        .filter((p: any) => state.selectedPlacements?.includes(p.id) && p.dimensions)
        .map((p: any) => [p.id, { dimensions: p.dimensions, providerPlacementId: p.providerPlacement || p.id, provider: p.provider }])),
      placementConfig: state.placementConfig,
      placementSizes: state.placementSizes,
      placementMethods: state.placementMethods,
    },
    metadata: {
      fulfillmentProvider: state.fulfillmentProvider,
      category: state.category,
      originFilter: state.originFilter,
      genderFilter: state.genderFilter,
      sourceType: state.sourceType,
      selectedProductDocId: state.selectedProduct?.docId ?? null,
      selectedProductBlueprintId: state.selectedProduct?.blueprintId ?? null,
      templateProductHint: state.templateProductHint ?? null,
      selectedBldId: state.selectedBldId ?? null,
      selectedCatalogId: state.selectedCatalogId ?? "all",
      selectedRole: ctx.selectedRole ?? null,
      selectedStore: ctx.selectedStore ?? null,
      selectedChannel: ctx.selectedChannel ?? null,
      selectedCollection: ctx.selectedCollection ?? null,
    },
    // BLD draft — lightweight layer preview for server-side validation without a commit
    // The shared extractor includes layout and styling, never content or identity.
    bldDraft: buildBldDraft(state),
    // Provider layout — renderer/export dimensions. NOT a BLD field; stored here (not in
    // working.bld) per BLD.md separation of concerns. Read back by loadFromWorkingState.
    providerLayout: state.providerLayout ?? null,
  };
}


/** A generated packet keeps the exact working snapshot used to render it. */
export function requireBuilderSnapshot(value: any): Record<string, any> {
  if (!value?.graphics?.content || !value.qrConfig || !Array.isArray(value.layoutConfig?.selectedPlacements) || !value.metadata) {
    throw new Error('Build snapshot is incomplete. Open the draft and generate the packet again.');
  }
  const snapshot = sanitizeSnapshot(value);
  // Derive structure from the input; never trust a second, supplied BLD draft.
  snapshot.bldDraft = buildBldDraft({ content: snapshot.graphics.content, loadedBackground: snapshot.graphics.loadedBackground });
  const error = validateBldStructure(snapshot.bldDraft);
  if (error) throw new Error(error);
  return snapshot;
}

/** Existing packet display fields are projections, never a second editor state. */
export function packetBuildFields(value: any): Record<string, any> {
  const snapshot = requireBuilderSnapshot(value);
  const c = snapshot.graphics.content, q = snapshot.qrConfig, l = snapshot.layoutConfig, m = snapshot.metadata;
  const bg = snapshot.graphics.loadedBackground?.url ?? null;
  const sb = c.subBottomStyle || {};
  const fields: Record<string, any> = {
    builderSnapshot: snapshot,
    headerStyle: c.headerStyle?.enabled ? c.headerStyle : null,
    footerStyle: c.footerStyle?.enabled ? c.footerStyle : null,
    headerText: c.headerStyle?.enabled ? c.headerStyle.text : null,
    footerText: c.footerStyle?.enabled ? c.footerStyle.text : null,
    subBottomEnabled: !!sb.enabled, subBottomText: sb.text ?? '',
    subBottomFontFamily: sb.fontFamily, subBottomFontSize: sb.fontSize,
    subBottomFontWeight: sb.fontWeight, subBottomColor: sb.color,
    qrProductState: q.qrProductState,
    selectedPlacements: l.selectedPlacements, placements: l.selectedPlacements,
    placementConfig: l.placementConfig, placementSizes: l.placementSizes, placementMethods: l.placementMethods,
    defaultColor: q.selectedColor?.name ?? null, defaultColorHex: q.selectedColor?.hex ?? null,
    providerLayout: snapshot.providerLayout,
    backgroundUrl: bg, landingPageBackgroundUrl: bg,
    landingPageTitle: c.title, landingPageDescription: c.description, landingTextBlocks: c.landingTextBlocks,
    adminCatalogTitle: snapshot.title, effectiveTitle: snapshot.title,
    adminCatalogDescription: snapshot.adminCatalogDescription,
    productDescription: snapshot.description, effectiveDescription: snapshot.description,
    fulfillmentProvider: m.fulfillmentProvider,
    sourceMasterId: m.selectedProductDocId,
    roleType: m.selectedRole, storeId: m.selectedStore?.id ?? null, storeName: m.selectedStore?.name ?? null,
    channelId: m.selectedChannel?.id ?? null, channelName: m.selectedChannel?.name ?? null,
    collectionId: m.selectedCollection?.id ?? null, collectionName: m.selectedCollection?.name ?? null,
    folderPath: [m.selectedStore?.name, m.selectedChannel?.name, m.selectedCollection?.name].filter(Boolean).join(' / ') || null,
  };
  for (const key of ['graphicLayoutMode', 'qrSizePercent', 'qrPositionX', 'qrPositionY', 'areaImageUrl', 'areaImageMode', 'areaImageOffsetX', 'areaImageOffsetY', 'areaImageScale', 'qrBasicInputType']) fields[key] = c[key];
  return sanitizeSnapshot(fields);
}

/** Rendering consumes the same snapshot persisted on the packet. */
export function productGraphicOptions(value: any, qrContent: string, placement?: string): Record<string, any> {
  const snapshot = requireBuilderSnapshot(value);
  const c = snapshot.graphics.content, sb = c.subBottomStyle || {};
  return {
    qrContent, qrColor: 'black', transparent: true,
    placement: placement || snapshot.layoutConfig.selectedPlacements[0],
    headerStyle: c.headerStyle?.enabled ? c.headerStyle : null,
    footerStyle: c.footerStyle?.enabled ? c.footerStyle : null,
    backgroundColor: snapshot.qrConfig.selectedColor?.hex,
    graphicLayoutMode: c.graphicLayoutMode,
    qrPositionX: c.qrPositionX, qrPositionY: c.qrPositionY, qrSizePercent: c.qrSizePercent,
    areaImageUrl: c.areaImageUrl, areaImageMode: c.areaImageMode,
    areaImageOffsetX: c.areaImageOffsetX, areaImageOffsetY: c.areaImageOffsetY, areaImageScale: c.areaImageScale,
    subBottomEnabled: sb.enabled, subBottomText: sb.text, subBottomFontFamily: sb.fontFamily,
    subBottomFontSize: sb.fontSize, subBottomFontWeight: sb.fontWeight, subBottomColor: sb.color,
    subBottomLetterSpacing: sb.letterSpacing,
    providerLayout: snapshot.layoutConfig.providerLayouts?.[placement || snapshot.layoutConfig.selectedPlacements[0]] || snapshot.providerLayout,
  };
}

/** Resolve the canonical blank for both builder and storefront mockup requests. */
export function packetMockupSourceId(packet: Record<string, any>): string {
  const sourceId = requireBuilderSnapshot(packet.builderSnapshot).metadata.selectedProductDocId;
  if (typeof sourceId !== 'string' || !/^qrg_[1-6][1-9]\d{3}$/.test(sourceId)) throw new Error('Saved build has no canonical QRG blank');
  return sourceId;
}

/** A color change changes the shirt variant, never the saved placement artwork. */
export function buildPacketMockupRequest(packet: Record<string, any>, master: Record<string, any>, placement: string, colorName?: string) {
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  if (!snapshot.layoutConfig.selectedPlacements.includes(placement)) throw new Error('Placement does not belong to this saved build');
  const selectedColor = colorName || snapshot.qrConfig.selectedColor?.name;
  if (!selectedColor) throw new Error('Saved build has no selected color');
  const variants = Object.values(master.qrgVariants || {}) as any[];
  const variant = variants.find(v => v.colorLabel === selectedColor && v.providerVariants?.printful?.variantId);
  if (!variant) throw new Error(`QRG has no Printful variant for ${selectedColor}. Refresh it through QRG table logic.`);
  const mapping = variant.providerVariants.printful;
  const productId = Number(mapping.productId), variantId = Number(mapping.variantId);
  if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isSafeInteger(variantId) || variantId <= 0) throw new Error('QRG Printful mapping is invalid');
  const layout = snapshot.layoutConfig.providerLayouts?.[placement];
  const width = layout?.dimensions?.widthPx, height = layout?.dimensions?.heightPx;
  if (layout?.provider !== 'printful' || !layout.providerPlacementId || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Saved build is missing its Printful print-area dimensions');
  }
  const artworkUrl = packet.placementGraphicUrls?.[placement];
  if (!artworkUrl) throw new Error('The saved placement has no generated print artwork');
  return {
    blueprintId: productId, printProviderId: 0, colorName: selectedColor,
    placement, artworkUrl, artworkVariant: 'black' as const, fulfillmentProvider: 'printful' as const,
    hasCompositeGraphic: true, printfulVariantId: variantId,
    printArea: { width, height, placement: layout.providerPlacementId },
  };
}
