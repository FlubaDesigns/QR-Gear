import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { adminFetch } from "@/lib/adminFetch";

export type StoreType = "internal" | "marketplace" | "partner" | "external" | "member";

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
  linkId?: string;
  packetId?: string;
  templateId?: string;
  name: string;
  imageUrl: string;
  baseProductId?: string;
  enabledColors?: string[];
  enabledSizes?: string[];
  selectedGraphicSize?: string;
  defaultColor?: string;
  qrContent?: string;
  pricing?: any;
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

interface StoreLibraryProviderProps {
  children: ReactNode;
}

export function StoreLibraryProvider({ children }: StoreLibraryProviderProps) {
  const [selectedType, setSelectedType] = useState<StoreType>("internal");
  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelInfo | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<ProductInfo[]>([]);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);

  useEffect(() => {
    if (urlParamsProcessed) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlStoreId = urlParams.get("storeId");
    const urlChannel = urlParams.get("channel");
    
    if (urlStoreId && urlStoreId !== "null") {
      adminFetch<any>(`/stores/by-id/${urlStoreId}`)
        .then(async (store) => {
          if (store && store.id) {
            setSelectedType((store.type || store.roleType || "internal") as StoreType);
            setSelectedStore({
              id: store.id,
              name: store.name || urlStoreId,
              type: (store.type || store.roleType || "internal") as StoreType,
            });
            
            if (urlChannel && urlChannel !== "null") {
              try {
                const channels: ChannelInfo[] = await adminFetch<ChannelInfo[]>(`/stores/${urlStoreId}/channels`);
                const channel = channels.find(c => c.name === urlChannel || c.id === urlChannel);
                if (channel) {
                  setSelectedChannel(channel);
                }
              } catch (e) {
                console.warn("Failed to load channels from URL params:", e);
              }
            }
          }
          setUrlParamsProcessed(true);
        })
        .catch(() => setUrlParamsProcessed(true));
    } else {
      setUrlParamsProcessed(true);
    }
  }, [urlParamsProcessed]);

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
