import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useProductsContext } from "../ProductsContext";
import type { SourceType, LoadedTemplate, LoadedGraphic, LoadedBackground, BuilderState, OriginFilter, GenderFilter, CatalogProduct, QRProductState, ContentData, PlacementType, PlacementConfig, PlacementSize, PlacementSizeConfig, SelectedColor, PrintMethodSelection, TemplateProductHint } from "./types";
import type { RoleType, Store, Channel } from "../shared/types";
import { defaultTextStyle } from "./types";

interface BuilderContextValue {
  state: BuilderState;
  activeProviders: string[];
  selectedRole: RoleType | null;
  selectedStore: Store | null;
  selectedChannel: Channel | null;
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
  setActivePacketId: (id: string | null) => void;
  resetBuilder: () => void;
  loadFromPacketData: (packetData: Record<string, any>, resolvedProduct?: CatalogProduct | null) => void;
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
  selectedPlacements: [],
  placementConfig: {},
  placementSizes: {},
  placementMethods: {},
  activePacketId: null,
  templateBaseline: null,
  templateProductHint: null,
};

interface BuilderProviderProps {
  children: React.ReactNode;
}

export function BuilderProvider({ children }: BuilderProviderProps) {
  const { api, selectedProviders, selectedRole, selectedStore, selectedChannel } = useProductsContext();
  const [state, setState] = useState<BuilderState>(initialState);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!state.activePacketId) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const headers = await api.getAuthHeaders();
        const { playMediaFile, playMediaPreview, ...serializableContent } = state.content;
        await fetch(`${api.baseUrl}/admin/packets/${state.activePacketId}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            builderSnapshot: {
              content: serializableContent,
              loadedBackground: state.loadedBackground,
            },
          }),
        });
        console.log(`[BuilderContext] Auto-saved to packet ${state.activePacketId}`);
      } catch (e) {
        console.warn("[BuilderContext] Auto-save failed:", e);
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [state.content, state.loadedBackground, state.activePacketId]);

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

  const selectProduct = useCallback((product: CatalogProduct | null) => {
    if (!product) {
      setState(prev => ({ ...prev, selectedProduct: null, placementsLoading: false }));
      return;
    }

    if (product.placements && product.placements.length > 0) {
      setState(prev => ({ ...prev, selectedProduct: product, placementsLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, selectedProduct: product, placementsLoading: true }));

    const provider = product.fulfillmentProvider || 'printify';
    const params = new URLSearchParams({ provider });
    if (provider === 'printify') {
      if (product.blueprintId) params.set('blueprintId', String(product.blueprintId));
      if (product.printProviderId) params.set('printProviderId', String(product.printProviderId));
    } else {
      params.set('productId', String(product.id));
    }

    api.getAuthHeaders().then(headers => 
      fetch(`${api.baseUrl}/catalog/placements?${params}`, { headers })
    )
      .then(r => r.json())
      .then(data => {
        if (data.placements && data.placements.length > 0) {
          setState(prev => {
            if (prev.selectedProduct?.id !== product.id) return prev;
            return {
              ...prev,
              selectedProduct: { ...prev.selectedProduct!, placements: data.placements },
              placementsLoading: false,
            };
          });
        } else {
          setState(prev => {
            if (prev.selectedProduct?.id !== product.id) return prev;
            return { ...prev, placementsLoading: false };
          });
        }
      })
      .catch(err => {
        console.error('Failed to fetch placements:', err);
        setState(prev => {
          if (prev.selectedProduct?.id !== product.id) return prev;
          return { ...prev, placementsLoading: false };
        });
      });
  }, []);

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
      qrPositionX: snapshot?.qrPositionX ?? 50,
      qrPositionY: snapshot?.qrPositionY ?? 50,
      qrSizePercent: snapshot?.qrSizePercent ?? 75,
      areaImageUrl: snapshot?.areaImageUrl || '',
      areaImageMode: (snapshot?.areaImageMode || 'behind-qr') as "behind-qr",
      areaImageOffsetX: snapshot?.areaImageOffsetX ?? 50,
      areaImageOffsetY: snapshot?.areaImageOffsetY ?? 50,
      areaImageScale: snapshot?.areaImageScale ?? 100,
      landingTextBlocks: snapshot?.landingTextBlocks || (packetData.landingTextBlocks as any[]) || [],
      graphicLayoutMode: (snapshot?.graphicLayoutMode || '') as "" | "zone" | "freeform",
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
      selectedProduct: resolvedProduct ?? null,
      placementsLoading: false,
    }));
  }, []);

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
    activeProviders: selectedProviders,
    selectedRole,
    selectedStore,
    selectedChannel,
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
    setActivePacketId,
    resetBuilder,
    loadFromPacketData,
    hasChangesFromBaseline,
    setTemplateProductResolved,
    api,
  }), [state, selectedProviders, selectedRole, selectedStore, selectedChannel, setSourceType, loadTemplate, loadGraphic, loadBackground, setFulfillmentProvider, setCategory, setOriginFilter, setGenderFilter, selectProduct, setQRProductState, setContent, togglePlacement, setPlacementType, setPlacementSize, setPlacementMethod, setSelectedColor, setActivePacketId, resetBuilder, loadFromPacketData, hasChangesFromBaseline, setTemplateProductResolved, api]);

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
