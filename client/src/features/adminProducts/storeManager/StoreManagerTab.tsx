import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store, Hash, Layers, ChevronRight, ChevronDown, ChevronLeft,
  Loader2, Trash2, MoveRight, Check, X, DollarSign, Package
} from "lucide-react";
import { createPortal } from "react-dom";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import type { RoleType, Store as StoreType, Channel, Collection } from "../shared/types";

interface AdminInstance {
  id: string;
  storeId?: string;
  storeName?: string;
  channelId?: string;
  channelName?: string;
  collectionName?: string;
  folderPath?: string;
  status?: string;
  resolved?: {
    title?: string;
    images?: Array<{ url: string } | string>;
    colors?: string[];
    sizes?: string[];
    minPrice?: number;
    maxPrice?: number;
    description?: string;
  };
  baseSnapshot?: {
    minPrice?: number;
    maxPrice?: number;
  };
  enabledColors?: string[];
  enabledSizes?: string[];
  customerPrice?: string;
  currentPacketId?: string;
}

const ROLES: { value: RoleType; label: string }[] = [
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
  { value: "member", label: "Member" },
];

function getImageUrl(instance: AdminInstance): string | null {
  const img = instance.resolved?.images?.[0];
  if (!img) return null;
  if (typeof img === "string") return img;
  return img.url ?? null;
}

function ColorToggle({ color, enabled, onToggle }: { color: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={color}
      className={`relative w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center flex-shrink-0
        ${enabled ? "border-white/60 opacity-100" : "border-white/20 opacity-40"}`}
      style={{ backgroundColor: color.startsWith("#") ? color : undefined }}
      data-testid={`toggle-color-${color}`}
    >
      {!color.startsWith("#") && (
        <span className="text-[9px] font-bold text-white leading-none uppercase">
          {color.slice(0, 2)}
        </span>
      )}
      {enabled && (
        <Check className="absolute h-3.5 w-3.5 text-white drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]" />
      )}
    </button>
  );
}

function SizeChip({ size, enabled, onToggle }: { size: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`px-3 py-1 rounded text-sm font-medium border transition-all min-h-[2rem]
        ${enabled
          ? "border-white/40 bg-white/15 text-white"
          : "border-white/10 bg-transparent text-white/30"
        }`}
      data-testid={`toggle-size-${size}`}
    >
      {size}
    </button>
  );
}

