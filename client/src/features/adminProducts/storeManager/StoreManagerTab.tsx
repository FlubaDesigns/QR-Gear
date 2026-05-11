import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store, Hash, Layers, ChevronRight, ChevronDown,
  Loader2, Trash2, MoveRight, Check, X, Package, ExternalLink, RefreshCw
} from "lucide-react";
import { createPortal } from "react-dom";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";
import type { RoleType, Store as StoreType, Channel, Collection } from "../shared/types";
import { getColorHexByName } from "@/features/storeBuilder/store-builder-types";

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
    pricing?: {
      customerPrice?: number;
      markupPercent?: number;
      markupFixed?: number;
      markupAmount?: number;
    };
  };
  baseSnapshot?: {
    minPrice?: number;
    maxPrice?: number;
  };
  enabledColors?: string[];
  enabledSizes?: string[];
  colorMap?: Record<string, string>;
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

function ColorToggle({ color, enabled, onToggle, colorMap }: {
  color: string;
  enabled: boolean;
  onToggle: () => void;
  colorMap?: Record<string, string>;
}) {
  const isHex = color.startsWith("#");
  // 1. Stored hex from colorMap (exact Printify/Printful value)
  // 2. Raw value if already a hex string
  // 3. Canonical name→hex lookup for common Printify/Printful color names
  const bgColor = colorMap?.[color] ?? (isHex ? color : getColorHexByName(color));
  const displayName = color.length > 10 ? color.slice(0, 9) + "…" : color;
  return (
    <button
      onClick={onToggle}
      title={color}
      data-testid={`toggle-color-${color}`}
      className="flex flex-col items-center gap-1.5 focus:outline-none flex-shrink-0"
    >
      <div
        className={`relative w-9 h-9 rounded-md border-2 transition-all flex items-center justify-center bg-white/10
          ${enabled ? "border-white/70" : "border-white/15 opacity-30"}`}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        {!bgColor && (
          <span className={`text-[9px] font-bold leading-none uppercase ${enabled ? "text-white" : "text-white/60"}`}>
            {color.slice(0, 3)}
          </span>
        )}
        {enabled && (
          <Check className="absolute h-3.5 w-3.5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
        )}
      </div>
      <span className={`text-[10px] leading-none text-center max-w-[3.5rem] truncate transition-opacity
        ${enabled ? "text-white/65" : "text-white/25"}`}>
        {displayName}
      </span>
    </button>
  );
}

