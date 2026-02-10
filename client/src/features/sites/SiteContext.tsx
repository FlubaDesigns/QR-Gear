import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { nexusFetch } from "@/lib/nexusFetch";

export type ViewType = 'channel_products' | 'program_series' | 'create_product';

export interface ChannelItem {
  itemId: string;
  packetId: string;
  title: string;
  description?: string;
  previewImageUrl?: string;
  shareUrl: string;
  price?: number;
  collectionTag?: string;
  shareImageSquareUrl?: string;
  shareCaption?: string;
}

export interface ProgramMoment {
  day: number;
  packetId?: string;
  title: string;
  description?: string;
  contentType?: 'image' | 'video' | 'text' | 'mixed';
  imageUrl?: string;
  videoUrl?: string;
  bodyText?: string;
}

export interface ProgramData {
  programId: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  scheduleType: string;
  totalDays: number;
  status: string;
}

export interface SiteSession {
  ok: boolean;
  error?: string;
  mode: 'display' | 'create';
  viewType: ViewType;
  storeId: string;
  channelId: string;
  entityType: string;
  entityId: string;
  storeOwner?: { ownerType: string; ownerId: string };
  programId?: string;
  program?: ProgramData;
  items: ChannelItem[];
  moments: ProgramMoment[];
  display: {
    entityName?: string;
    entityLogoUrl?: string;
    placement?: string;
    mode?: string;
    returnUrl?: string;
    theme?: string;
  };
  capabilities: {
    canCreate: boolean;
    canManage: boolean;
  };
}

interface SiteContextValue {
  session: SiteSession | null;
  isLoading: boolean;
  error: Error | null;
  token: string | null;
}

const SiteContext = createContext<SiteContextValue>({
  session: null,
  isLoading: false,
  error: null,
  token: null,
});

export function useSiteContext() {
  return useContext(SiteContext);
}

const ALLOWED_ORIGINS = (typeof window !== 'undefined'
  ? (import.meta.env.VITE_ALLOWED_WIDGET_ORIGINS || 'https://kingdomconnects.org')
  : 'https://kingdomconnects.org'
).split(',');

export function notifyParent(type: string, data?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.parent !== window) {
    const targetOrigin = ALLOWED_ORIGINS[0] || '*';
    window.parent.postMessage({ type: `qrgear:${type}`, ...data }, targetOrigin);
  }
}

export function SiteProvider({ token, children }: { token: string | null; children: ReactNode }) {
  const { data: session, isLoading, error } = useQuery<SiteSession>({
    queryKey: ["/api/widget/session", token],
    queryFn: async () => {
      const url = `/api/widget/session?token=${encodeURIComponent(token!)}`;
      const res = await nexusFetch(url, { source: "widget:session", tries: 3 });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load session');
      }
      return res.json();
    },
    enabled: !!token,
  });

  return (
    <SiteContext.Provider value={{ session: session ?? null, isLoading, error: error as Error | null, token }}>
      {children}
    </SiteContext.Provider>
  );
}
