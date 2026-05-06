import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useProductsContext } from "../ProductsContext";
import { adminFetch } from "@/lib/adminFetch";
import { auth } from "@/lib/firebase";
import type { SourceType, LoadedTemplate, LoadedGraphic, LoadedBackground, BuilderState, OriginFilter, GenderFilter, CatalogProduct, QRProductState, ContentData, PlacementType, PlacementConfig, PlacementSize, PlacementSizeConfig, SelectedColor, PrintMethodSelection, TemplateProductHint, TextLayerSource } from "./types";
import type { RoleType, Store, Channel, Collection } from "../shared/types";
import { defaultTextStyle } from "./types";

interface BuilderContextValue {
  state: BuilderState;
  autoSaveFailed: boolean;
  activeProviders: string[];
  selectedRole: RoleType | null;
  selectedStore: Store | null;
  selectedChannel: Channel | null;
  selectedCollection: Collection | null;
  setSourceType: (type: SourceType) => void;
  loadTemplate: (template: LoadedTemplate) => void;
  loadGraphic: (graphic: LoadedGraphic) => void;
  loadBackground: (background: LoadedBackground | null) => void;
  setFulfillmentProvider: (provider: string | null) => void;
  setCategory: (category: string | null) => void;
  setOriginFilter: (filter: Partial<OriginFilter>) => void;
  setGenderFilter: (filter: GenderFilter) => void;
  selectProduct: (product: CatalogProduct | null) => void;
  setQRProductState: (state: QRProductState) => void;
  setContent: (content: Partial<ContentData>) => void;
  togglePlacement: (placementId: string) => void;
  setPlacementType: (placementId: string, type: PlacementType) => void;
  setPlacementSize: (placementId: string, size: PlacementSize) => void;
  setPlacementMethod: (placementId: string, method: 'dtg' | 'dtf') => void;
  setSelectedColor: (color: SelectedColor | null) => void;
  setSelectedCatalogId: (id: string) => void;
  setActivePacketId: (id: string | null) => void;
  setActiveSession: (id: string | null, status: 'working' | 'artifact_ready' | 'committed' | null, instanceId: string | null) => void;
  setProductDescription: (description: string | null, source?: TextLayerSource) => void;
  setProductTitle: (title: string | null, source?: TextLayerSource) => void;
  resetBuilder: () => void;
  loadFromPacketData: (packetData: Record<string, any>, resolvedProduct?: CatalogProduct | null) => void;
  loadFromWorkingState: (working: Record<string, any>, resolvedProduct?: CatalogProduct | null) => void;
  hasChangesFromBaseline: () => boolean;
  setTemplateProductResolved: (product: CatalogProduct | null) => void;
  api: ReturnType<typeof useProductsContext>["api"];
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

const initialContent: ContentData = {
  url: "",
  title: "",
  description: "",
  backgroundType: "image",
  videoUrl: "",
  overlayPosition: "top",
  overlayColor: "#FFFFFF",
  overlayFontFamily: "Arial",
  headerStyle: { ...defaultTextStyle, verticalOffset: 80, horizontalOffset: 50, color: '#000000' },
  footerStyle: { ...defaultTextStyle, verticalOffset: 80, horizontalOffset: 50, color: '#000000' },
  titleStyle: { ...defaultTextStyle, text: "", verticalOffset: 84, horizontalOffset: 8 },
  descriptionStyle: { ...defaultTextStyle, text: "", verticalOffset: 72, horizontalOffset: 10 },
  landingTextBlocks: [],
  hostingTierCode: "1_year",
  playMediaSource: null,
  playMediaUrl: "",
  playMediaFile: null,
  playMediaPreview: "",
  playMediaMimeType: "",
  playPermissionConfirmed: false,
  qrPositionX: 50,
  qrPositionY: 50,
  qrSizePercent: 75,
  areaImageUrl: '',
  areaImageMode: 'behind-qr',
  areaImageOffsetX: 50,
  areaImageOffsetY: 50,
  areaImageScale: 100,
  subBottomStyle: { ...defaultTextStyle, enabled: false, text: '', fontFamily: 'Arial', fontWeight: '400', fontSize: '14', color: '#666666', mode: 'text' as const },
  graphicLayoutMode: "" as "" | "zone" | "freeform",
  composeItems: [],
  composeMode: '',
  composeHostingTerm: '',
  composeStep: '',
  composeMockup: '',
  composeInstanceId: null,
};

const initialState: BuilderState = {
  sourceType: "custom",
  loadedTemplate: null,
  loadedGraphic: null,
  loadedBackground: null,
  fulfillmentProvider: "printify",
  category: "T-Shirts",
  originFilter: { showUSA: true, showOther: false },
  genderFilter: "mens",
  selectedProduct: null,
  masterTitle: null,
  adminCatalogTitle: null,
  masterDescription: null,
  productDescription: null,
  adminCatalogDescription: null,
  titleSource: null,
  descriptionSource: null,
  selectedColor: { name: "Black", hex: "#000000" },
  qrProductState: "qr_canvas",
  content: {
    ...initialContent,
    headerStyle: {
      ...initialContent.headerStyle,
      text: "",
      enabled: false,
      color: "#FFFFFF",
    },
    footerStyle: {
      ...initialContent.footerStyle,
      text: "",
      enabled: false,
      color: "#FFFFFF",
    },
  },
  placementsLoading: false,
  placementsError: null,
  selectedPlacements: [],
  placementConfig: {},
  placementSizes: {},
  placementMethods: {},
  activePacketId: null,
  templateBaseline: null,
  templateProductHint: null,
  activeSessionId: null,
  sessionStatus: null,
  committedInstanceId: null,
  selectedCatalogId: "all",
};

interface BuilderProviderProps {
  children: React.ReactNode;
}

interface BuilderSnapshotContext {
  selectedStore: Store | null;
  selectedChannel: Channel | null;
  selectedCollection: Collection | null;
}

function normalizeLandingTextBlocks(blocks: any[]): any[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => ({
    text: b.text || '',
    enabled: b.enabled ?? false,
    fontFamily: b.fontFamily || '',
    fontSize: b.fontSize || '',
    fontWeight: b.fontWeight || '',
    color: b.color || '',
    warpPreset: b.warpPreset || '',
    letterSpacing: Number(b.letterSpacing ?? 0),
    strokeColor: b.strokeColor || '',
    strokeWidth: Number(b.strokeWidth ?? 0),
    verticalOffset: Number(b.verticalOffset ?? 0),
    horizontalOffset: Number(b.horizontalOffset ?? 0),
    mode: b.mode || '',
    imageUrl: b.imageUrl || '',
    imageScale: Number(b.imageScale ?? 0),
  }));
}