function MoveDialog({
  instance,
  apiBase,
  getAuthHeaders,
  onClose,
  onMoved,
}: {
  instance: AdminInstance;
  apiBase: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [role, setRole] = useState<RoleType | "">("");
  const [destStore, setDestStore] = useState<StoreType | null>(null);
  const [destChannel, setDestChannel] = useState<Channel | null>(null);
  const [destCollection, setDestCollection] = useState<Collection | null>(null);
  const { toast } = useToast();

  const { data: stores = [], isLoading: loadingStores } = useQuery<StoreType[]>({
    queryKey: ["stores", role],
    queryFn: async () => {
      if (!role) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores?roleType=${role}`, { headers });
      const d = await res.json();
      return d.stores ?? d ?? [];
    },
    enabled: !!role,
  });

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["channels", destStore?.id],
    queryFn: async () => {
      if (!destStore) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores/${destStore.id}/channels`, { headers });
      const d = await res.json();
      return d.channels ?? d ?? [];
    },
    enabled: !!destStore,
  });

  const { data: collections = [], isLoading: loadingCollections } = useQuery<Collection[]>({
    queryKey: ["collections", destStore?.id, destChannel?.id],
    queryFn: async () => {
      if (!destStore || !destChannel) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores/${destStore.id}/channels/${destChannel.id}/collections`, { headers });
      const d = await res.json();
      const raw: any[] = d.collections ?? (Array.isArray(d) ? d : []);
      return raw.map(c => typeof c === "string" ? { name: c } : c);
    },
    enabled: !!destStore && !!destChannel,
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const folderUpdate = {
        storeId: destStore!.id,
        storeName: destStore!.name,
        channelId: destChannel!.id,
        channelName: destChannel!.name,
        collectionName: destCollection?.name ?? null,
        collectionId: null,
        folderPath: destCollection
          ? `${destStore!.name} / ${destChannel!.name} / ${destCollection.name}`
          : `${destStore!.name} / ${destChannel!.name}`,
      };
      const res = await fetch(`${apiBase}/catalog-instances/${instance.id}`, {
        method: "PATCH",
        headers: { ...(headers as Record<string, string>), "Content-Type": "application/json" },
        body: JSON.stringify({ folderUpdate }),
      });
      if (!res.ok) throw new Error("Move failed");
    },
    onSuccess: () => {
      toast({ title: "Moved", description: "Item moved successfully." });
      onMoved();
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Could not move item.", variant: "destructive" }),
  });

  const storeOptions = stores.map(s => ({ value: s.id, label: s.name, icon: <Store className="h-4 w-4" /> }));
  const channelOptions = channels.map(c => ({ value: c.id, label: c.name, icon: <Hash className="h-4 w-4" /> }));
  const collectionOptions = [
    { value: "__none__", label: "No collection", icon: <Layers className="h-4 w-4" /> },
    ...collections.map(c => ({ value: c.name, label: c.name, icon: <Layers className="h-4 w-4" /> })),
  ];

  const canMove = !!destStore && !!destChannel;

  return (
    <div className="mt-3 p-3 rounded-lg border border-white/15 bg-white/5 space-y-3">
      <p className="glass-subtitle text-xs uppercase tracking-wider">Move to</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CustomDropdown value={role} onChange={v => { setRole(v as RoleType); setDestStore(null); setDestChannel(null); }} options={ROLES.map(r => ({ value: r.value, label: r.label }))} placeholder="Role..." />
        <CustomDropdown value={destStore?.id ?? ""} onChange={v => { const s = stores.find(x => x.id === v); setDestStore(s ?? null); setDestChannel(null); }} options={storeOptions} placeholder="Store..." loading={loadingStores} disabled={!role} />
        <CustomDropdown value={destChannel?.id ?? ""} onChange={v => { const c = channels.find(x => x.id === v); setDestChannel(c ?? null); setDestCollection(null); }} options={channelOptions} placeholder="Channel..." loading={loadingChannels} disabled={!destStore} />
        <CustomDropdown
          value={destCollection?.name ?? "__none__"}
          onChange={v => setDestCollection(v === "__none__" ? null : { name: v })}
          options={collectionOptions}
          placeholder="Collection..."
          loading={loadingCollections}
          disabled={!destChannel}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => moveMutation.mutate()}
          disabled={!canMove || moveMutation.isPending}
          className="qr-btn qr-btn--primary qr-btn--touch flex-1"
          data-testid="button-confirm-move"
        >
          {moveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Move"}
        </button>
        <button onClick={onClose} className="qr-btn qr-btn--ghost qr-btn--touch" data-testid="button-cancel-move">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AccordionSection({
  label,
  badge,
  children,
  defaultOpen = false,
}: {
  label: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/10">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-3 text-left"
        data-testid={`accordion-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="glass-subtitle text-xs uppercase tracking-wider flex items-center gap-2">
          {label}
          {badge && <span className="normal-case opacity-60 text-[11px]">{badge}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function ImageLightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      onClick={onClose}
      data-testid="lightbox-backdrop"
    >
      <img
        src={url}
        alt={alt}
        className="max-w-[92vw] max-h-[88vh] rounded-lg object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white"
        data-testid="lightbox-close"
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body
  );
}

function InstanceCard({
  instance,
  apiBase,
  getAuthHeaders,
  onDeleted,
  onMoved,
}: {
  instance: AdminInstance;
  apiBase: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  onDeleted: () => void;
  onMoved: () => void;
}) {
  const { toast } = useToast();
  const [showMove, setShowMove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localPrice, setLocalPrice] = useState(instance.customerPrice ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const allColors = instance.resolved?.colors ?? [];
  const allSizes = instance.resolved?.sizes ?? [];
  const enabledColors = instance.enabledColors ?? allColors;
  const enabledSizes = instance.enabledSizes ?? allSizes;

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/catalog-instances/${instance.id}`, {
        method: "PATCH",
        headers: { ...(headers as Record<string, string>), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onError: () => toast({ title: "Error", description: "Could not save changes.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/catalog-instances/${instance.id}`, {
        method: "DELETE",
        headers: headers as Record<string, string>,
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Item removed." });
      onDeleted();
    },
    onError: () => toast({ title: "Error", description: "Could not delete.", variant: "destructive" }),
  });

  const toggleColor = useCallback((color: string) => {
    const next = enabledColors.includes(color)
      ? enabledColors.filter(c => c !== color)
      : [...enabledColors, color];
    patchMutation.mutate({ enabledColors: next });
  }, [enabledColors, patchMutation]);

  const toggleSize = useCallback((size: string) => {
    const next = enabledSizes.includes(size)
      ? enabledSizes.filter(s => s !== size)
      : [...enabledSizes, size];
    patchMutation.mutate({ enabledSizes: next });
  }, [enabledSizes, patchMutation]);

  const savePrice = useCallback(() => {
    patchMutation.mutate({ customerPrice: localPrice });
  }, [localPrice, patchMutation]);

  const imageUrl = getImageUrl(instance);
  const title = instance.resolved?.title ?? "Untitled";
  const minPrice = instance.baseSnapshot?.minPrice;
  const maxPrice = instance.baseSnapshot?.maxPrice;

  return (
    <div className="glass-card p-4" data-testid={`card-instance-${instance.id}`}>
      {/* Header row: image + title */}
      <div className="flex gap-3 mb-1">
        <button
          className="w-20 h-20 rounded-md bg-white/10 flex-shrink-0 overflow-hidden focus:outline-none"
          onClick={() => imageUrl && setLightboxOpen(true)}
          data-testid={`button-image-${instance.id}`}
          style={{ cursor: imageUrl ? "zoom-in" : "default" }}
        >
          {imageUrl
            ? <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            : <Package className="m-auto mt-5 h-9 w-9 text-white/30" />
          }
        </button>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="glass-body font-medium text-base leading-snug" data-testid={`text-instance-title-${instance.id}`}>{title}</p>
          {instance.folderPath && (
            <p className="glass-subtitle text-xs mt-1 leading-relaxed">{instance.folderPath}</p>
          )}
          {(minPrice != null || maxPrice != null) && (
            <p className="glass-subtitle text-xs mt-1.5">
              Base: ${minPrice?.toFixed(2) ?? "—"} – ${maxPrice?.toFixed(2) ?? "—"}
            </p>
          )}
          {patchMutation.isPending && (
            <div className="flex items-center gap-1 mt-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-white/40" />
              <span className="text-xs text-white/30">Saving…</span>
            </div>
          )}
        </div>
      </div>

      {/* Colors accordion */}
      {allColors.length > 0 && (
        <AccordionSection label="Colors" badge={`${enabledColors.length}/${allColors.length} on`}>
          <div className="flex flex-wrap gap-2">
            {allColors.map(color => (
              <ColorToggle
                key={color}
                color={color}
                enabled={enabledColors.includes(color)}
                onToggle={() => toggleColor(color)}
              />
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Sizes accordion */}
      {allSizes.length > 0 && (
        <AccordionSection label="Sizes" badge={`${enabledSizes.length}/${allSizes.length} on`}>
          <div className="flex flex-wrap gap-2">
            {allSizes.map(size => (
              <SizeChip
                key={size}
                size={size}
                enabled={enabledSizes.includes(size)}
                onToggle={() => toggleSize(size)}
              />
            ))}
          </div>
        </AccordionSection>
      )}

      {/* Pricing accordion */}
      <AccordionSection label="Pricing">
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="number"
            min="0"
            step="0.01"
            value={localPrice}
            onChange={e => setLocalPrice(e.target.value)}
            onBlur={savePrice}
            onKeyDown={e => e.key === "Enter" && savePrice()}
            placeholder="Customer price"
            className="w-full h-11 pl-9 pr-4 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/30 text-base focus:outline-none focus:ring-1 focus:ring-ice-2"
            data-testid={`input-price-${instance.id}`}
          />
        </div>
      </AccordionSection>

      {/* Actions accordion */}
      <AccordionSection label="Actions">
        <div className="flex gap-2">
          <button
            onClick={() => { setShowMove(!showMove); setConfirmDelete(false); }}
            className="qr-btn qr-btn--outline qr-btn--touch flex-1 gap-2"
            data-testid={`button-move-${instance.id}`}
          >
            <MoveRight className="h-4 w-4" /> Move
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="qr-btn qr-btn--outline qr-btn--touch flex-1 text-red-400 gap-2"
              data-testid={`button-delete-${instance.id}`}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : (
            <div className="flex gap-2 flex-1">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="qr-btn qr-btn--touch flex-1 bg-red-500/20 text-red-300 border border-red-500/30"
                data-testid={`button-confirm-delete-${instance.id}`}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="qr-btn qr-btn--ghost qr-btn--touch" data-testid={`button-cancel-delete-${instance.id}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {showMove && (
          <MoveDialog
            instance={instance}
            apiBase={apiBase}
            getAuthHeaders={getAuthHeaders}
            onClose={() => setShowMove(false)}
            onMoved={onMoved}
          />
        )}
      </AccordionSection>

      {lightboxOpen && imageUrl && (
        <ImageLightbox url={imageUrl} alt={title} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}

function CollectionList({
  storeId,
  channel,
  apiBase,
  getAuthHeaders,
  selectedCollectionName,
  onSelect,
}: {
  storeId: string;
  channel: Channel;
  apiBase: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  selectedCollectionName: string | null;
  onSelect: (name: string) => void;
}) {
  const { data: collections = [], isLoading } = useQuery<Collection[]>({
    queryKey: ["collections", storeId, channel.id],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores/${storeId}/channels/${channel.id}/collections`, { headers });
      const d = await res.json();
      const raw: any[] = d.collections ?? (Array.isArray(d) ? d : []);
      return raw.map(c => typeof c === "string" ? { name: c } : c);
    },
  });

  if (isLoading) {
    return <div className="pl-9 py-2"><Loader2 className="h-4 w-4 animate-spin text-white/30" /></div>;
  }

  if (!collections.length) {
    return <p className="pl-9 py-2 text-xs text-white/25 italic">No collections</p>;
  }

  return (
    <div className="pl-6 space-y-0.5 mt-1">
      {collections.map(col => {
        const isSelected = selectedCollectionName === col.name;
        return (
          <button
            key={col.name}
            onClick={() => onSelect(col.name)}
            className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-left transition-all hover-elevate
              ${isSelected ? "bg-purple-500/20 text-purple-200" : "glass-subtitle"}`}
            data-testid={`button-select-collection-${col.name}`}
          >
            <Layers className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{col.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChannelTree({
  channels,
  apiBase,
  getAuthHeaders,
  storeId,
  selectedChannelId,
  selectedCollectionName,
  onSelect,
}: {
  channels: Channel[];
  apiBase: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  storeId: string;
  selectedChannelId: string | null;
  selectedCollectionName: string | null;
  onSelect: (channelId: string, collectionName: string | null) => void;
}) {
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const toggleExpand = (channelId: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev);
      next.has(channelId) ? next.delete(channelId) : next.add(channelId);
      return next;
    });
  };

  return (
    <div className="space-y-0.5">
      {channels.map(channel => {
        const isExpanded = expandedChannels.has(channel.id);
        const isChannelSelected = selectedChannelId === channel.id && !selectedCollectionName;
        return (
          <div key={channel.id}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleExpand(channel.id)}
                className="p-2 text-white/40 hover-elevate rounded flex-shrink-0"
                data-testid={`button-expand-channel-${channel.id}`}
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />}
              </button>
              <button
                onClick={() => { onSelect(channel.id, null); if (!isExpanded) toggleExpand(channel.id); }}
                className={`flex-1 flex items-center gap-2.5 px-2 py-3 rounded-lg text-sm text-left transition-all hover-elevate
                  ${isChannelSelected ? "bg-ice-2/20 glass-body" : "glass-subtitle"}`}
                data-testid={`button-select-channel-${channel.id}`}
              >
                <Hash className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{channel.name}</span>
                {channel.productCount != null && (
                  <span className="ml-auto text-xs text-white/30 pr-1">{channel.productCount}</span>
                )}
              </button>
            </div>
            {isExpanded && (
              <CollectionList
                storeId={storeId}
                channel={channel}
                apiBase={apiBase}
                getAuthHeaders={getAuthHeaders}
                selectedCollectionName={selectedChannelId === channel.id ? selectedCollectionName : null}
                onSelect={name => onSelect(channel.id, name)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StoreManagerTab() {
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<RoleType | "">("");
  const [selectedStore, setSelectedStore] = useState<StoreType | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  // mobile: "nav" shows the channel tree, "items" shows the product grid
  const [mobileView, setMobileView] = useState<"nav" | "items">("nav");

  const { data: stores = [], isLoading: loadingStores } = useQuery<StoreType[]>({
    queryKey: ["stores", selectedRole],
    queryFn: async () => {
      if (!selectedRole) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores?roleType=${selectedRole}`, { headers });
      const d = await res.json();
      return d.stores ?? d ?? [];
    },
    enabled: !!selectedRole,
  });

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["channels", selectedStore?.id],
    queryFn: async () => {
      if (!selectedStore) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/stores/${selectedStore.id}/channels`, { headers });
      const d = await res.json();
      return d.channels ?? d ?? [];
    },
    enabled: !!selectedStore,
  });

  const instancesQueryKey = ["admin-instances", selectedStore?.id, selectedChannelId, selectedCollectionName];
  const { data: instancesData, isLoading: loadingInstances } = useQuery<{ instances: AdminInstance[] }>({
    queryKey: instancesQueryKey,
    queryFn: async () => {
      if (!selectedStore) return { instances: [] };
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set("storeId", selectedStore.id);
      if (selectedChannelId) params.set("channelId", selectedChannelId);
      if (selectedCollectionName) params.set("collectionName", selectedCollectionName);
      const res = await fetch(`${apiBase}/catalog-instances?${params}`, { headers });
      return res.json();
    },
    enabled: !!selectedStore,
  });

  const instances = instancesData?.instances ?? [];

  const handleRoleChange = (role: string) => {
    setSelectedRole(role as RoleType);
    setSelectedStore(null);
    setSelectedChannelId(null);
    setSelectedCollectionName(null);
    setMobileView("nav");
  };

  const handleStoreChange = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    setSelectedStore(store ?? null);
    setSelectedChannelId(null);
    setSelectedCollectionName(null);
    setMobileView("nav");
  };

  const handleFolderSelect = (channelId: string, collectionName: string | null) => {
    setSelectedChannelId(channelId);
    setSelectedCollectionName(collectionName);
    setMobileView("items");
  };

  const refreshInstances = () => {
    queryClient.invalidateQueries({ queryKey: instancesQueryKey });
  };

  const storeOptions = stores.map(s => ({
    value: s.id, label: s.name, icon: <Store className="h-4 w-4" />,
  }));

  const selectedChannel = channels.find(c => c.id === selectedChannelId);

  // Breadcrumb label for the items view header
  const folderLabel = selectedCollectionName
    ? `${selectedChannel?.name ?? ""} / ${selectedCollectionName}`
    : (selectedChannel?.name ?? "");

  return (
    <div className="space-y-4">
      {/* Role + Store selectors — stacked on mobile, side-by-side on sm+ */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Role</label>
            <CustomDropdown
              value={selectedRole}
              onChange={handleRoleChange}
              options={ROLES.map(r => ({ value: r.value, label: r.label }))}
              placeholder="Pick a role…"
              data-testid="select-role-manager"
            />
          </div>
          <div className="flex-1">
            <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Store</label>
            <CustomDropdown
              value={selectedStore?.id ?? ""}
              onChange={handleStoreChange}
              options={storeOptions}
              placeholder="Select a store…"
              loading={loadingStores}
              disabled={!selectedRole}
              data-testid="select-store-manager"
            />
          </div>
        </div>
      </div>

      {selectedStore && (
        <>
          {/* ── Mobile: back button shown when viewing items ── */}
          {mobileView === "items" && (
            <div className="md:hidden">
              <button
                onClick={() => setMobileView("nav")}
                className="qr-btn qr-btn--ghost qr-btn--touch gap-2 w-full justify-start"
                data-testid="button-back-to-nav"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Channels</span>
              </button>
            </div>
          )}

          {/* ── Two-panel layout ── */}
          {/* Mobile: show only one panel at a time via mobileView state  */}
          {/* Desktop (md+): side-by-side always visible               */}
          <div className="md:flex md:gap-4 md:min-h-[480px]">

            {/* Left: channel tree */}
            <div className={`
              md:w-60 md:flex-shrink-0 md:block md:overflow-y-auto
              glass-card p-3
              ${mobileView === "nav" ? "block" : "hidden"}
            `}>
              <p className="glass-subtitle text-xs uppercase tracking-wider mb-3 px-1">Channels</p>
              {loadingChannels ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              ) : channels.length === 0 ? (
                <p className="text-sm text-white/30 italic px-1 py-4">No channels</p>
              ) : (
                <ChannelTree
                  channels={channels}
                  apiBase={apiBase}
                  getAuthHeaders={getAuthHeaders}
                  storeId={selectedStore.id}
                  selectedChannelId={selectedChannelId}
                  selectedCollectionName={selectedCollectionName}
                  onSelect={handleFolderSelect}
                />
              )}
            </div>

            {/* Right: instance grid */}
            <div className={`
              md:flex-1 md:block md:overflow-y-auto
              ${mobileView === "items" ? "block" : "hidden"}
            `}>
              {!selectedChannelId ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-3">
                  <Hash className="h-9 w-9" />
                  <p className="text-sm">Pick a channel to browse products</p>
                </div>
              ) : loadingInstances ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                </div>
              ) : instances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-3">
                  <Package className="h-9 w-9" />
                  <p className="text-sm text-center px-4">
                    No products in {selectedCollectionName ?? selectedChannel?.name ?? "this folder"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Breadcrumb + count */}
                  <div className="flex items-center gap-2 px-1 flex-wrap gap-y-1">
                    <Hash className="h-4 w-4 text-white/40 flex-shrink-0" />
                    <span className="glass-body text-sm">{selectedChannel?.name}</span>
                    {selectedCollectionName && (
                      <>
                        <ChevronRight className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
                        <Layers className="h-4 w-4 text-purple-400/70 flex-shrink-0" />
                        <span className="glass-body text-sm text-purple-200">{selectedCollectionName}</span>
                      </>
                    )}
                    <span className="ml-auto glass-subtitle text-xs">
                      {instances.length} item{instances.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Cards: single col on mobile, 2-col on xl */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {instances.map(inst => (
                      <InstanceCard
                        key={inst.id}
                        instance={inst}
                        apiBase={apiBase}
                        getAuthHeaders={getAuthHeaders}
                        onDeleted={refreshInstances}
                        onMoved={refreshInstances}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* No store selected yet */}
      {!selectedStore && selectedRole && !loadingStores && stores.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
          <Store className="h-9 w-9" />
          <p className="text-sm">No stores found for this role</p>
        </div>
      )}
    </div>
  );
}
