import { applyBuilderBld } from '@shared/bldCodes';
import { buildWorkingSnapshot, sanitizeSnapshot, requireBuilderSnapshot } from '@shared/builderSnapshot';
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useProductsContext } from "../ProductsContext";
import { adminFetch } from "@/lib/adminFetch";
import { auth } from "@/lib/firebase";
import type { SourceType, LoadedTemplate, LoadedGraphic, LoadedBackground, BuilderState, OriginFilter, GenderFilter, CatalogProduct, QRProductState, ContentData, PlacementType, PlacementConfig, PlacementSize, PlacementSizeConfig, SelectedColor, PrintMethodSelection, TemplateProductHint, TextLayerSource, ProviderLayout, ProductPlacement } from "./types";
import type { RoleType, Store, Channel, Collection } from "../shared/types";
import { defaultTextStyle } from "./types";

interface BuilderContextValue {
  state: BuilderState;
  autoSaveFailed: boolean;
  autoSaveError: string | null;
  activeProviders: string[];
  selectedRole: RoleType | null;
  selectedStore: Store | null;
  selectedChannel: Channel | null;
  selectedCollection: Collection | null;
  setSourceType: (type: SourceType) => void;
  loadBld: (definition: Record<string, any>) => void;
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
  refreshPlacements: () => void;
  setSelectedCatalogId: (id: string) => void;
  setActivePacketId: (id: string | null) => void;
  setActiveSession: (id: string | null, status: 'working' | 'artifact_ready' | 'committed' | null, instanceId: string | null) => void;
  setProductDescription: (description: string | null, source?: TextLayerSource) => void;
  setProductTitle: (title: string | null, source?: TextLayerSource) => void;
  resetBuilder: () => void;
  saveWorking: (draftName?: string) => Promise<Record<string, any>>;
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
  qrBasicInputType: 'text' as 'text' | 'url',
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
  placementsRestoreWarning: null,
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
  selectedBldId: null,
  providerLayout: null,
};