/**
 * Compute a client-side BLD draft summary from the current builder state.
 * Mirrors the server-side extractBldInstances logic (bld-builder.ts) but
 * produces a lightweight preview — no IDs, no Firestore writes.
 * Used in autosave so the server can validate the draft shape without a commit.
 */
function buildBldDraft(state: BuilderState): Record<string, any> {
  const content = state.content || {};
  const layers: Array<{ seq: string; type: string; role?: string; text?: string }> = [];
  let seq = 1;
  const pad = (n: number) => String(n).padStart(2, '0');

  const bgUrl    = state.loadedBackground?.url || null;
  const areaUrl  = content.areaImageUrl || null;
  if (bgUrl || areaUrl) {
    layers.push({ seq: pad(seq++), type: 'img', role: bgUrl ? 'background' : 'area_image' });
  }
  layers.push({ seq: pad(seq++), type: 'qrc' });

  if (content.headerStyle?.enabled && content.headerStyle?.text)
    layers.push({ seq: pad(seq++), type: 'txt', role: 'header', text: content.headerStyle.text });
  if (content.footerStyle?.enabled && content.footerStyle?.text)
    layers.push({ seq: pad(seq++), type: 'txt', role: 'footer', text: content.footerStyle.text });
  if (content.subBottomStyle?.enabled && content.subBottomStyle?.text)
    layers.push({ seq: pad(seq++), type: 'txt', role: 'sub_bottom', text: content.subBottomStyle.text });
  for (const block of (Array.isArray(content.landingTextBlocks) ? content.landingTextBlocks : [])) {
    const b = block as any;
    if (b.enabled && b.text)
      layers.push({ seq: pad(seq++), type: 'txt', role: b.role || 'landing_text', text: b.text });
  }

  return {
    layoutMode:    content.graphicLayoutMode || 'zone',
    instanceCount: layers.length,
    layers,
  };
}

