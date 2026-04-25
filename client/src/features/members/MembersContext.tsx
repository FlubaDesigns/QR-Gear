import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { useMemberAuth } from "./MemberAuthContext";
import { memberFetch } from "@/lib/memberFetch";

export interface AllowedProduct {
  canonicalBlankKey?: string;
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
  selectedPlacements?: string[];
  artworkUrl: string;
  qrSize?: 'small' | 'medium' | 'large';
  fulfillmentProvider?: 'printify' | 'printful';
}

export interface MockupResult {
  success: boolean;
  mockupUrl: string | null;
  lifestyleMockupUrl: string | null;
  placementMockupUrls?: Record<string, string>;
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
  const { requiresAuth } = useMemberAuth();
  const [memberId, setMemberIdState] = useState<string | null>(initialMemberId);

  const setMemberId = useCallback((id: string | null) => {
    setMemberIdState(id);
  }, []);

  const api = useMemo<MembersApi>(() => {
    const getQueryKey = (type: string = "all"): string[] => ["members", type];

    const invalidateMembers = (type?: string): void => {
      if (type) {
        queryClient.invalidateQueries({ queryKey: getQueryKey(type) });
      } else {
        queryClient.invalidateQueries({ queryKey: ["members"] });
      }
    };

    return {
      getQueryKey,
      invalidateMembers,

      fetchAllowedProducts: async (section?: string): Promise<AllowedProduct[]> => {
        const sectionQuery = section ? `?section=${section}` : '';
        const data = await memberFetch<any>(`/allowed-products${sectionQuery}`);
        return data.products || [];
      },

      fetchChannels: async (memberId: string): Promise<Channel[]> => {
        return memberFetch<Channel[]>(`/${memberId}/channels`);
      },

      createChannel: async (memberId: string, name: string, storeId?: string): Promise<Channel> => {
        return memberFetch<Channel>(`/${memberId}/channels`, { method: "POST", json: { name, storeId } });
      },

      generateProductGraphic: async (params: ProductGraphicParams): Promise<ProductGraphicResult> => {
        try {
          const data = await memberFetch<any>(`/generate-product-graphic`, {
            method: "POST",
            json: {
              qrUrl: params.qrUrl,
              headerStyle: params.headerStyle,
              footerStyle: params.footerStyle,
              textLayoutChoice: params.textLayoutChoice,
              qrColor: params.qrColor || 'black',
            },
          });
          return { success: data.success, productGraphic: data.productGraphic || null, error: data.error };
        } catch (err: any) {
          return { success: false, productGraphic: null, error: err?.message || "ProductGraphic API error" };
        }
      },

      generateMockup: async (params: MockupParams): Promise<MockupResult> => {
        try {
          const data = await memberFetch<any>(`/mockup/priority`, {
            method: "POST",
            json: {
              blueprintId: params.blueprintId,
              printProviderId: params.printProviderId,
              colorName: params.colorName,
              colorHex: params.colorHex || '#000000',
              placement: params.placement || 'front',
              selectedPlacements: params.selectedPlacements && params.selectedPlacements.length > 0
                ? params.selectedPlacements
                : undefined,
              artworkUrl: params.artworkUrl,
              qrSize: params.qrSize || 'medium',
              fulfillmentProvider: params.fulfillmentProvider || 'printify',
            },
          });
          return {
            success: data.success,
            mockupUrl: data.mockupUrl || null,
            lifestyleMockupUrl: data.lifestyleMockupUrl || null,
            placementMockupUrls: data.placementMockupUrls || undefined,
            fromCache: data.fromCache || false,
            error: data.error,
          };
        } catch (err: any) {
          return { success: false, mockupUrl: null, lifestyleMockupUrl: null, fromCache: false, error: err?.message || "Mockup API error" };
        }
      },
    };
  }, []);

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
