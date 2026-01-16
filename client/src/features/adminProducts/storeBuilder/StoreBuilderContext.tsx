import { createContext, useContext, useState, useCallback } from "react";

interface ConfiguredProduct {
  id: string;
  baseProductId: string;
  baseProductName: string;
  graphicUrl?: string;
  enabledColors: string[];
  enabledSizes: string[];
  defaultColor?: string;
  mockupUrl?: string;
  isBlankCanvas: boolean;
}

interface StoreConfig {
  id: string;
  name: string;
  permissions: string[];
  productLimit: number;
  products: ConfiguredProduct[];
}

interface ChannelConfig {
  id: string;
  storeId: string;
  name: string;
  userId?: string;
  pageId?: string;
  products: ConfiguredProduct[];
}

interface StoreBuilderState {
  currentStore: StoreConfig | null;
  currentChannel: ChannelConfig | null;
  selectedBaseProduct: any | null;
  configuredProducts: ConfiguredProduct[];
  step: "store" | "channel" | "catalog" | "configure" | "assign";
}

interface StoreBuilderContextValue extends StoreBuilderState {
  setCurrentStore: (store: StoreConfig | null) => void;
  setCurrentChannel: (channel: ChannelConfig | null) => void;
  setSelectedBaseProduct: (product: any | null) => void;
  addConfiguredProduct: (product: ConfiguredProduct) => void;
  removeConfiguredProduct: (id: string) => void;
  setStep: (step: StoreBuilderState["step"]) => void;
  reset: () => void;
}

const initialState: StoreBuilderState = {
  currentStore: null,
  currentChannel: null,
  selectedBaseProduct: null,
  configuredProducts: [],
  step: "store",
};

const StoreBuilderContext = createContext<StoreBuilderContextValue | null>(null);

export function StoreBuilderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreBuilderState>(initialState);

  const setCurrentStore = useCallback((store: StoreConfig | null) => {
    setState(prev => ({ ...prev, currentStore: store }));
  }, []);

  const setCurrentChannel = useCallback((channel: ChannelConfig | null) => {
    setState(prev => ({ ...prev, currentChannel: channel }));
  }, []);

  const setSelectedBaseProduct = useCallback((product: any | null) => {
    setState(prev => ({ ...prev, selectedBaseProduct: product }));
  }, []);

  const addConfiguredProduct = useCallback((product: ConfiguredProduct) => {
    setState(prev => ({
      ...prev,
      configuredProducts: [...prev.configuredProducts, product],
    }));
  }, []);

  const removeConfiguredProduct = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      configuredProducts: prev.configuredProducts.filter(p => p.id !== id),
    }));
  }, []);

  const setStep = useCallback((step: StoreBuilderState["step"]) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <StoreBuilderContext.Provider
      value={{
        ...state,
        setCurrentStore,
        setCurrentChannel,
        setSelectedBaseProduct,
        addConfiguredProduct,
        removeConfiguredProduct,
        setStep,
        reset,
      }}
    >
      {children}
    </StoreBuilderContext.Provider>
  );
}

export function useStoreBuilderContext() {
  const context = useContext(StoreBuilderContext);
  if (!context) {
    throw new Error("useStoreBuilderContext must be used within StoreBuilderProvider");
  }
  return context;
}