function buildWorkingSnapshot(state: BuilderState, ctx: BuilderSnapshotContext): Record<string, any> {
  const { playMediaFile, playMediaPreview, ...serializableContent } = state.content;
  // PROGRESSIVE TRUTH — WRITE STRICT PACKET VALUES ONLY.
  // NULL = "no explicit packet value". Display fallback is handled by
  // shared/descriptionLayers.ts at render time — NEVER at save time.
  // Do NOT fall back to masterTitle, masterDescription, or any upstream layer here.
  const packetTitle = state.adminCatalogTitle !== null && state.adminCatalogTitle !== undefined
    ? state.adminCatalogTitle : null;
  const titleSource: TextLayerSource = state.titleSource ?? null;
  const packetDescription = state.productDescription !== null && state.productDescription !== undefined
    ? state.productDescription : null;
  const descriptionSource: TextLayerSource = state.descriptionSource ?? null;
  return {
    title: packetTitle,
    titleSource,
    description: packetDescription,
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
      selectedCatalogId: state.selectedCatalogId ?? "all",
      selectedStore: ctx.selectedStore ?? null,
      selectedChannel: ctx.selectedChannel ?? null,
      selectedCollection: ctx.selectedCollection ?? null,
    },
    // BLD draft — mirrors server-side extractBldInstances for session-level visibility
    bldDraft: buildBldDraft(state),
  };
}

