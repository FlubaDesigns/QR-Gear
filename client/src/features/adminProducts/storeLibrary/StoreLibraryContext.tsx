import { createContext, useContext, useState, ReactNode } from "react";

export type StoreType = "internal" | "external" | "member";

export interface StoreInfo {
  id: string;
  name: string;
  type: StoreType;
  description?: string;
}

export interface ChannelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ProductInfo {
  id: string;
  name: string;
  imageUrl: string;
  baseProductId?: string;
  enabledColors?: string[];
  enabledSizes?: string[];
}

interface StoreLibraryContextValue {
  selectedType: StoreType;
  setSelectedType: (type: StoreType) => void;
  selectedStore: StoreInfo | null;
  setSelectedStore: (store: StoreInfo | null) => void;
  selectedChannel: ChannelInfo | null;
  setSelectedChannel: (channel: ChannelInfo | null) => void;
  selectedProducts: ProductInfo[];
  addToSelection: (product: ProductInfo) => void;
  removeFromSelection: (productId: string) => void;
  clearSelection: () => void;
}

const StoreLibraryContext = createContext<StoreLibraryContextValue | null>(null);

export function useStoreLibraryContext() {
  const context = useContext(StoreLibraryContext);
  if (!context) {
    throw new Error("useStoreLibraryContext must be used within StoreLibraryProvider");
  }
  return context;
}

export function StoreLibraryProvider({ children }: { children: ReactNode }) {
  const [selectedType, setSelectedType] = useState<StoreType>("internal");
  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelInfo | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<ProductInfo[]>([]);

  const addToSelection = (product: ProductInfo) => {
    setSelectedProducts(prev => {
      if (prev.find(p => p.id === product.id)) return prev;
      return [...prev, product];
    });
  };

  const removeFromSelection = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };

  const handleSetSelectedType = (type: StoreType) => {
    setSelectedType(type);
    setSelectedStore(null);
    setSelectedChannel(null);
  };

  const handleSetSelectedStore = (store: StoreInfo | null) => {
    setSelectedStore(store);
    setSelectedChannel(null);
  };

  return (
    <StoreLibraryContext.Provider
      value={{
        selectedType,
        setSelectedType: handleSetSelectedType,
        selectedStore,
        setSelectedStore: handleSetSelectedStore,
        selectedChannel,
        setSelectedChannel,
        selectedProducts,
        addToSelection,
        removeFromSelection,
        clearSelection,
      }}
    >
      {children}
    </StoreLibraryContext.Provider>
  );
}
