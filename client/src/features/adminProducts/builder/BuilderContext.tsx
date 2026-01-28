import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useProductsContext } from "../ProductsContext";
import type { SourceType, LoadedTemplate, LoadedGraphic, LoadedBackground, BuilderState, OriginFilter, GenderFilter, CatalogProduct, QRProductState, ContentData, PlacementId, PlacementType, PlacementConfig, PlacementSize, PlacementSizeConfig, SelectedColor } from "./types";
import type { RoleType, Store, Channel } from "../shared/types";
import { defaultTextStyle } from "./types";

interface BuilderContextValue {
  state: BuilderState;
  activeProviders: string[];
  // Role/Store/Channel from ProductsContext
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
  togglePlacement: (placementId: PlacementId) => void;
  setPlacementType: (placementId: PlacementId, type: PlacementType) => void;
  setPlacementSize: (placementId: PlacementId, size: PlacementSize) => void;
  setSelectedColor: (color: SelectedColor | null) => void;
  resetBuilder: () => void;
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
  headerStyle: { ...defaultTextStyle, verticalOffset: 15, horizontalOffset: 0 },
  footerStyle: { ...defaultTextStyle, verticalOffset: 16, horizontalOffset: 0 },
  titleStyle: { ...defaultTextStyle, text: "", verticalOffset: 84, horizontalOffset: 8 },
  descriptionStyle: { ...defaultTextStyle, text: "", verticalOffset: 72, horizontalOffset: 10 },
  hostingTierCode: "1_year",
  // Play-specific fields
  playMediaSource: null,
  playMediaUrl: "",
  playMediaFile: null,
  playMediaPreview: "",
  playMediaMimeType: "",
  playPermissionConfirmed: false,
};

const initialState: BuilderState = {
  sourceType: "custom",
  loadedTemplate: null,
  loadedGraphic: null,
  loadedBackground: null,
  fulfillmentProvider: "printify",
  category: "T-Shirts",
  originFilter: { showUSA: true, showOther: false },
  genderFilter: "mens",  // Default to men's for faster testing
  selectedProduct: null,
  selectedColor: { name: "Black", hex: "#000000" },  // Default to black
  qrProductState: "qr_canvas",  // Default to QR Canvas mode
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
  selectedPlacements: ["left-shoulder"],  // Default to left shoulder for testing
  placementConfig: { "left-shoulder": "qr" },  // Left shoulder is QR-only
  placementSizes: { "left-shoulder": "medium" },
};

interface BuilderProviderProps {
  children: React.ReactNode;
}

export function BuilderProvider({ children }: BuilderProviderProps) {
  const { api, selectedProviders, selectedRole, selectedStore, selectedChannel } = useProductsContext();
  const [state, setState] = useState<BuilderState>(initialState);

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
    console.log("[BuilderContext] setGenderFilter called with:", filter);
    setState(prev => {
      console.log("[BuilderContext] Previous genderFilter:", prev.genderFilter, "New:", filter);
      return {
        ...prev,
        genderFilter: filter,
        selectedProduct: null,
      };
    });
  }, []);

  const selectProduct = useCallback((product: CatalogProduct | null) => {
    setState(prev => ({
      ...prev,
      selectedProduct: product,
    }));
  }, []);

  const setQRProductState = useCallback((qrState: QRProductState) => {
    setState(prev => ({
      ...prev,
      qrProductState: qrState,
      content: initialContent, // Reset content when QR state changes
      selectedPlacements: [], // Reset placements when QR state changes
      placementConfig: {}, // Reset placement config when QR state changes
      placementSizes: {}, // Reset placement sizes when QR state changes
    }));
  }, []);

  const setContent = useCallback((content: Partial<ContentData>) => {
    setState(prev => ({
      ...prev,
      content: { ...prev.content, ...content },
    }));
  }, []);

  const togglePlacement = useCallback((placementId: PlacementId) => {
    setState(prev => {
      const isSelected = prev.selectedPlacements.includes(placementId);
      const newPlacements = isSelected
        ? prev.selectedPlacements.filter(p => p !== placementId)
        : [...prev.selectedPlacements, placementId];
      
      // Also update placementConfig - default new placements to "qr"
      const newConfig = { ...prev.placementConfig };
      const newSizes = { ...prev.placementSizes };
      if (!isSelected) {
        newConfig[placementId] = "qr"; // Default to QR when adding
        newSizes[placementId] = "medium"; // Default to medium size when adding
      } else {
        delete newConfig[placementId]; // Remove from config when removing
        delete newSizes[placementId]; // Remove size when removing
      }
      
      return {
        ...prev,
        selectedPlacements: newPlacements,
        placementConfig: newConfig,
        placementSizes: newSizes,
      };
    });
  }, []);

  const setPlacementType = useCallback((placementId: PlacementId, type: PlacementType) => {
    setState(prev => ({
      ...prev,
      placementConfig: {
        ...prev.placementConfig,
        [placementId]: type,
      },
    }));
  }, []);

  const setPlacementSize = useCallback((placementId: PlacementId, size: PlacementSize) => {
    setState(prev => ({
      ...prev,
      placementSizes: {
        ...prev.placementSizes,
        [placementId]: size,
      },
    }));
  }, []);

  const setSelectedColor = useCallback((color: SelectedColor | null) => {
    setState(prev => ({
      ...prev,
      selectedColor: color,
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
    setSelectedColor,
    resetBuilder,
    api,
  }), [state, selectedProviders, selectedRole, selectedStore, selectedChannel, setSourceType, loadTemplate, loadGraphic, loadBackground, setFulfillmentProvider, setCategory, setOriginFilter, setGenderFilter, selectProduct, setQRProductState, setContent, togglePlacement, setPlacementType, setPlacementSize, setSelectedColor, resetBuilder, api]);

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