export function BuilderProvider({ children }: BuilderProviderProps) {
  const { api, selectedProviders, selectedRole, selectedStore, selectedChannel, selectedCollection, setSelectedStore, setSelectedChannel, setSelectedCollection } = useProductsContext();
  const [state, setState] = useState<BuilderState>(initialState);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  const cachedAuthHeadersRef = useRef<Record<string, string> | null>(null);
  const flushSaveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const activeProvider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";
    setState(prev => {
      if (prev.fulfillmentProvider !== activeProvider) {
        return { ...prev, fulfillmentProvider: activeProvider };
      }
      return prev;
    });
  }, [selectedProviders]);

  useEffect(() => {
    if (!state.activeSessionId) {
      flushSaveRef.current = null;
      return;
    }

    // Build snapshot immediately so flushSaveRef always has the latest data,
    // even if the 1.5-second debounce timer hasn't fired yet when the user navigates away.
    const snapshot = buildWorkingSnapshot(state, { selectedStore, selectedChannel, selectedCollection });
    const sessionId = state.activeSessionId;

    flushSaveRef.current = () => {
      const headers = cachedAuthHeadersRef.current;
      if (!headers) return;
      fetch(`/api/admin/build-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ working: snapshot }),
        keepalive: true,
      }).catch(() => {});
    };

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const token = await auth.currentUser?.getIdToken(true);
        if (token) {
          cachedAuthHeadersRef.current = { Authorization: `Bearer ${token}` };
        }

        // Primary: save full working state into the build session
        await adminFetch(`/build-sessions/${sessionId}`, {
          method: "PATCH",
          json: { working: snapshot },
        });
        setAutoSaveFailed(false);
        console.log(`[BuilderContext] Auto-saved to session ${sessionId}`);

        // Secondary: if a packet already exists, keep its builderSnapshot in sync too
        if (state.activePacketId) {
          const { playMediaFile, playMediaPreview, ...serializableContent } = state.content;
          await adminFetch(`/packets/${state.activePacketId}`, {
            method: "PATCH",
            json: { builderSnapshot: { content: serializableContent, loadedBackground: state.loadedBackground } },
          }).catch((e) => {
            console.warn(`[BuilderContext] Packet sync failed:`, e.message);
          });
        }
      } catch (e) {
        console.warn("[BuilderContext] Auto-save failed:", e);
        setAutoSaveFailed(true);
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    state.content,
    state.loadedBackground,
    state.loadedGraphic,
    state.loadedTemplate,
    state.selectedColor,
    state.qrProductState,
    state.selectedPlacements,
    state.placementConfig,
    state.placementSizes,
    state.placementMethods,
    state.fulfillmentProvider,
    state.category,
    state.sourceType,
    state.originFilter,
    state.genderFilter,
    state.productDescription,
    state.adminCatalogTitle,
    state.activeSessionId,
    state.activePacketId,
    state.selectedCatalogId,
    selectedStore,
    selectedChannel,
    selectedCollection,
  ]);

  // Flush any pending save when this component unmounts (e.g. user navigates away
  // before the 1.5-second debounce fires). Uses keepalive:true so the fetch
  // completes even after the component is gone.
  useEffect(() => {
    return () => {
      if (flushSaveRef.current) {
        flushSaveRef.current();
      }
    };
  }, []);

  // Eagerly fetch and cache auth headers the moment a session becomes active.
  // This ensures the flush-on-unmount and beforeunload saves work even if the
  // user navigates away before the first 1.5-second autosave timer fires.
  useEffect(() => {
    if (!state.activeSessionId) return;
    auth.currentUser?.getIdToken(true).then(token => {
      if (token) cachedAuthHeadersRef.current = { Authorization: `Bearer ${token}` };
    }).catch(() => {});
  }, [state.activeSessionId]);

  // Flush on tab-close / full-page reload. keepalive:true allows the browser
  // to complete the request even as the page is being torn down.
  useEffect(() => {
    const handler = () => {
      if (flushSaveRef.current) {
        flushSaveRef.current();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const setSourceType = useCallback((type: SourceType) => {
    setState(prev => ({
      ...prev,
      sourceType: type,
      loadedTemplate: null,
      loadedGraphic: null,
      loadedBackground: null,
      fulfillmentProvider: null,
      category: null,
    }));
  }, []);

  const loadTemplate = useCallback((template: LoadedTemplate) => {
    setState(prev => ({
      ...prev,
      loadedTemplate: template,
    }));
  }, []);

  const loadGraphic = useCallback((graphic: LoadedGraphic) => {
    setState(prev => ({
      ...prev,
      loadedGraphic: graphic,
    }));
  }, []);

  const loadBackground = useCallback((background: LoadedBackground | null) => {
    setState(prev => ({
      ...prev,
      loadedBackground: background,
    }));
  }, []);

  const setFulfillmentProvider = useCallback((provider: string | null) => {
    setState(prev => ({
      ...prev,
      fulfillmentProvider: provider,
      category: null,
    }));
  }, []);

  const setCategory = useCallback((category: string | null) => {
    setState(prev => ({
      ...prev,
      category: category,
      selectedProduct: null,
    }));
  }, []);

  const setSelectedCatalogId = useCallback((id: string) => {
    setState(prev => ({ ...prev, selectedCatalogId: id }));
  }, []);

  const setOriginFilter = useCallback((filter: Partial<OriginFilter>) => {
    setState(prev => ({
      ...prev,
      originFilter: { ...prev.originFilter, ...filter },
      selectedProduct: null,
    }));
  }, []);

  const setGenderFilter = useCallback((filter: GenderFilter) => {
    setState(prev => ({
      ...prev,
      genderFilter: filter,
      selectedProduct: null,
    }));
  }, []);

  const setProductDescription = useCallback((description: string | null, source: TextLayerSource = 'manual') => {
    setState(prev => ({
      ...prev,
      productDescription: description,
      adminCatalogDescription: description,
      descriptionSource: source,
      // selectedProduct.description is provider truth — never mutate it here.
      // Use the display resolver in shared/descriptionLayers.ts for fallback display.
    }));
  }, []);

  const setProductTitle = useCallback((title: string | null, source: TextLayerSource = 'manual') => {
    setState(prev => ({
      ...prev,
      adminCatalogTitle: title,
      titleSource: source,
      // selectedProduct.title is provider truth — never mutate it here.
      // Use the display resolver in shared/descriptionLayers.ts for fallback display.
    }));
  }, []);

  // Fetch QRG-native options for a product — single source of truth for placements,
  // colors, sizes, and variant mappings. Called by selectProduct, loadFromWorkingState,
  // and loadFromPacketData. Race-guarded by docId.
  const fetchOptionsForProduct = useCallback((product: CatalogProduct) => {
    const docId = product.docId;
    if (!docId || !/^qrg_/.test(docId)) {
      console.warn('[BuilderContext] Product missing qrg_ docId, skipping options fetch:', docId);
      setState(prev => {
        if (prev.selectedProduct?.docId !== docId) return prev;
        return { ...prev, placementsLoading: false };
      });
      return;
    }

    adminFetch<any>(`/master-catalog/products/${docId}/options`)
      .then(options => {
        setState(prev => {
          if (prev.selectedProduct?.docId !== docId) return prev;

          // Map QRG print locations → builder ProductPlacement shape
          const printLocations: ProductPlacement[] = (options.printLocations || []).map((pl: any) => ({
            id: pl.id,
            type: pl.id,
            title: pl.label || pl.id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            additionalPrice: 0,
            methods: [],
          }));

          const merged: CatalogProduct = {
            ...prev.selectedProduct!,
            placements: printLocations.length > 0 ? printLocations : (prev.selectedProduct!.placements || []),
            printLocations: options.printLocations || [],
            qrgBlankId: options.qrgBlankId || prev.selectedProduct!.qrgBlankId,
            qrgVariants: options.qrgVariants || {},
            providerMappings: options.providerMappings || prev.selectedProduct!.providerMappings,
            optionsLoaded: true,
          };

          return { ...prev, selectedProduct: merged, placementsLoading: false, placementsError: null };
        });
      })
      .catch(err => {
        console.error('[BuilderContext] Failed to fetch product options:', err);
        setState(prev => {
          if (prev.selectedProduct?.docId !== docId) return prev;
          return { ...prev, placementsLoading: false, placementsError: err?.message || 'Failed to load product options' };
        });
      });
  }, []);

  const selectProduct = useCallback((product: CatalogProduct | null) => {
    if (!product) {
      setState(prev => ({ ...prev, selectedProduct: null, masterTitle: null, adminCatalogTitle: null, masterDescription: null, productDescription: null, adminCatalogDescription: null, placementsLoading: false, placementsError: null }));
      return;
    }

    const masterTitle = product.title || null;
    const masterDescription = product.description || null;

    // Immediately seat the product with optionsLoaded=false and start loading.
    // fetchOptionsForProduct will merge placements/qrgBlankId/qrgVariants once resolved.
    // selectedProduct holds provider truth — do NOT mutate its title/description via
    // setProductTitle/setProductDescription; those are packet-layer writes.
    setState(prev => ({
      ...prev,
      selectedProduct: { ...product, optionsLoaded: false },
      masterTitle,
      adminCatalogTitle: null,
      // Seed titleSource as 'provider' — card selection is the explicit copy-forward
      // action. If handleCardSelect then applies a catalog override via setProductTitle,
      // titleSource will be updated to 'catalog'. Either way the packet owns its copy
      // from this point; changes to upstream after selection do not affect it.
      titleSource: 'provider' as TextLayerSource,
      masterDescription,
      // Seed productDescription from the provider description — this is the one-time
      // copy that happens when the admin selects a product. If no catalog override
      // is applied by handleCardSelect, the packet owns this provider-seeded value.
      productDescription: masterDescription,
      adminCatalogDescription: null,
      descriptionSource: 'provider' as TextLayerSource,
      placementsLoading: true,
      placementsError: null,
    }));

    fetchOptionsForProduct(product);
  }, [fetchOptionsForProduct]);

  const setQRProductState = useCallback((qrState: QRProductState) => {
    setState(prev => ({
      ...prev,
      qrProductState: qrState,
      content: initialContent,
      selectedPlacements: [],
      placementConfig: {},
      placementSizes: {},
      placementMethods: {},
    }));
  }, []);

  const setContent = useCallback((content: Partial<ContentData>) => {
    setState(prev => ({
      ...prev,
      content: { ...prev.content, ...content },
    }));
  }, []);

  const togglePlacement = useCallback((placementId: string) => {
    setState(prev => {
      const isSelected = prev.selectedPlacements.includes(placementId);
      const newPlacements = isSelected
        ? prev.selectedPlacements.filter(p => p !== placementId)
        : [...prev.selectedPlacements, placementId];
      
      const newConfig = { ...prev.placementConfig };
      const newSizes = { ...prev.placementSizes };
      const newMethods = { ...prev.placementMethods };
      if (!isSelected) {
        newConfig[placementId] = "qr";
        newSizes[placementId] = "medium";
        const placement = prev.selectedProduct?.placements?.find(p => p.id === placementId);
        if (placement?.methods && placement.methods.length > 0) {
          newMethods[placementId] = placement.methods[0].method;
        }
      } else {
        delete newConfig[placementId];
        delete newSizes[placementId];
        delete newMethods[placementId];
      }
      
      return {
        ...prev,
        selectedPlacements: newPlacements,
        placementConfig: newConfig,
        placementSizes: newSizes,
        placementMethods: newMethods,
      };
    });
  }, []);

  const setPlacementType = useCallback((placementId: string, type: PlacementType) => {
    setState(prev => ({
      ...prev,
      placementConfig: {
        ...prev.placementConfig,
        [placementId]: type,
      },
    }));
  }, []);

  const setPlacementSize = useCallback((placementId: string, size: PlacementSize) => {
    setState(prev => ({
      ...prev,
      placementSizes: {
        ...prev.placementSizes,
        [placementId]: size,
      },
    }));
  }, []);

  const setPlacementMethod = useCallback((placementId: string, method: 'dtg' | 'dtf') => {
    setState(prev => ({
      ...prev,
      placementMethods: {
        ...prev.placementMethods,
        [placementId]: method,
      },
    }));
  }, []);

  const setSelectedColor = useCallback((color: SelectedColor | null) => {
    setState(prev => ({
      ...prev,
      selectedColor: color,
    }));
  }, []);

  const setActivePacketId = useCallback((id: string | null) => {
    setState(prev => ({
      ...prev,
      activePacketId: id,
    }));
  }, []);

  const setActiveSession = useCallback((
    id: string | null,
    status: 'working' | 'artifact_ready' | 'committed' | null,
    instanceId: string | null,
  ) => {
    setState(prev => ({
      ...prev,
      activeSessionId: id,
      sessionStatus: status,
      committedInstanceId: instanceId,
    }));
  }, []);

  const loadFromWorkingState = useCallback((working: Record<string, any>, resolvedProduct?: CatalogProduct | null) => {
    const graphics = (working.graphics || {}) as Record<string, any>;
    const qrConfig = (working.qrConfig || {}) as Record<string, any>;
    const layoutConfig = (working.layoutConfig || {}) as Record<string, any>;
    const metadata = (working.metadata || {}) as Record<string, any>;
    const { playMediaFile: _pmf, playMediaPreview: _pmp, ...cleanContent } = (graphics.content || {}) as any;

    // Restore store → channel → collection in dependency order
    if (metadata.selectedStore) setSelectedStore(metadata.selectedStore as Store);
    if (metadata.selectedChannel) setSelectedChannel(metadata.selectedChannel as Channel);
    if (metadata.selectedCollection) setSelectedCollection(metadata.selectedCollection as Collection);

    const product = resolvedProduct ?? null;
    const needsOptionsFetch = !!(product && !product.optionsLoaded);

    setState(prev => ({
      ...prev,
      content: { ...initialContent, ...cleanContent },
      loadedBackground: graphics.loadedBackground ?? null,
      loadedGraphic: graphics.loadedGraphic ?? null,
      loadedTemplate: graphics.loadedTemplate ?? null,
      qrProductState: (qrConfig.qrProductState as QRProductState) ?? prev.qrProductState,
      selectedColor: qrConfig.selectedColor ?? prev.selectedColor,
      templateProductHint: qrConfig.templateProductHint ?? null,
      selectedPlacements: (layoutConfig.selectedPlacements as string[]) ?? [],
      placementConfig: (layoutConfig.placementConfig as PlacementConfig) ?? {},
      placementSizes: (layoutConfig.placementSizes as PlacementSizeConfig) ?? {},
      placementMethods: (layoutConfig.placementMethods as PrintMethodSelection) ?? {},
      adminCatalogTitle: working.title ?? null,
      titleSource: (working.titleSource as TextLayerSource) ?? null,
      productDescription: working.description ?? null,
      descriptionSource: (working.descriptionSource as TextLayerSource) ?? null,
      selectedProduct: product ? { ...product, optionsLoaded: false } : prev.selectedProduct,
      placementsLoading: needsOptionsFetch,
      placementsError: null,
      activePacketId: null,
      selectedCatalogId: (metadata.selectedCatalogId as string) ?? "all",
      fulfillmentProvider: (metadata.fulfillmentProvider as string) ?? prev.fulfillmentProvider,
      category: (metadata.category as string) ?? null,
      originFilter: (metadata.originFilter as OriginFilter) ?? prev.originFilter,
      genderFilter: (metadata.genderFilter as GenderFilter) ?? prev.genderFilter,
      sourceType: (metadata.sourceType as SourceType) ?? prev.sourceType,
    }));

    if (needsOptionsFetch && product) {
      fetchOptionsForProduct(product);
    }
  }, [setSelectedStore, setSelectedChannel, setSelectedCollection, fetchOptionsForProduct]);

  const buildBaselineSnapshot = (
    packetData: Record<string, any>,
    content: Partial<ContentData>,
    selectedPlacements: string[],
    selectedColorName: string | null,
    backgroundUrl: string | null,
    blueprintId: number | null,
  ): string => {
    const h = (packetData.headerStyle as any) || content.headerStyle || {};
    const f = (packetData.footerStyle as any) || content.footerStyle || {};
    const sb = content.subBottomStyle as any || {};
    return JSON.stringify({
      blueprintId,
      qrProductState: packetData.qrProductState || null,
      selectedPlacements: [...selectedPlacements].sort(),
      placementConfig: packetData.placementConfig || {},
      placementSizes: packetData.placementSizes || {},
      selectedColorName,
      url: content.url || '',
      title: content.title || '',
      description: content.description || '',
      headerEnabled: h.enabled || false,
      headerText: h.text || '',
      headerColor: h.color || '',
      headerFontFamily: h.fontFamily || '',
      headerFontSize: h.fontSize || '',
      footerEnabled: f.enabled || false,
      footerText: f.text || '',
      footerColor: f.color || '',
      footerFontFamily: f.fontFamily || '',
      footerFontSize: f.fontSize || '',
      subBottomEnabled: sb.enabled || false,
      subBottomText: sb.text || '',
      subBottomColor: sb.color || '',
      qrPositionX: content.qrPositionX ?? 50,
      qrPositionY: content.qrPositionY ?? 50,
      qrSizePercent: content.qrSizePercent ?? 75,
      backgroundUrl,
      landingTextBlocks: normalizeLandingTextBlocks(content.landingTextBlocks as any[]),
    });
  };

  const loadFromPacketData = useCallback((packetData: Record<string, any>, resolvedProduct?: CatalogProduct | null) => {
    const snapshot = packetData.builderSnapshot?.content as Partial<ContentData> | undefined;

    const headerStyle = packetData.headerStyle
      ? { ...initialContent.headerStyle, ...(packetData.headerStyle as object) }
      : (snapshot?.headerStyle ? { ...initialContent.headerStyle, ...snapshot.headerStyle } : initialContent.headerStyle);

    const footerStyle = packetData.footerStyle
      ? { ...initialContent.footerStyle, ...(packetData.footerStyle as object) }
      : (snapshot?.footerStyle ? { ...initialContent.footerStyle, ...snapshot.footerStyle } : initialContent.footerStyle);

    const subBottomStyle = snapshot?.subBottomStyle || {
      ...defaultTextStyle,
      enabled: packetData.subBottomEnabled || false,
      text: packetData.subBottomText || '',
      fontFamily: packetData.subBottomFontFamily || 'Arial',
      fontSize: packetData.subBottomFontSize || '14',
      fontWeight: packetData.subBottomFontWeight || '400',
      color: packetData.subBottomColor || '#666666',
      mode: 'text' as const,
    };

    const newContent: Partial<ContentData> = {
      url: packetData.qrContent || snapshot?.url || '',
      title: packetData.landingPageTitle || snapshot?.title || '',
      description: packetData.landingPageDescription || snapshot?.description || '',
      headerStyle,
      footerStyle,
      subBottomStyle,
      qrPositionX: packetData.qrPositionX ?? snapshot?.qrPositionX ?? 50,
      qrPositionY: packetData.qrPositionY ?? snapshot?.qrPositionY ?? 50,
      qrSizePercent: packetData.qrSizePercent ?? snapshot?.qrSizePercent ?? 75,
      areaImageUrl: packetData.areaImageUrl || snapshot?.areaImageUrl || '',
      areaImageMode: (packetData.areaImageMode || snapshot?.areaImageMode || 'behind-qr') as "behind-qr",
      areaImageOffsetX: packetData.areaImageOffsetX ?? snapshot?.areaImageOffsetX ?? 50,
      areaImageOffsetY: packetData.areaImageOffsetY ?? snapshot?.areaImageOffsetY ?? 50,
      areaImageScale: packetData.areaImageScale ?? snapshot?.areaImageScale ?? 100,
      landingTextBlocks: snapshot?.landingTextBlocks || (packetData.landingTextBlocks as any[]) || [],
      graphicLayoutMode: (packetData.graphicLayoutMode || snapshot?.graphicLayoutMode || '') as "" | "zone" | "freeform",
    };

    const selectedColor: SelectedColor | null = packetData.defaultColor
      ? { name: packetData.defaultColor, hex: packetData.defaultColorHex || '#000000' }
      : null;

    const bgUrl = packetData.backgroundUrl || packetData.landingPageBackgroundUrl || null;
    const loadedBackground = bgUrl
      ? { id: 'template-bg', name: 'Template Background', url: bgUrl }
      : null;

    const selectedPlacements: string[] = Array.isArray(packetData.placements) ? packetData.placements : [];
    const blueprintId: number | null = packetData.blueprintId ? Number(packetData.blueprintId) : null;

    const hint: TemplateProductHint = {
      blueprintId,
      printProviderId: packetData.printProviderId ? Number(packetData.printProviderId) : null,
      productId: packetData.productId ? Number(packetData.productId) : null,
      productName: packetData.productName || null,
      fulfillmentProvider: packetData.fulfillmentProvider || 'printify',
    };

    const baseline = buildBaselineSnapshot(
      packetData,
      newContent,
      selectedPlacements,
      selectedColor?.name || null,
      bgUrl,
      blueprintId,
    );

    const needsOptionsFetch = !!(resolvedProduct && !resolvedProduct.optionsLoaded);

    setState(prev => ({
      ...prev,
      qrProductState: (packetData.qrProductState as QRProductState) || 'qr_canvas',
      selectedPlacements,
      placementConfig: (packetData.placementConfig as Record<string, any>) || {},
      placementSizes: (packetData.placementSizes as Record<string, any>) || {},
      placementMethods: (packetData.placementMethods as Record<string, any>) || {},
      selectedColor,
      loadedBackground,
      fulfillmentProvider: packetData.fulfillmentProvider || 'printify',
      content: { ...initialContent, ...newContent },
      activePacketId: null,
      templateBaseline: baseline,
      templateProductHint: hint,
      selectedProduct: resolvedProduct ? { ...resolvedProduct, optionsLoaded: false } : null,
      // PROGRESSIVE TRUTH — hydrate only the packet-owned value. Never fall back to
      // resolvedProduct?.description (upstream provider text). NULL is correct when the
      // packet has no explicit description; display resolver handles fallback at render time.
      productDescription: packetData.productDescription !== undefined ? packetData.productDescription : null,
      placementsLoading: needsOptionsFetch,
      placementsError: null,
    }));

    if (needsOptionsFetch && resolvedProduct) {
      fetchOptionsForProduct(resolvedProduct);
    }
  }, [fetchOptionsForProduct]);

  const hasChangesFromBaseline = useCallback((): boolean => {
    if (!state.templateBaseline) return true;
    const s = state;
    const c = s.content;
    const h = c.headerStyle as any;
    const f = c.footerStyle as any;
    const sb = c.subBottomStyle as any;
    const current = JSON.stringify({
      blueprintId: s.selectedProduct?.blueprintId ?? null,
      qrProductState: s.qrProductState || null,
      selectedPlacements: [...(s.selectedPlacements || [])].sort(),
      placementConfig: s.placementConfig || {},
      placementSizes: s.placementSizes || {},
      selectedColorName: s.selectedColor?.name || null,
      url: c.url || '',
      title: c.title || '',
      description: c.description || '',
      headerEnabled: h?.enabled || false,
      headerText: h?.text || '',
      headerColor: h?.color || '',
      headerFontFamily: h?.fontFamily || '',
      headerFontSize: h?.fontSize || '',
      footerEnabled: f?.enabled || false,
      footerText: f?.text || '',
      footerColor: f?.color || '',
      footerFontFamily: f?.fontFamily || '',
      footerFontSize: f?.fontSize || '',
      subBottomEnabled: sb?.enabled || false,
      subBottomText: sb?.text || '',
      subBottomColor: sb?.color || '',
      qrPositionX: c.qrPositionX ?? 50,
      qrPositionY: c.qrPositionY ?? 50,
      qrSizePercent: c.qrSizePercent ?? 75,
      backgroundUrl: s.loadedBackground?.url || null,
      landingTextBlocks: normalizeLandingTextBlocks(c.landingTextBlocks as any[]),
    });
    return current !== state.templateBaseline;
  }, [state]);

  const setTemplateProductResolved = useCallback((product: CatalogProduct | null) => {
    setState(prev => ({
      ...prev,
      selectedProduct: product,
      templateProductHint: product ? null : prev.templateProductHint,
    }));
  }, []);

  const resetBuilder = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo<BuilderContextValue>(() => ({
    state,
    autoSaveFailed,
    activeProviders: selectedProviders,
    selectedRole,
    selectedStore,
    selectedChannel,
    selectedCollection,
    setSourceType,
    loadTemplate,
    loadGraphic,
    loadBackground,
    setFulfillmentProvider,
    setCategory,
    setOriginFilter,
    setGenderFilter,
    selectProduct,
    setQRProductState,
    setContent,
    togglePlacement,
    setPlacementType,
    setPlacementSize,
    setPlacementMethod,
    setSelectedColor,
    setSelectedCatalogId,
    setActivePacketId,
    setActiveSession,
    setProductDescription,
    setProductTitle,
    resetBuilder,
    loadFromPacketData,
    loadFromWorkingState,
    hasChangesFromBaseline,
    setTemplateProductResolved,
    api,
  }), [state, autoSaveFailed, selectedProviders, selectedRole, selectedStore, selectedChannel, selectedCollection, setSourceType, loadTemplate, loadGraphic, loadBackground, setFulfillmentProvider, setCategory, setSelectedCatalogId, setOriginFilter, setGenderFilter, selectProduct, setQRProductState, setContent, togglePlacement, setPlacementType, setPlacementSize, setPlacementMethod, setSelectedColor, setActivePacketId, setActiveSession, setProductDescription, setProductTitle, resetBuilder, loadFromPacketData, loadFromWorkingState, hasChangesFromBaseline, setTemplateProductResolved, api]);

  return (
    <BuilderContext.Provider value={value}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilderContext(): BuilderContextValue {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error("useBuilderContext must be used within BuilderProvider");
  }
  return context;
}
