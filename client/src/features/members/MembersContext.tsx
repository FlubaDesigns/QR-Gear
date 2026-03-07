import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { useMemberAuth } from "./MemberAuthContext";

export interface AllowedProduct {
  blueprintId: number;
  printProviderId: number | null;
  title: string;
  imageUrl: string;
  baseCost: number;
  customerPrice: number;
  earnings: number;
  availableColors?: Array<{ name: string; hex: string }>;
  availableSizes?: string[];
}

export interface Channel {
  id: string;
  name: string;
  storeId?: string;
}

export interface TextStyleConfig {
  text: string;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  letterSpacing?: number;
  warpPreset?: string;
  strokeColor?: string;
  strokeWidth?: number;
  enabled?: boolean;
}

export interface ProductGraphicParams {
  qrUrl: string;
  headerStyle?: TextStyleConfig | null;
  footerStyle?: TextStyleConfig | null;
  textLayoutChoice: 'header' | 'footer' | 'both' | '';
  qrColor?: 'black' | 'white';
}

export interface ProductGraphicResult {
  success: boolean;
  productGraphic: string | null;
  error?: string;
}

export interface MembersApi {
  baseUrl: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  getQueryKey: (type?: string) => string[];
  invalidateMembers: (type?: string) => void;
  fetchAllowedProducts: (section?: string) => Promise<AllowedProduct[]>;
  fetchChannels: (memberId: string) => Promise<Channel[]>;
  createChannel: (memberId: string, name: string, storeId?: string) => Promise<Channel>;
  generateMockup: (params: MockupParams) => Promise<MockupResult>;
  generateProductGraphic: (params: ProductGraphicParams) => Promise<ProductGraphicResult>;
}

export interface MockupParams {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  colorHex?: string;
  placement?: string;
  artworkUrl: string;
  qrSize?: 'small' | 'medium' | 'large';
  fulfillmentProvider?: 'printify' | 'printful';
}

export interface MockupResult {
  success: boolean;
  mockupUrl: string | null;
  lifestyleMockupUrl: string | null;
  fromCache: boolean;
  error?: string;
}

export interface MembersContextValue {
  requiresAuth: boolean;
  api: MembersApi;
  memberId: string | null;
  setMemberId: (id: string | null) => void;
}

const MembersContext = createContext<MembersContextValue | null>(null);

interface MembersProviderProps {
  children: React.ReactNode;
  initialMemberId?: string | null;
}

export function MembersProvider({ children, initialMemberId = null }: MembersProviderProps) {
  const { requiresAuth, getAuthHeaders, apiBase } = useMemberAuth();
  const [memberId, setMemberIdState] = useState<string | null>(initialMemberId);

  const setMemberId = useCallback((id: string | null) => {
    setMemberIdState(id);
  }, []);

  const api = useMemo<MembersApi>(() => {
    const getQueryKey = (type: string = "all"): string[] => ["members", apiBase, type];

    const invalidateMembers = (type?: string): void => {
      if (type) {
        queryClient.invalidateQueries({ queryKey: getQueryKey(type) });
      } else {
        queryClient.invalidateQueries({ queryKey: ["members", apiBase] });
      }
    };

    return {
      baseUrl: apiBase,
      getAuthHeaders,
      getQueryKey,
      invalidateMembers,

      fetchAllowedProducts: async (section?: string): Promise<AllowedProduct[]> => {
        const headers = await getAuthHeaders();
        const sectionQuery = section ? `?section=${section}` : '';
        const res = await fetch(`${apiBase}/allowed-products${sectionQuery}`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
        const data = await res.json();
        return data.products || [];
      },

      fetchChannels: async (memberId: string): Promise<Channel[]> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/${memberId}/channels`, { headers });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`Failed to fetch channels: ${res.status}`);
        }
        return res.json();
      },

      createChannel: async (memberId: string, name: string, storeId?: string): Promise<Channel> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/${memberId}/channels`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ name, storeId }),
        });
        if (!res.ok) throw new Error(`Failed to create channel: ${res.status}`);
        return res.json();
      },

      generateProductGraphic: async (params: ProductGraphicParams): Promise<ProductGraphicResult> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/generate-product-graphic`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            qrUrl: params.qrUrl,
            headerStyle: params.headerStyle,
            footerStyle: params.footerStyle,
            textLayoutChoice: params.textLayoutChoice,
            qrColor: params.qrColor || 'black',
          }),
        });
        
        if (!res.ok) {
          return {
            success: false,
            productGraphic: null,
            error: `ProductGraphic API error: ${res.status}`,
          };
        }

        const data = await res.json();
        return {
          success: data.success,
          productGraphic: data.productGraphic || null,
          error: data.error,
        };
      },

      generateMockup: async (params: MockupParams): Promise<MockupResult> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/mockup/priority`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            blueprintId: params.blueprintId,
            printProviderId: params.printProviderId,
            colorName: params.colorName,
            colorHex: params.colorHex || '#000000',
            placement: params.placement || 'front',
            artworkUrl: params.artworkUrl,
            qrSize: params.qrSize || 'medium',
            fulfillmentProvider: params.fulfillmentProvider || 'printify',
          }),
        });
        
        if (!res.ok) {
          return {
            success: false,
            mockupUrl: null,
            lifestyleMockupUrl: null,
            fromCache: false,
            error: `Mockup API error: ${res.status}`,
          };
        }

        const data = await res.json();
        return {
          success: data.success,
          mockupUrl: data.mockupUrl || null,
          lifestyleMockupUrl: data.lifestyleMockupUrl || null,
          fromCache: data.fromCache || false,
          error: data.error,
        };
      },
    };
  }, [apiBase, getAuthHeaders]);

  const value = useMemo<MembersContextValue>(
    () => ({
      requiresAuth,
      api,
      memberId,
      setMemberId,
    }),
    [requiresAuth, api, memberId, setMemberId]
  );

  return (
    <MembersContext.Provider value={value}>
      {children}
    </MembersContext.Provider>
  );
}

export function useMembersContext(): MembersContextValue {
  const context = useContext(MembersContext);
  if (!context) {
    throw new Error("useMembersContext must be used within MembersProvider");
  }
  return context;
}