interface BuilderProviderProps {
  children: React.ReactNode;
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

export function BuilderProvider({ children }: BuilderProviderProps) {
  const { api, selectedProviders, selectedRole, selectedStore, selectedChannel, selectedCollection, setSelectedProviders, setSelectedRole, setSelectedStore, setSelectedChannel, setSelectedCollection } = useProductsContext();
  const [state, setState] = useState<BuilderState>(initialState);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const cachedAuthHeadersRef = useRef<Record<string, string> | null>(null);
  const flushSaveRef = useRef<(() => void) | null>(null);
  // Stable ref so fetchOptionsForProduct (useCallback with [] deps) always reads the latest provider
  const fulfillmentProviderRef = useRef<string>(state.fulfillmentProvider || 'printify');

  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const persistWorking = useCallback((sessionId: string, snapshot: Record<string, any>, draftName?: string) => {
    const save = saveQueueRef.current.catch(() => undefined).then(() => adminFetch(`/build-sessions/${sessionId}`, {
      method: 'PATCH', json: { working: snapshot, ...(draftName !== undefined ? { draftName } : {}) },
    }));
    saveQueueRef.current = save;
    return save;
  }, []);
  const saveWorking = useCallback(async (draftName?: string) => {
    if (!state.activeSessionId) throw new Error('Select a product before saving.');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const snapshot = sanitizeSnapshot(buildWorkingSnapshot(state, { selectedRole, selectedStore, selectedChannel, selectedCollection }));
    await persistWorking(state.activeSessionId, snapshot, draftName);
    setAutoSaveFailed(false);
    setAutoSaveError(null);
    return snapshot;
  }, [state, selectedRole, selectedStore, selectedChannel, selectedCollection, persistWorking]);

  // Subscribe to auth state so the keepalive cache is primed the moment Firebase
  // resolves the user — even on first load when auth.currentUser is still null.
  // Also refreshes whenever the session is renewed (e.g. after a token rotation).
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        user.getIdToken(false).then(token => {
          if (token) cachedAuthHeadersRef.current = { Authorization: `Bearer ${token}` };
        }).catch((err) => {
          console.warn('[BuilderContext] onAuthStateChanged: getIdToken failed —', err?.message || err);
        });
      } else {
        cachedAuthHeadersRef.current = null;
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const activeProvider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";
    setState(prev => {
      if (prev.fulfillmentProvider !== activeProvider) {
        return { ...prev, fulfillmentProvider: activeProvider };
      }
      return prev;
    });
  }, [selectedProviders]);

  // Keep ref in sync so async fetch closures always read the current provider
  useEffect(() => {
    fulfillmentProviderRef.current = state.fulfillmentProvider || 'printify';
  }, [state.fulfillmentProvider]);

  useEffect(() => {
    if (!state.activeSessionId) {
      flushSaveRef.current = null;
      return;
    }

    // Don't attempt to PATCH a finalized session — the server will reject it with 409.
    if (state.sessionStatus === 'committed' || state.sessionStatus === 'abandoned') {
      flushSaveRef.current = null;
      setAutoSaveFailed(false);
      setAutoSaveError(null);
      return;
    }

    // Build snapshot immediately so flushSaveRef always has the latest data,
    // even if the 1.5-second debounce timer hasn't fired yet when the user navigates away.
    const snapshot = buildWorkingSnapshot(state, { selectedRole, selectedStore, selectedChannel, selectedCollection });
    const cleanSnapshot = sanitizeSnapshot(snapshot);
    const sessionId = state.activeSessionId;

    flushSaveRef.current = () => {
      const headers = cachedAuthHeadersRef.current;
      if (!headers) return;
      fetch(`/api/admin/build-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ working: cleanSnapshot }),
        keepalive: true,
      }).catch(() => {});
    };

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.warn('[BuilderContext] Auto-save: auth.currentUser is null — keepalive cache not refreshed. Session save will still proceed via adminFetch.');
        } else {
          const token = await currentUser.getIdToken(true);
          if (token) {
            cachedAuthHeadersRef.current = { Authorization: `Bearer ${token}` };
          }
        }

        // Primary: save full working state into the build session
        console.log(
          `[BuilderContext] Auto-saving to session ${sessionId}` +
          ` | keys: ${Object.keys(cleanSnapshot).join(',')}` +
          ` | bg: ${cleanSnapshot.graphics?.loadedBackground ? 'yes' : 'no'}` +
          ` | tpl: ${cleanSnapshot.graphics?.loadedTemplate ? 'yes' : 'no'}` +
          ` | gfx: ${cleanSnapshot.graphics?.loadedGraphic ? 'yes' : 'no'}` +
          ` | placements: ${JSON.stringify(cleanSnapshot.layoutConfig?.selectedPlacements ?? [])}`,
        );
        await persistWorking(sessionId, cleanSnapshot);
        setAutoSaveFailed(false);
        setAutoSaveError(null);
        console.log(`[BuilderContext] Auto-save OK — session ${sessionId}`);

        // Packet snapshots are frozen render inputs. Draft edits stay in session.working.
      } catch (e: any) {
        const rawMsg = e?.message || String(e) || "Unknown error";
        // Extract just the HTTP status + server detail for display — the full URL prefix is noise.
        // adminFetch format: "[adminFetch] PATCH /api/admin/... → 409 Conflict — detail"
        const arrowMatch = rawMsg.match(/→ (.+)$/);
        const displayMsg = arrowMatch ? arrowMatch[1] : rawMsg;
        console.warn("[BuilderContext] Auto-save failed:", rawMsg);
        setAutoSaveFailed(true);
        setAutoSaveError(displayMsg);
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
    state.adminCatalogDescription,
    state.activeSessionId,
    state.sessionStatus,
    state.activePacketId,
    state.selectedCatalogId,
    state.selectedBldId,
    selectedRole,
    selectedStore,
    selectedChannel,
    selectedCollection,
  ]);

  // Flush any pending save when this component unmounts (e.g. user navigates away
  // before the 1.5-second debounce fires). Uses keepalive:true so the fetch
  // completes even after the component is gone.
  useEffect(() => {
    return () => {
      const hasFlush = !!flushSaveRef.current;
      const hasHeaders = !!cachedAuthHeadersRef.current;
      console.log(`[BuilderContext] unmount flush | hasFlush: ${hasFlush} | hasHeaders: ${hasHeaders}`);
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
    if (!auth.currentUser) {
      console.warn('[BuilderContext] Session active but auth.currentUser is null — onAuthStateChanged will prime the cache once auth resolves.');
      return;
    }
    auth.currentUser.getIdToken(true).then(token => {
      if (token) cachedAuthHeadersRef.current = { Authorization: `Bearer ${token}` };
    }).catch((err) => {
      console.warn('[BuilderContext] Session-activation token refresh failed —', err?.message || err);
    });
  }, [state.activeSessionId]);

  // Periodic token refresh while a session is active — tokens expire after 1 hour.
  // Refreshing every 45 minutes ensures the keepalive flush-on-unmount always
  // sends a valid bearer token even if the user leaves the builder tab open for a long time.
  useEffect(() => {
    if (!state.activeSessionId) return;
    const REFRESH_MS = 45 * 60 * 1000;
    const intervalId = setInterval(() => {
      auth.currentUser?.getIdToken(true).then(token => {
        if (token) {
          cachedAuthHeadersRef.current = { Authorization: `Bearer ${token}` };
          console.log('[BuilderContext] Periodic token refresh — keepalive cache updated.');
        }
      }).catch((err) => {
        console.warn('[BuilderContext] Periodic token refresh failed —', err?.message || err);
      });
    }, REFRESH_MS);
    return () => clearInterval(intervalId);
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
        return { ...prev, placementsLoading: false, placementsRestoreWarning: null };
      });
      return;
    }

    // Resolve which provider to query.
    // Priority: product's own fulfillmentProvider > global ref > 'printify' default.
    //
    // WHY product-first: setSelectedProviders(['printful']) and selectProduct() are called
    // synchronously in handleCardSelect. The state update from setSelectedProviders must
    // propagate through two React effect hops before fulfillmentProviderRef.current updates,
    // but fetchOptionsForProduct runs immediately — so the ref is always stale on first call.
    // The product.fulfillmentProvider field is set by the catalog browse API at selection
    // time and is immediately available, making it the correct race-condition-free source.
    const rawProvider = fulfillmentProviderRef.current;
    const productProvider =
      product.fulfillmentProvider
        ? product.fulfillmentProvider
        : null;
    const provider =
      productProvider ||
      (!rawProvider || rawProvider === 'both' ? 'printify' : rawProvider);
    adminFetch<any>(`/master-catalog/products/${docId}/options?provider=${encodeURIComponent(provider)}`)
      .then(options => {
        setState(prev => {
          if (prev.selectedProduct?.docId !== docId) return prev;

          // Map QRG print locations → builder ProductPlacement shape.
          // Preserve the full provider layout data from the print_placements crosswalk
          // so togglePlacement can derive providerLayout and the renderer can use
          // provider-correct dimensions instead of hardcoded FALLBACK_PLACEMENT_DIMENSIONS.
          const printLocations: ProductPlacement[] = (options.printLocations || []).map((pl: any) => ({
            id: pl.id,
            type: pl.id,
            title: pl.label || pl.id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            additionalPrice: 0,
            methods: [],
            provider: pl.provider,
            providerPlacement: pl.providerPlacement,
            providerPlacementId: pl.providerPlacementId || pl.providerPlacement || pl.id,
            sourceTable: pl.sourceTable || null,
            rawProviderPlacement: pl.rawProviderPlacement || null,
            dimensions: pl.dimensions || null,
            printArea: pl.printArea || (pl.dimensions
              ? { widthPx: pl.dimensions.widthPx, heightPx: pl.dimensions.heightPx }
              : null),
            safeArea: pl.safeArea || null,
            dpi: pl.dpi || pl.dimensions?.dpi || 300,
            canonicalLocationCode: pl.canonicalLocationCode || pl.id,
            layoutSource: pl.layoutSource || null,
          }));

          // Prefer real {name,hex} colors from options — the /options endpoint now builds
          // these from providerMappings. Fall back to whatever was set at selection time.
          const optionsColors: Array<{ name: string; hex: string }> = options.availableColors || [];
          const hasRealColors = optionsColors.length > 0 && typeof optionsColors[0]?.hex === 'string';

          const merged: CatalogProduct = {
            ...prev.selectedProduct!,
            placements: printLocations.length > 0 ? printLocations : (prev.selectedProduct!.placements || []),
            printLocations: options.printLocations || [],
            qrgBlankId: options.qrgBlankId || prev.selectedProduct!.qrgBlankId,
            qrgVariants: options.qrgVariants || {},
            providerMappings: options.providerMappings || prev.selectedProduct!.providerMappings,
            availableColors: hasRealColors ? optionsColors : (prev.selectedProduct!.availableColors || []),
            // Schema-first fields resolved from QRG STNNN digits — identify product type
            // before any provider query. Persisted into providerLayout on placement select.
            schemaFamily: options.schemaFamily || null,
            schemaType: options.schemaType || null,
            canonicalProfilePath: options.canonicalProfilePath || null,
            layoutSource: options.layoutSource || null,
            providerProductId: options.provider?.printfulProductId || null,
            optionsLoaded: true,
          };

          // Validate restored placements against the freshly-fetched placement list.
          // If any saved placement no longer exists (e.g. left_chest was in legacy cache
          // but Printful product doesn't actually have it), deselect and warn the user.
          const validPlacementIds = new Set(printLocations.map(p => p.id));
          const restoredSelected = prev.selectedPlacements || [];
          const invalidRestored = restoredSelected.filter(id => !validPlacementIds.has(id));
          const validSelected = restoredSelected.filter(id => validPlacementIds.has(id));
          const restoreWarning = (invalidRestored.length > 0 && restoredSelected.length > 0)
            ? `Saved placement${invalidRestored.length > 1 ? 's' : ''} "${invalidRestored.join('", "')}" ${invalidRestored.length > 1 ? 'are' : 'is'} not available for this product. ${invalidRestored.length > 1 ? 'They have' : 'It has'} been deselected — please reselect a placement.`
            : null;

          return {
            ...prev,
            selectedProduct: merged,
            placementsLoading: false,
            placementsError: null,
            placementsRestoreWarning: restoreWarning,
            selectedPlacements: validSelected,
          };
        });
      })
      .catch(err => {
        console.error('[BuilderContext] Failed to fetch product options:', err);
        setState(prev => {
          if (prev.selectedProduct?.docId !== docId) return prev;
          return { ...prev, placementsLoading: false, placementsError: err?.message || 'Failed to load product options', placementsRestoreWarning: null };
        });
      });
  }, []);

  // Re-fetch placements when the fulfillment provider changes while a product is selected.
  // The ref sync effect runs first (defined earlier), so fulfillmentProviderRef.current is
  // already updated by the time fetchOptionsForProduct reads it.
  useEffect(() => {
    const product = state.selectedProduct;
    if (!product?.docId || !product.optionsLoaded) return;
    setState(prev => ({ ...prev, placementsLoading: true, placementsError: null, placementsRestoreWarning: null }));
    fetchOptionsForProduct(product);
  }, [state.fulfillmentProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectProduct = useCallback((product: CatalogProduct | null) => {
    if (!product) {
      setState(prev => ({ ...prev, selectedProduct: null, masterTitle: null, adminCatalogTitle: null, masterDescription: null, productDescription: null, adminCatalogDescription: null, placementsLoading: false, placementsError: null, placementsRestoreWarning: null }));
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
      placementsRestoreWarning: null,
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

  const loadBld = useCallback((definition: Record<string, any>) => {
    // Validate before React's updater so the picker can display a useful error.
    const content = applyBuilderBld(definition, state.content);
    setState(prev => ({ ...prev, content: content as ContentData, selectedBldId: definition.bldId }));
  }, [state.content]);

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

      // Derive providerLayout from the primary (first) selected placement.
      // Schema-first: schemaFamily/schemaType/canonicalProfilePath come from the
      // product (set by fetchOptionsForProduct from the /options response).
      // This ensures the renderer and BLD use provider-correct dimensions, not
      // hardcoded FALLBACK_PLACEMENT_DIMENSIONS. Only updated when the primary
      // placement changes — otherwise keep the existing providerLayout.
      const primaryId = newPlacements[0] || null;
      const primaryPlacement = primaryId
        ? prev.selectedProduct?.placements?.find(p => p.id === primaryId)
        : null;
      const newProviderLayout: ProviderLayout | null = (primaryPlacement?.provider && primaryPlacement.dimensions)
        ? {
            provider: primaryPlacement.provider,
            schemaFamily: prev.selectedProduct?.schemaFamily || '',
            schemaType: prev.selectedProduct?.schemaType || '',
            canonicalProfilePath: prev.selectedProduct?.canonicalProfilePath || '',
            canonicalLocationCode: primaryPlacement.id,
            providerPlacementId: primaryPlacement.providerPlacement || primaryPlacement.id,
            label: primaryPlacement.title,
            dimensions: primaryPlacement.dimensions,
            printArea: primaryPlacement.printArea
              || { widthPx: primaryPlacement.dimensions.widthPx, heightPx: primaryPlacement.dimensions.heightPx },
            safeArea: primaryPlacement.safeArea || null,
            dpi: primaryPlacement.dpi || primaryPlacement.dimensions?.dpi || 300,
            layoutSource: primaryPlacement.layoutSource || prev.selectedProduct?.layoutSource || undefined,
            sourceTable: primaryPlacement.sourceTable || undefined,
          }
        : prev.providerLayout;

      return {
        ...prev,
        selectedPlacements: newPlacements,
        placementConfig: newConfig,
        placementSizes: newSizes,
        placementMethods: newMethods,
        providerLayout: newProviderLayout,
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

  const refreshPlacements = useCallback(() => {
    setState(prev => {
      const product = prev.selectedProduct;
      if (!product?.docId) return prev;
      // Schedule the fetch after this state update so placementsLoading is already true
      setTimeout(() => fetchOptionsForProduct(product), 0);
      return { ...prev, placementsLoading: true, placementsError: null, placementsRestoreWarning: null };
    });
  }, [fetchOptionsForProduct]);

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

    // Restore role → store → channel → collection in dependency order
    console.log(
      `[BuilderContext] loadFromWorkingState` +
      ` | channel: ${metadata.selectedChannel?.name ?? "null"}` +
      ` | store: ${metadata.selectedStore?.name ?? "null"}` +
      ` | graphics: ${working.graphics ? `content-keys:${Object.keys(graphics.content || {}).length} bg:${graphics.loadedBackground ? "yes" : "no"} tpl:${graphics.loadedTemplate ? "yes" : "no"} gfx:${graphics.loadedGraphic ? "yes" : "no"}` : "null"}` +
      ` | qrConfig: ${working.qrConfig ? `state:${qrConfig.qrProductState}` : "null"}` +
      ` | placements: ${JSON.stringify(layoutConfig.selectedPlacements ?? [])}` +
      ` | product: ${resolvedProduct?.title ?? "null"}`,
    );
    if (metadata.fulfillmentProvider) setSelectedProviders([metadata.fulfillmentProvider]);
    setSelectedRole((metadata.selectedRole ?? null) as RoleType | null);
    setSelectedStore((metadata.selectedStore ?? null) as Store | null);
    setSelectedChannel((metadata.selectedChannel ?? null) as Channel | null);
    setSelectedCollection((metadata.selectedCollection ?? null) as Collection | null);

    const product = resolvedProduct ? { ...resolvedProduct, fulfillmentProvider: metadata.fulfillmentProvider ?? resolvedProduct.fulfillmentProvider } : null;
    // Always re-fetch options on load — the saved product may have stale/partial
    // placements (e.g. only 'front' from a previous session). Setting optionsLoaded:false
    // above is not enough because needsOptionsFetch was computed from the original value.
    const needsOptionsFetch = !!product;

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
      adminCatalogDescription: working.adminCatalogDescription ?? working.description ?? null,
      descriptionSource: (working.descriptionSource as TextLayerSource) ?? null,
      selectedProduct: product ? { ...product, optionsLoaded: false } : null,
      placementsLoading: needsOptionsFetch,
      placementsError: null,
      placementsRestoreWarning: null,
      activePacketId: null,
      selectedBldId: metadata.selectedBldId ?? null,
      selectedCatalogId: (metadata.selectedCatalogId as string) ?? "all",
      fulfillmentProvider: (metadata.fulfillmentProvider as string) ?? prev.fulfillmentProvider,
      category: (metadata.category as string) ?? null,
      originFilter: (metadata.originFilter as OriginFilter) ?? prev.originFilter,
      genderFilter: (metadata.genderFilter as GenderFilter) ?? prev.genderFilter,
      sourceType: (metadata.sourceType as SourceType) ?? prev.sourceType,
      // Restore persisted provider layout so renderer uses correct dims on session reload.
      // Primary path: working.providerLayout (BLD-conformant location, written since this fix).
      // Fallback: working.bld?.providerLayout (legacy sessions written before the fix).
      providerLayout: (working.providerLayout ?? working.bld?.providerLayout ?? null) as ProviderLayout | null,
    }));

    if (needsOptionsFetch && product) {
      fetchOptionsForProduct(product);
    }
  }, [setSelectedProviders, setSelectedRole, setSelectedStore, setSelectedChannel, setSelectedCollection, fetchOptionsForProduct]);

  const buildBaselineSnapshot = (
    packetData: Record<string, any>,
    content: Partial<ContentData>,
    selectedPlacements: string[],
    selectedColorName: string | null,
    backgroundUrl: string | null,
    blueprintId: number | null,
  ): string => {
    const h: Partial<ContentData['headerStyle']> = content.headerStyle || {};
    const f: Partial<ContentData['footerStyle']> = content.footerStyle || {};
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
    const working = requireBuilderSnapshot(packetData.builderSnapshot);
    working.metadata.selectedBldId = packetData.bldId || working.metadata.selectedBldId || null;
    loadFromWorkingState(working, resolvedProduct);
    const content = working.graphics.content;
    setState(prev => ({ ...prev, templateBaseline: buildBaselineSnapshot(
      packetData, content, working.layoutConfig.selectedPlacements,
      working.qrConfig.selectedColor?.name ?? null, working.graphics.loadedBackground?.url ?? null,
      resolvedProduct?.blueprintId ?? null,
    ) }));
  }, [loadFromWorkingState]);

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
    autoSaveError,
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
    loadBld,
    togglePlacement,
    setPlacementType,
    setPlacementSize,
    setPlacementMethod,
    setSelectedColor,
    refreshPlacements,
    setSelectedCatalogId,
    setActivePacketId,
    setActiveSession,
    setProductDescription,
    setProductTitle,
    resetBuilder,
    saveWorking,
    loadFromPacketData,
    loadFromWorkingState,
    hasChangesFromBaseline,
    setTemplateProductResolved,
    api,
  }), [state, autoSaveFailed, autoSaveError, selectedProviders, selectedRole, selectedStore, selectedChannel, selectedCollection, setSourceType, loadTemplate, loadGraphic, loadBackground, setFulfillmentProvider, setCategory, setSelectedCatalogId, setOriginFilter, setGenderFilter, selectProduct, setQRProductState, setContent, loadBld, togglePlacement, setPlacementType, setPlacementSize, setPlacementMethod, setSelectedColor, refreshPlacements, setActivePacketId, setActiveSession, setProductDescription, setProductTitle, resetBuilder, saveWorking, loadFromPacketData, loadFromWorkingState, hasChangesFromBaseline, setTemplateProductResolved, api]);

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
