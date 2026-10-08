import { applyAiProductProposal, type AiProductProposal } from '@shared/aiProductBuilder';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBuildCatalog, resolveBuildProduct } from './restoreProduct';
import { isQRGBlankId } from '@shared/blankKeys';
import { normalizeProductColors, normalizeProductSizes } from '@shared/adapters/catalog.adapter';
import { buildWorkingSnapshot, sanitizeSnapshot, requireBuilderSnapshot } from '@shared/builderSnapshot';
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useProductsContext } from "../ProductsContext";
import { adminFetch } from "@/lib/adminFetch";
import { auth } from "@/lib/firebase";
import type { SourceType, LoadedTemplate, LoadedGraphic, LoadedBackground, BuilderState, OriginFilter, GenderFilter, CatalogProduct, QRProductState, ContentData, PlacementType, PlacementConfig, PlacementSize, PlacementSizeConfig, SelectedColor, PrintMethodSelection, TemplateProductHint, TextLayerSource, ProviderLayout, ProductPlacement } from "./types";
import type { RoleType, Store, Channel, Collection } from "../shared/types";
import { defaultTextStyle, DEFAULT_QR_PRODUCT_STATE, QR_PRODUCT_STATES } from "./types";

interface BuilderContextValue {
  state: BuilderState;
  qrTypePreferenceSaving: boolean;
  qrTypePreferenceError: string | null;
  retryQRTypePreference: () => void;
  autoSaveFailed: boolean;
  autoSaveError: string | null;
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
  selectProduct: (product: CatalogProduct | null) => () => boolean;
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
  setActiveSession: (id: string | null, status: 'working' | 'artifact_ready' | 'committed' | null, instanceId: string | null, draftName?: string | null) => void;
  setProductDescription: (description: string | null, source?: TextLayerSource) => void;
  setProductTitle: (title: string | null, source?: TextLayerSource) => void;
  resetBuilder: () => Promise<void>;
  resumeSession: (id: string) => Promise<void>;
  startFromTemplate: (template: { packet?: any; packetId?: string | null; builderSnapshot?: any }) => Promise<void>;
  busy: string | null;
  beginBuildActivity: (label: string) => () => void;
  applyAiProposal: (proposal: AiProductProposal, base: string) => void;
  saveDraft: (name: string) => Promise<void>;
  saveWorking: (draftName?: string) => Promise<Record<string, any>>;
  loadFromPacketData: (packetData: Record<string, any>, resolvedProduct?: CatalogProduct | null) => void;
  loadFromWorkingState: (working: Record<string, any>, resolvedProduct?: CatalogProduct | null) => void;
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
  draftName: null,
  forceNewSession: false,
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
  qrProductState: DEFAULT_QR_PRODUCT_STATE,
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

function getProviderLayout(product: CatalogProduct | null, placementId?: string): ProviderLayout | null {
  const placement = product?.placements?.find(p => p.id === placementId);
  if (!placement?.provider || !placement.dimensions) return null;
  return {
    provider: placement.provider,
    schemaFamily: product?.schemaFamily || '',
    schemaType: product?.schemaType || '',
    canonicalProfilePath: product?.canonicalProfilePath || '',
    canonicalLocationCode: placement.canonicalLocationCode || placement.id,
    providerPlacementId: placement.providerPlacementId || placement.providerPlacement || placement.id,
    label: placement.title,
    dimensions: placement.dimensions,
    printArea: placement.printArea || { widthPx: placement.dimensions.widthPx, heightPx: placement.dimensions.heightPx },
    safeArea: placement.safeArea || null,
    dpi: placement.dpi || placement.dimensions.dpi || 300,
    layoutSource: placement.layoutSource || product?.layoutSource || undefined,
    sourceTable: placement.sourceTable || undefined,
  };
}

export function BuilderProvider({ children }: BuilderProviderProps) {
  const { api, selectedProviders, selectedRole, selectedStore, selectedChannel, selectedCollection, setSelectedProviders, setSelectedRole, setSelectedStore, setSelectedChannel, setSelectedCollection } = useProductsContext();
  const [state, setState] = useState<BuilderState>(initialState);
  const queryClient = useQueryClient();
  const preferredQRTypeRef = useRef<QRProductState>(DEFAULT_QR_PRODUCT_STATE);
  const qrTypeChosenOrRestoredRef = useRef(false);
  const qrTypeSaveVersionRef = useRef(0);
  const qrTypeSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [qrTypePreferenceSaving, setQRTypePreferenceSaving] = useState(false);
  const [qrTypeSaveError, setQRTypeSaveError] = useState<string | null>(null);
  const qrTypePreferences = useQuery<{ defaultQRProductState?: QRProductState }>({
    queryKey: ["/api/admin/settings"],
    queryFn: () => adminFetch("/settings"),
    staleTime: Infinity,
  });
  useEffect(() => {
    // A late settings response must not replace a manual choice or a restored build.
    if (!qrTypePreferences.data || qrTypeSaveVersionRef.current > 0) return;
    const saved = qrTypePreferences.data.defaultQRProductState;
    const preferred = QR_PRODUCT_STATES.some(type => type.id === saved) ? saved! : DEFAULT_QR_PRODUCT_STATE;
    preferredQRTypeRef.current = preferred;
    if (!qrTypeChosenOrRestoredRef.current) setState(prev => ({ ...prev, qrProductState: preferred }));
  }, [qrTypePreferences.data]);
  const [busy, setBusy] = useState<string | null>(null);
  const activityRef = useRef(false);
  const mountedRef = useRef(true);
  const currentStateRef = useRef(state);
  currentStateRef.current = state;
  const saveVersionRef = useRef(0);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const beginBuildActivity = useCallback((label: string) => {
    if (activityRef.current) throw new Error('Please wait for the current build action to finish.');
    activityRef.current = true;
    setBusy(label);
    return () => { activityRef.current = false; if (mountedRef.current) setBusy(null); };
  }, []);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const cachedAuthHeadersRef = useRef<Record<string, string> | null>(null);
  const flushSaveRef = useRef<(() => void) | null>(null);
  // Stable ref so fetchOptionsForProduct (useCallback with [] deps) always reads the latest provider
  const fulfillmentProviderRef = useRef<string>(state.fulfillmentProvider || 'printify');

  // Selection ownership is shared by options loading and the session handoff.
  const selectionVersionRef = useRef(0);
  const optionsVersionRef = useRef(0);

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
    if (state.sessionStatus === 'committed' || state.sessionStatus === 'abandoned') throw new Error('Use Update Saved Item before editing this build.');
    ++saveVersionRef.current;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const snapshot = sanitizeSnapshot(buildWorkingSnapshot(state, { selectedRole, selectedStore, selectedChannel, selectedCollection }));
    await persistWorking(state.activeSessionId, snapshot, draftName);
    if (mountedRef.current && currentStateRef.current.activeSessionId === state.activeSessionId) {
      setAutoSaveFailed(false);
      setAutoSaveError(null);
      if (draftName !== undefined) setState(prev => prev.activeSessionId === state.activeSessionId ? { ...prev, draftName } : prev);
    }
    return snapshot;
  }, [state, selectedRole, selectedStore, selectedChannel, selectedCollection, persistWorking]);

  const applyAiProposal = useCallback((proposal: AiProductProposal, base: string) => {
    if (activityRef.current) throw new Error('Wait for the current build action to finish.');
    const current = currentStateRef.current;
    if (!current.activeSessionId || !['working', 'artifact_ready'].includes(current.sessionStatus || '')) throw new Error('Open an editable draft first.');
    const next = applyAiProductProposal(buildWorkingSnapshot(current, { selectedRole, selectedStore, selectedChannel, selectedCollection }), proposal, base);
    setState(prev => ({ ...prev, adminCatalogTitle: next.title, titleSource: next.titleSource,
      productDescription: next.description, adminCatalogDescription: next.adminCatalogDescription,
      descriptionSource: next.descriptionSource, content: { ...prev.content, ...next.graphics.content } }));
  }, [selectedRole, selectedStore, selectedChannel, selectedCollection]);

  const saveDraft = useCallback(async (name: string) => {
    if (!name.trim()) throw new Error('Enter a draft name.');
    const finish = beginBuildActivity('Saving draft…');
    try { await saveWorking(name.trim()); } finally { finish(); }
  }, [beginBuildActivity, saveWorking]);

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

    const saveVersion = ++saveVersionRef.current;
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

        if (saveVersion !== saveVersionRef.current || !mountedRef.current) return;
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
        if (!mountedRef.current || currentStateRef.current.activeSessionId !== sessionId) return;
        setAutoSaveFailed(false);
        setAutoSaveError(null);
        console.log(`[BuilderContext] Auto-save OK — session ${sessionId}`);

        // Packet snapshots are frozen render inputs. Draft edits stay in session.working.
      } catch (e: any) {
        if (!mountedRef.current || currentStateRef.current.activeSessionId !== sessionId) return;
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
      ++saveVersionRef.current;
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
    }));
  }, []);

  const setSelectedCatalogId = useCallback((id: string) => {
    setState(prev => ({ ...prev, selectedCatalogId: id }));
  }, []);

  const setOriginFilter = useCallback((filter: Partial<OriginFilter>) => {
    setState(prev => ({
      ...prev,
      originFilter: { ...prev.originFilter, ...filter },
    }));
  }, []);

  const setGenderFilter = useCallback((filter: GenderFilter) => {
    setState(prev => ({
      ...prev,
      genderFilter: filter,
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
  // and loadFromPacketData. Responses belong to one selection and provider request.
  const fetchOptionsForProduct = useCallback((product: CatalogProduct, refreshPrintSpecs = false) => {
    const docId = product.docId;
    const selectionVersion = selectionVersionRef.current;
    const optionsVersion = ++optionsVersionRef.current;
    const isCurrent = () => selectionVersion === selectionVersionRef.current && optionsVersion === optionsVersionRef.current;
    if (!docId || !isQRGBlankId(docId)) {
      console.warn('[BuilderContext] Product missing qrg_ docId, skipping options fetch:', docId);
      setState(prev => {
        if (!isCurrent() || prev.selectedProduct?.docId !== docId) return prev;
        return { ...prev, placementsLoading: false, placementsError: 'Select a classified QRG blank before building.', placementsRestoreWarning: null };
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
    adminFetch<any>(`/master-catalog/products/${docId}/options?provider=${encodeURIComponent(provider)}${refreshPrintSpecs ? '&refreshPrintSpecs=true' : ''}${product.catalogId && product.catalogId !== "all" ? `&catalogId=${encodeURIComponent(product.catalogId)}` : ""}`)
      .then(options => {
        setState(prev => {
          if (!isCurrent() || prev.selectedProduct?.docId !== docId) return prev;

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

          const merged: CatalogProduct = {
            ...prev.selectedProduct!,
            placements: printLocations,
            printLocations: options.printLocations || [],
            qrgBlankId: options.qrgBlankId || prev.selectedProduct!.qrgBlankId,
            qrgVariants: options.qrgVariants || {},
            providerMappings: options.providerMappings || prev.selectedProduct!.providerMappings,
            availableColors: normalizeProductColors({ availableColors: options.availableColors || [] }),
            availableSizes: normalizeProductSizes({ availableSizes: options.availableSizes || [] }),
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
            placementConfig: Object.fromEntries(Object.entries(prev.placementConfig).filter(([id]) => validPlacementIds.has(id))),
            placementSizes: Object.fromEntries(Object.entries(prev.placementSizes).filter(([id]) => validPlacementIds.has(id))),
            placementMethods: Object.fromEntries(Object.entries(prev.placementMethods).filter(([id]) => validPlacementIds.has(id))),
            providerLayout: getProviderLayout(merged, validSelected[0]),
            selectedColor: merged.availableColors.find(color => color.name === prev.selectedColor?.name) ?? null,
          };
        });
      })
      .catch(err => {
        console.error('[BuilderContext] Failed to fetch product options:', err);
        setState(prev => {
          if (!isCurrent() || prev.selectedProduct?.docId !== docId) return prev;
          return { ...prev, placementsLoading: false, placementsError: err?.message || 'Failed to load product options', placementsRestoreWarning: null };
        });
      });
  }, []);

  // A provider change belongs to the same QRG blank but requires new print options.
  useEffect(() => {
    const product = state.selectedProduct;
    const provider = state.fulfillmentProvider;
    if (!product?.docId || !provider || product.fulfillmentProvider === provider) return;
    const nextProduct = { ...product, fulfillmentProvider: provider as CatalogProduct['fulfillmentProvider'], optionsLoaded: false, placements: [], printLocations: [], availableColors: [], availableSizes: [] };
    setState(prev => ({ ...prev, selectedProduct: nextProduct, selectedColor: null,
      selectedPlacements: [], placementConfig: {}, placementSizes: {}, placementMethods: {},
      providerLayout: null, activePacketId: null, loadedGraphic: null,
      placementsLoading: true, placementsError: null, placementsRestoreWarning: null }));
    fetchOptionsForProduct(nextProduct);
  }, [state.fulfillmentProvider, state.selectedProduct?.docId, fetchOptionsForProduct]);

  const selectProduct = useCallback((product: CatalogProduct | null) => {
    const version = ++selectionVersionRef.current;
    ++optionsVersionRef.current;
    const isCurrent = () => version === selectionVersionRef.current;
    const provider = product?.fulfillmentProvider || fulfillmentProviderRef.current;
    const nextProduct = product ? { ...product, fulfillmentProvider: provider as CatalogProduct['fulfillmentProvider'], optionsLoaded: false, placements: [], printLocations: [] } : null;
    if (product) setSelectedProviders([provider]);

    // Creative inputs/BLD may be reused; blank-specific options and output may not.
    setState(prev => ({
      ...prev,
      selectedProduct: nextProduct,
      fulfillmentProvider: provider,
      masterTitle: product?.title || null,
      masterDescription: product?.description || null,
      adminCatalogTitle: null,
      adminCatalogDescription: null,
      productDescription: product?.description || null,
      titleSource: product ? 'provider' : null,
      descriptionSource: product ? 'provider' : null,
      selectedColor: null,
      selectedPlacements: [],
      placementConfig: {},
      placementSizes: {},
      placementMethods: {},
      providerLayout: null,
      activeSessionId: null,
      draftName: null,
      sessionStatus: null,
      committedInstanceId: null,
      activePacketId: null,
      loadedGraphic: null,
      templateProductHint: null,
      placementsLoading: !!product,
      placementsError: null,
      placementsRestoreWarning: null,
    }));
    if (nextProduct) fetchOptionsForProduct(nextProduct);
    return isCurrent;
  }, [fetchOptionsForProduct, setSelectedProviders]);

  const setQRProductState = useCallback((qrState: QRProductState) => {
    qrTypeChosenOrRestoredRef.current = true;
    setState(prev => prev.qrProductState === qrState ? prev : ({
      ...prev,
      qrProductState: qrState,
      content: initialContent,
      selectedPlacements: [],
      placementConfig: {},
      placementSizes: {},
      placementMethods: {},
    }));
    if (!qrState) return;
    preferredQRTypeRef.current = qrState;
    const version = ++qrTypeSaveVersionRef.current;
    setQRTypePreferenceSaving(true);
    setQRTypeSaveError(null);
    // Serialize writes so a slower earlier tap cannot overwrite the latest choice.
    const save = qrTypeSaveQueueRef.current.catch(() => undefined).then(() =>
      adminFetch("/settings", { method: "PUT", json: { defaultQRProductState: qrState } }));
    qrTypeSaveQueueRef.current = save;
    void save.then(() => {
      if (version !== qrTypeSaveVersionRef.current) return;
      queryClient.setQueryData(["/api/admin/settings"], (previous: any) => ({ ...previous, defaultQRProductState: qrState }));
      if (mountedRef.current) setQRTypePreferenceSaving(false);
    }).catch(() => {
      if (mountedRef.current && version === qrTypeSaveVersionRef.current) {
        setQRTypePreferenceSaving(false);
        setQRTypeSaveError("Could not save your Product Type choice.");
      }
    });
  }, [queryClient]);
  const qrTypePreferenceError = qrTypeSaveError || (qrTypePreferences.error && qrTypeSaveVersionRef.current === 0
    ? "Could not load your saved Product Type." : null);
  const retryQRTypePreference = useCallback(() => {
    if (qrTypeSaveError) setQRProductState(preferredQRTypeRef.current);
    else void qrTypePreferences.refetch();
  }, [qrTypeSaveError, setQRProductState, qrTypePreferences.refetch]);

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

      const newProviderLayout = getProviderLayout(prev.selectedProduct, newPlacements[0]);

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
      setTimeout(() => fetchOptionsForProduct(product, true), 0);
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
    draftName?: string | null,
  ) => {
    setState(prev => ({
      ...prev,
      activeSessionId: id,
      forceNewSession: id ? false : prev.forceNewSession,
      draftName: draftName !== undefined ? draftName : (id === prev.activeSessionId ? prev.draftName : null),
      sessionStatus: status,
      committedInstanceId: instanceId,
    }));
  }, []);

  const loadFromWorkingState = useCallback((working: Record<string, any>, resolvedProduct?: CatalogProduct | null) => {
    ++selectionVersionRef.current;
    ++optionsVersionRef.current;
    const graphics = (working.graphics || {}) as Record<string, any>;
    const qrConfig = (working.qrConfig || {}) as Record<string, any>;
    if (qrConfig.qrProductState) qrTypeChosenOrRestoredRef.current = true;
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

    const product = resolvedProduct ? { ...resolvedProduct, catalogId: metadata.selectedCatalogId && metadata.selectedCatalogId !== "all" ? metadata.selectedCatalogId : resolvedProduct.catalogId, images: Array.isArray(working.images) ? working.images : resolvedProduct.images, fulfillmentProvider: metadata.fulfillmentProvider ?? resolvedProduct.fulfillmentProvider } : null;
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
      selectedColor: qrConfig.selectedColor ?? null,
      templateProductHint: qrConfig.templateProductHint ?? null,
      selectedPlacements: (layoutConfig.selectedPlacements as string[]) ?? [],
      placementConfig: (layoutConfig.placementConfig as PlacementConfig) ?? {},
      placementSizes: (layoutConfig.placementSizes as PlacementSizeConfig) ?? {},
      placementMethods: (layoutConfig.placementMethods as PrintMethodSelection) ?? {},
      masterTitle: product?.title || null,
      masterDescription: product?.description || null,
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

  const loadFromPacketData = useCallback((packetData: Record<string, any>, resolvedProduct?: CatalogProduct | null) => {
    const working = requireBuilderSnapshot(packetData.builderSnapshot);
    working.metadata.selectedBldId = packetData.bldId || working.metadata.selectedBldId || null;
    loadFromWorkingState(working, resolvedProduct);
  }, [loadFromWorkingState]);

  // One handoff path: finish saving the current draft before replacing it.
  const switchBuild = useCallback(async (label: string, install: () => Promise<void>) => {
    const finish = beginBuildActivity(label);
    const version = ++selectionVersionRef.current;
    ++optionsVersionRef.current;
    try {
      if (state.activeSessionId && ['working', 'artifact_ready'].includes(state.sessionStatus || '')) await saveWorking();
      if (!mountedRef.current) return;
      await install();
    } finally {
      if (mountedRef.current && version === selectionVersionRef.current && state.selectedProduct) fetchOptionsForProduct(state.selectedProduct);
      finish();
    }
  }, [state.activeSessionId, state.sessionStatus, state.selectedProduct, saveWorking, beginBuildActivity, fetchOptionsForProduct]);

  const resetBuilder = useCallback(async () => {
    await switchBuild('Starting a new build…', async () => {
      ++selectionVersionRef.current;
      ++optionsVersionRef.current;
      qrTypeChosenOrRestoredRef.current = false;
      setState({ ...initialState, qrProductState: preferredQRTypeRef.current, fulfillmentProvider: selectedProviders[0] || 'printify', forceNewSession: true });
      setAutoSaveFailed(false);
      setAutoSaveError(null);
    });
  }, [switchBuild, selectedProviders]);

  const resumeSession = useCallback(async (id: string) => {
    await switchBuild('Opening saved build…', async () => {
      const { session } = await adminFetch<any>(`/build-sessions/${encodeURIComponent(id)}`);
      if (!session || !['working', 'artifact_ready', 'committed'].includes(session.status)) throw new Error('This build cannot be resumed.');
      const packetId = session.generated?.packetId || null;
      let packet: any = null;
      if (session.status === 'committed' || !session.working?.graphics?.content) {
        if (packetId) {
          const data = await adminFetch<any>(`/packets/${encodeURIComponent(packetId)}`);
          packet = data.packet || data;
        }
      }
      const working = packet ? requireBuilderSnapshot(packet.builderSnapshot) : session.working;
      if (!working || !Object.keys(working).length) throw new Error('This draft has no saved working state.');
      const product = resolveBuildProduct(await fetchBuildCatalog(), working, { ...packet, sourceMasterId: session.sourceMasterId });
      if (!mountedRef.current) return;
      if (packet) loadFromPacketData(packet, product); else loadFromWorkingState(working, product);
      setActiveSession(session.id, session.status, session.committedInstanceId || null, session.draftName || null);
      setActivePacketId(packetId);
    });
  }, [switchBuild, loadFromPacketData, loadFromWorkingState, setActiveSession, setActivePacketId]);

  const startFromTemplate = useCallback(async (template: { packet?: any; packetId?: string | null; builderSnapshot?: any }) => {
    await switchBuild('Loading template…', async () => {
      let packet = { ...template.packet, builderSnapshot: template.builderSnapshot || template.packet?.builderSnapshot };
      if (!packet?.builderSnapshot && template.packetId) {
        const data = await adminFetch<any>(`/packets/${encodeURIComponent(template.packetId)}`);
        packet = data.packet || data;
      }
      const working = requireBuilderSnapshot(packet?.builderSnapshot);
      const product = resolveBuildProduct(await fetchBuildCatalog(), working, packet);
      working.metadata.selectedProductDocId = product.docId;
      working.metadata.selectedProductBlueprintId = product.blueprintId;
      const data = await adminFetch<any>('/build-sessions/from-master', {
        method: 'POST', json: { sourceMasterId: product.docId, forceNew: true, initialWorking: working,
          catalogId: working.metadata.selectedCatalogId === 'all' ? null : working.metadata.selectedCatalogId },
      });
      if (!data.sessionId) throw new Error('The new template draft could not be created.');
      if (!mountedRef.current) return;
      loadFromPacketData({ ...packet, builderSnapshot: working }, product);
      setActiveSession(data.sessionId, 'working', null, null);
    });
  }, [switchBuild, loadFromPacketData, setActiveSession]);

  const value = useMemo<BuilderContextValue>(() => ({
    state,
    qrTypePreferenceSaving, qrTypePreferenceError, retryQRTypePreference,
    busy, beginBuildActivity, applyAiProposal, saveDraft, resumeSession, startFromTemplate,
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
    api,
  }), [state, qrTypePreferenceSaving, qrTypePreferenceError, retryQRTypePreference, busy, beginBuildActivity, applyAiProposal, saveDraft, resumeSession, startFromTemplate, autoSaveFailed, autoSaveError, selectedProviders, selectedRole, selectedStore, selectedChannel, selectedCollection, setSourceType, loadTemplate, loadGraphic, loadBackground, setFulfillmentProvider, setCategory, setSelectedCatalogId, setOriginFilter, setGenderFilter, selectProduct, setQRProductState, setContent, togglePlacement, setPlacementType, setPlacementSize, setPlacementMethod, setSelectedColor, refreshPlacements, setActivePacketId, setActiveSession, setProductDescription, setProductTitle, resetBuilder, saveWorking, loadFromPacketData, loadFromWorkingState, api]);

  return (
    <BuilderContext.Provider value={value}>
      {children}
      {busy && <div role="status" aria-live="polite" className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/60" data-testid="builder-busy">
        <div className="rounded-md border bg-background p-4 shadow-lg">{busy}</div>
      </div>}
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