function SizeChip({ size, enabled, onToggle }: { size: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative px-3 py-2 rounded-md text-sm font-medium border transition-all min-h-[2.25rem] min-w-[2.75rem] flex items-center justify-center gap-1.5
        ${enabled
          ? "border-white/35 bg-white/12 text-white"
          : "border-white/10 bg-transparent text-white/25 opacity-40"
        }`}
      data-testid={`toggle-size-${size}`}
    >
      {enabled && <Check className="h-3 w-3 flex-shrink-0 text-white/70" />}
      {size}
    </button>
  );
}

function MoveDialog({
  instance,
  onClose,
  onMoved,
}: {
  instance: AdminInstance;
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
      const d = await adminFetch<any>(`/stores?roleType=${role}`);
      return d.stores ?? d ?? [];
    },
    enabled: !!role,
  });

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["channels", destStore?.id],
    queryFn: async () => {
      if (!destStore) return [];
      const d = await adminFetch<any>(`/stores/${destStore.id}/channels`);
      return d.channels ?? d ?? [];
    },
    enabled: !!destStore,
  });

  const { data: collections = [], isLoading: loadingCollections } = useQuery<Collection[]>({
    queryKey: ["collections", destStore?.id, destChannel?.id],
    queryFn: async () => {
      if (!destStore || !destChannel) return [];
      const d = await adminFetch<any>(`/stores/${destStore.id}/channels/${destChannel.id}/collections`);
      const raw: any[] = d.collections ?? (Array.isArray(d) ? d : []);
      return raw.map(c => typeof c === "string" ? { name: c } : c);
    },
    enabled: !!destStore && !!destChannel,
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
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
      await adminFetch(`/catalog-instances/${instance.id}`, { method: "PATCH", json: { folderUpdate } });
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
  const existingCollectionNames = collections.map(c => c.name);

  const canMove = !!destStore && !!destChannel;

  return (
    <div className="mt-3 p-3 rounded-lg border border-white/15 bg-white/5 space-y-3">
      <p className="glass-subtitle text-xs uppercase tracking-wider">Move to</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CustomDropdown value={role} onChange={v => { setRole(v as RoleType); setDestStore(null); setDestChannel(null); }} options={ROLES.map(r => ({ value: r.value, label: r.label }))} placeholder="Role..." />
        <CustomDropdown value={destStore?.id ?? ""} onChange={v => { const s = stores.find(x => x.id === v); setDestStore(s ?? null); setDestChannel(null); }} options={storeOptions} placeholder="Store..." loading={loadingStores} disabled={!role} />
        <CustomDropdown value={destChannel?.id ?? ""} onChange={v => { const c = channels.find(x => x.id === v); setDestChannel(c ?? null); setDestCollection(null); }} options={channelOptions} placeholder="Channel..." loading={loadingChannels} disabled={!destStore} />
        {/* Collection: free-text with autocomplete so new names (e.g. "Armed Forces") can be entered */}
        <div className="relative">
          <datalist id="move-collection-list">
            {existingCollectionNames.map(n => <option key={n} value={n} />)}
          </datalist>
          <input
            list="move-collection-list"
            value={destCollection?.name ?? ""}
            onChange={e => setDestCollection(e.target.value.trim() ? { name: e.target.value } : null)}
            placeholder={loadingCollections ? "Loading…" : "Collection (optional)…"}
            disabled={!destChannel || loadingCollections}
            className="w-full min-h-12 text-base px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-ice-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="input-collection-name"
          />
        </div>
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
  onDeleted,
  onMoved,
  highlighted,
}: {
  instance: AdminInstance;
  onDeleted: () => void;
  onMoved: () => void;
  highlighted?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showMove, setShowMove] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const toStr = (v: any): string => typeof v === 'string' ? v : v?.name || v?.label || v?.hex || String(v ?? '');
  const allColors = (instance.resolved?.colors ?? []).map(toStr).filter(Boolean);
  const allSizes = (instance.resolved?.sizes ?? []).map(toStr).filter(Boolean);
  const enabledColors = instance.enabledColors?.length ? instance.enabledColors : allColors;
  const enabledSizes = instance.enabledSizes?.length ? instance.enabledSizes : allSizes;

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      adminFetch(`/catalog-instances/${instance.id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-instances"] });
    },
    onError: () => toast({ title: "Error", description: "Could not save changes.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/catalog-instances/${instance.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteOpen(false);
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

  const imageUrl = getImageUrl(instance);
  const title = instance.resolved?.title ?? "Untitled";
  const customerPrice = instance.resolved?.pricing?.customerPrice;

  return (
    <div
      className={`glass-card p-4 transition-all duration-300${highlighted ? " ring-2 ring-white/50" : ""}`}
      data-testid={`card-instance-${instance.id}`}
    >
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
          {customerPrice != null && (
            <p className="glass-subtitle text-xs mt-1.5">
              Price: ${customerPrice.toFixed(2)}
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

      {/* Combined Colors & Sizes accordion */}
      {(allColors.length > 0 || allSizes.length > 0) && (
        <AccordionSection label="Colors & Sizes" defaultOpen={true}>
          {allColors.length > 0 && (
            <div className="mb-4">
              <p className="glass-subtitle text-[11px] uppercase tracking-wider mb-2.5">
                Colors <span className="normal-case opacity-60">({enabledColors.length}/{allColors.length} on)</span>
              </p>
              <div className="flex flex-wrap gap-3">
                {allColors.map(color => (
                  <ColorToggle
                    key={color}
                    color={color}
                    enabled={enabledColors.includes(color)}
                    onToggle={() => toggleColor(color)}
                    colorMap={instance.colorMap}
                  />
                ))}
              </div>
            </div>
          )}
          {allSizes.length > 0 && (
            <div>
              <p className="glass-subtitle text-[11px] uppercase tracking-wider mb-2.5">
                Sizes <span className="normal-case opacity-60">({enabledSizes.length}/{allSizes.length} on)</span>
              </p>
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
            </div>
          )}
        </AccordionSection>
      )}


      {/* Actions accordion — Move only */}
      <AccordionSection label="Actions">
        <div className="flex gap-2">
          <button
            onClick={() => { setShowMove(!showMove); }}
            className="qr-btn qr-btn--outline qr-btn--touch flex-1 gap-2"
            data-testid={`button-move-${instance.id}`}
          >
            <MoveRight className="h-4 w-4" /> Move
          </button>
        </div>
        {showMove && (
          <MoveDialog
            instance={instance}
            onClose={() => setShowMove(false)}
            onMoved={onMoved}
          />
        )}
      </AccordionSection>

      {/* Bottom-right delete */}
      <div className="flex justify-end mt-2 pt-2 border-t border-white/10">
        <button
          onClick={() => setDeleteOpen(true)}
          className="p-2 text-white/40 hover-elevate rounded"
          title="Remove from store"
          data-testid={`button-delete-${instance.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{title}</strong> from the store. The underlying packet and template are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-delete-${instance.id}`}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid={`button-confirm-delete-${instance.id}`}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightboxOpen && imageUrl && (
        <ImageLightbox url={imageUrl} alt={title} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}


function CollectionList({
  storeId,
  channel,
  selectedCollectionName,
  onSelect,
  onCollectionDeleted,
}: {
  storeId: string;
  channel: Channel;
  selectedCollectionName: string | null;
  onSelect: (name: string) => void;
  onCollectionDeleted: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmCol, setConfirmCol] = useState<string | null>(null);
  const [deleteColOpen, setDeleteColOpen] = useState(false);

  const { data: collections = [], isLoading } = useQuery<Collection[]>({
    queryKey: ["collections", storeId, channel.id],
    queryFn: async () => {
      const d = await adminFetch<any>(`/stores/${storeId}/channels/${channel.id}/collections`);
      const raw: any[] = d.collections ?? (Array.isArray(d) ? d : []);
      return raw.map(c => typeof c === "string" ? { name: c } : c);
    },
  });

  const deleteColMutation = useMutation({
    mutationFn: (colName: string) =>
      adminFetch(`/stores/${storeId}/channels/${channel.id}/collections/${encodeURIComponent(colName)}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Collection deleted" });
      setConfirmCol(null);
      setDeleteColOpen(false);
      queryClient.invalidateQueries({ queryKey: ["collections", storeId, channel.id] });
      onCollectionDeleted();
    },
    onError: () => toast({ title: "Error", description: "Could not delete collection.", variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="pl-9 py-2"><Loader2 className="h-4 w-4 animate-spin text-white/30" /></div>;
  }

  if (!collections.length) {
    return <p className="pl-9 py-2 text-xs text-white/25 italic">No collections</p>;
  }

  return (
    <>
      <div className="pl-6 space-y-0.5 mt-1">
        {collections.map(col => {
          const isSelected = selectedCollectionName === col.name;
          return (
            <div key={col.name} className="flex items-center gap-1 group">
              <button
                onClick={() => onSelect(col.name)}
                className={`flex-1 flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-left transition-all hover-elevate
                  ${isSelected ? "bg-purple-500/20 text-purple-200" : "glass-subtitle"}`}
                data-testid={`button-select-collection-${col.name}`}
              >
                <Layers className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{col.name}</span>
              </button>
              <button
                onClick={() => { setConfirmCol(col.name); setDeleteColOpen(true); }}
                className="p-2 text-white/40 hover-elevate rounded flex-shrink-0"
                data-testid={`button-delete-collection-${col.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <AlertDialog open={deleteColOpen} onOpenChange={(o) => { setDeleteColOpen(o); if (!o) setConfirmCol(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete collection?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>"{confirmCol}"</strong>? Products inside will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmCol && deleteColMutation.mutate(confirmCol)}
              disabled={deleteColMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteColMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ChannelTree({
  channels,
  storeId,
  selectedChannelId,
  selectedCollectionName,
  onSelect,
  onChannelDeleted,
}: {
  channels: Channel[];
  storeId: string;
  selectedChannelId: string | null;
  selectedCollectionName: string | null;
  onSelect: (channelId: string, collectionName: string | null) => void;
  onChannelDeleted: () => void;
}) {
  const { toast } = useToast();
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [confirmChannelId, setConfirmChannelId] = useState<string | null>(null);
  const [deleteChannelOpen, setDeleteChannelOpen] = useState(false);

  const toggleExpand = (channelId: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev);
      next.has(channelId) ? next.delete(channelId) : next.add(channelId);
      return next;
    });
  };

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId: string) =>
      adminFetch(`/stores/${storeId}/channels/${channelId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Channel deleted" });
      setConfirmChannelId(null);
      setDeleteChannelOpen(false);
      onChannelDeleted();
    },
    onError: () => toast({ title: "Error", description: "Could not delete channel.", variant: "destructive" }),
  });

  const pendingChannel = channels.find(c => c.id === confirmChannelId);

  return (
    <>
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
              <button
                onClick={() => { setConfirmChannelId(channel.id); setDeleteChannelOpen(true); }}
                className="p-2 text-white/40 hover-elevate rounded flex-shrink-0"
                data-testid={`button-delete-channel-${channel.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {isExpanded && (
              <CollectionList
                storeId={storeId}
                channel={channel}
                selectedCollectionName={selectedChannelId === channel.id ? selectedCollectionName : null}
                onSelect={name => onSelect(channel.id, name)}
                onCollectionDeleted={onChannelDeleted}
              />
            )}
          </div>
        );
      })}
    </div>

      <AlertDialog open={deleteChannelOpen} onOpenChange={(o) => { setDeleteChannelOpen(o); if (!o) setConfirmChannelId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete channel?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>"{pendingChannel?.name}"</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmChannelId && deleteChannelMutation.mutate(confirmChannelId)}
              disabled={deleteChannelMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteChannelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function StoreManagerTab({ initialPacketId }: { initialPacketId?: string } = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedRole, setSelectedRole] = useState<RoleType | "">("");
  const [selectedStore, setSelectedStore] = useState<StoreType | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [deleteStoreOpen, setDeleteStoreOpen] = useState(false);

  // Auto-select state — populated by the by-packet lookup when initialPacketId is set
  const [autoSelect, setAutoSelect] = useState<{
    roleType: string;
    storeId: string;
    storeName: string;
    channelId: string | null;
    instanceId: string;
  } | null>(null);
  const [highlightedInstanceId, setHighlightedInstanceId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const [deleteStoreError, setDeleteStoreError] = useState<string | null>(null);
  const deleteStoreMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStore) return;
      await adminFetch(`/stores/${selectedStore.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      setDeleteStoreError(null);
      setDeleteStoreOpen(false);
      setSelectedStore(null);
      setSelectedChannelId(null);
      setSelectedCollectionName(null);
      queryClient.invalidateQueries({ queryKey: ["stores", selectedRole] });
      toast({ title: "Store deleted" });
    },
    onError: (err: any) => {
      console.error("[StoreManagerTab] deleteStore error:", err);
      setDeleteStoreError(err?.message || "Could not delete store. Please try again.");
    },
  });

  // ── Fetch instance by packetId on mount ─────────────────────────────────────
  useEffect(() => {
    if (!initialPacketId) return;
    adminFetch<any>(`/catalog-instances/by-packet/${initialPacketId}`)
      .then((data) => {
        const inst = data.instance;
        if (!inst || !data.storeRoleType || !inst.storeId) {
          console.warn("[StoreManagerTab] by-packet lookup: missing instance/store info", data);
          return;
        }
        setAutoSelect({
          roleType: data.storeRoleType,
          storeId: inst.storeId,
          storeName: inst.storeName ?? inst.storeId,
          channelId: inst.channelId ?? null,
          instanceId: inst.id,
        });
        setHighlightedInstanceId(inst.id);
        // Kick off the role selection so the stores query fires
        setSelectedRole(data.storeRoleType as RoleType);
      })
      .catch((err) => {
        console.error("[StoreManagerTab] by-packet lookup failed:", err);
        toast({
          title: "Could not locate product",
          description: "The committed product could not be found. Navigate manually.",
          variant: "destructive",
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPacketId]);

  const { data: stores = [], isLoading: loadingStores } = useQuery<StoreType[]>({
    queryKey: ["stores", selectedRole],
    queryFn: async () => {
      if (!selectedRole) return [];
      const d = await adminFetch<any>(`/stores?roleType=${selectedRole}`);
      return d.stores ?? d ?? [];
    },
    enabled: !!selectedRole,
  });

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["channels", selectedStore?.id],
    queryFn: async () => {
      if (!selectedStore) return [];
      const d = await adminFetch<any>(`/stores/${selectedStore.id}/channels`);
      return d.channels ?? d ?? [];
    },
    enabled: !!selectedStore,
  });

  const instancesQueryKey = ["admin-instances", selectedStore?.id, selectedChannelId, selectedCollectionName];
  const { data: instancesData, isLoading: loadingInstances } = useQuery<{ instances: AdminInstance[] }>({
    queryKey: instancesQueryKey,
    queryFn: async () => {
      if (!selectedStore) return { instances: [] };
      const params = new URLSearchParams();
      params.set("storeId", selectedStore.id);
      if (selectedChannelId) params.set("channelId", selectedChannelId);
      if (selectedCollectionName) params.set("collectionName", selectedCollectionName);
      return adminFetch<any>(`/catalog-instances?${params}`);
    },
    enabled: !!selectedStore,
  });

  // ── Auto-set store once the stores list loads ────────────────────────────────
  useEffect(() => {
    if (!autoSelect || !stores.length || loadingStores) return;
    const store = stores.find(s => s.id === autoSelect.storeId);
    if (store && selectedStore?.id !== store.id) {
      setSelectedStore(store);
      setSelectedChannelId(null);
      setSelectedCollectionName(null);
    }
  }, [autoSelect, stores, loadingStores]);

  // ── Auto-set channel once the channels list loads ────────────────────────────
  useEffect(() => {
    if (!autoSelect || !channels.length || loadingChannels) return;
    if (autoSelect.channelId && selectedChannelId !== autoSelect.channelId) {
      setSelectedChannelId(autoSelect.channelId);
      setSelectedCollectionName(null);
    }
  }, [autoSelect, channels, loadingChannels]);

  // ── Scroll to highlighted instance once it appears ───────────────────────────
  useEffect(() => {
    if (!highlightedInstanceId) return;
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(timer);
  }, [highlightedInstanceId, instancesData]);

  const instances = instancesData?.instances ?? [];

  const handleRoleChange = (role: string) => {
    setSelectedRole(role as RoleType);
    setSelectedStore(null);
    setSelectedChannelId(null);
    setSelectedCollectionName(null);
  };

  const handleStoreChange = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    setSelectedStore(store ?? null);
    setSelectedChannelId(null);
    setSelectedCollectionName(null);
  };

  const handleFolderSelect = (channelId: string, collectionName: string | null) => {
    setSelectedChannelId(channelId);
    setSelectedCollectionName(collectionName);
  };

  const refreshInstances = () => {
    queryClient.invalidateQueries({ queryKey: instancesQueryKey });
  };

  const backfillImagesMutation = useMutation({
    mutationFn: () => adminFetch<any>("/catalog-instances/backfill-all-images", { method: "POST", json: {} }),
    onSuccess: (data) => {
      toast({
        title: "Gallery images rebuilt",
        description: `Updated ${data.updated ?? 0} of ${data.total ?? 0} products.`,
      });
      queryClient.invalidateQueries({ queryKey: instancesQueryKey });
    },
    onError: (err: any) => {
      toast({ title: "Backfill failed", description: err.message, variant: "destructive" });
    },
  });

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
      {/* Role + Store selectors */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="glass-subtitle text-xs uppercase tracking-wider">Store Manager</span>
          <button
            onClick={() => backfillImagesMutation.mutate()}
            disabled={backfillImagesMutation.isPending}
            className="flex items-center gap-1.5 text-xs text-white/30 hover-elevate rounded px-2 py-1"
            title="Rebuild gallery images for all products from their packet mockups"
            data-testid="button-backfill-images"
          >
            {backfillImagesMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            Rebuild gallery images
          </button>
        </div>
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
            <div className="flex gap-2 items-center">
              <div className="flex-1">
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
              {selectedStore && (
                <>
                  <a
                    href={`/shop/${selectedRole}/${selectedStore.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-white/40 hover-elevate rounded flex-shrink-0 mt-0.5"
                    data-testid="link-visit-store"
                    title="Visit store"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => setDeleteStoreOpen(true)}
                    className="p-2 text-white/40 hover-elevate rounded flex-shrink-0 mt-0.5"
                    data-testid="button-delete-store"
                    title="Delete store"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
          </div>
        </div>
      </div>
      </div>

      {selectedStore && (
        <>
          {/* ── Two-panel layout: stacked on mobile, side-by-side on desktop ── */}
          <div className="flex flex-col md:flex-row gap-4">

            {/* Left: channel tree */}
            <div className="md:w-60 md:flex-shrink-0 glass-card p-3">
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
                  storeId={selectedStore.id}
                  selectedChannelId={selectedChannelId}
                  selectedCollectionName={selectedCollectionName}
                  onSelect={handleFolderSelect}
                  onChannelDeleted={() => {
                    queryClient.invalidateQueries({ queryKey: ["channels", selectedStore?.id] });
                    setSelectedChannelId(null);
                    setSelectedCollectionName(null);
                  }}
                />
              )}
            </div>

            {/* Right: instance grid — always visible */}
            <div className="flex-1 min-w-0">
              {loadingInstances ? (
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
                    {instances.map(inst => {
                      const isHighlighted = inst.id === highlightedInstanceId;
                      return (
                        <div
                          key={inst.id}
                          ref={isHighlighted ? (el) => { highlightRef.current = el; } : undefined}
                        >
                          <InstanceCard
                            instance={inst}
                            onDeleted={refreshInstances}
                            onMoved={refreshInstances}
                            highlighted={isHighlighted}
                          />
                        </div>
                      );
                    })}
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

      <AlertDialog open={deleteStoreOpen} onOpenChange={(open) => { if (!deleteStoreMutation.isPending) { setDeleteStoreOpen(open); setDeleteStoreError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete store?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>"{selectedStore?.name}"</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteStoreError && (
            <p className="text-sm text-destructive px-1">{deleteStoreError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStoreMutation.isPending} data-testid="button-cancel-delete-store">Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => deleteStoreMutation.mutate()}
              disabled={deleteStoreMutation.isPending}
              data-testid="button-confirm-delete-store"
            >
              {deleteStoreMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete store"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
