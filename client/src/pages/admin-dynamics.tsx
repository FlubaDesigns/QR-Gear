import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Zap, Store, Layers, Film, 
  Check, Loader2, Plus, X, Calendar, Clock, 
  Play, Eye, RefreshCw, ExternalLink, ArrowLeft
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { BUILD_SUBNAV } from "@/components/admin/adminNavConfig";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/features/adminAuth/authFetch";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollGridView, QRDynamicsScanLightbox } from "@/features/shared/components/views";
import { ChannelItemSkin, type ChannelItem, CollectionItemSkinV2, type CollectionItem } from "@/features/shared/components/skins";

interface StoreOption {
  id: string;
  name: string;
  roleType: string;
  availableSegments: string[];
}

interface DynamicsPacket {
  id: string;
  packetId: string;
  name: string;
  qrProductType: 'qr-canvas' | 'qr-play';
  thumbnailUrl: string;
  landingPageSlug: string;
  landingPageUrl: string | null;
  storeId: string;
  channelId: string;
}

interface DynamicsSlot {
  slotId: string;
  packetId: string;
  durationSeconds: number;
  order: number;
  packet?: DynamicsPacket;
}

interface DynamicsInstance {
  id: string;
  createdAt: number;
  startTimestamp: number;
  mode: string;
  fallbackUrl?: string;
  slots: DynamicsSlot[];
}

interface PreviewData {
  nowEpoch: number;
  elapsed: number;
  cycleLength: number;
  position: number;
  activeIndex: number;
  totalSlots: number;
  activeSlot: {
    slotId: string;
    packetId: string;
    durationSeconds: number;
    order: number;
    packet?: {
      name: string;
      thumbnailUrl: string;
      landingPageSlug: string;
      qrProductType: string;
    };
  } | null;
  timeRemainingSeconds: number;
  nextSlotIndex: number;
}

const DURATION_PRESETS = [
  { label: '1 minute', seconds: 60 },
  { label: '5 minutes', seconds: 300 },
  { label: '15 minutes', seconds: 900 },
  { label: '30 minutes', seconds: 1800 },
  { label: '1 hour', seconds: 3600 },
  { label: '6 hours', seconds: 21600 },
  { label: '12 hours', seconds: 43200 },
  { label: '1 day', seconds: 86400 },
  { label: '1 week', seconds: 604800 },
  { label: '1 month', seconds: 2592000 },
];

function formatDuration(seconds: number): string {
  const preset = DURATION_PRESETS.find(p => p.seconds === seconds);
  if (preset) return preset.label;
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

export default function TestDynamicsPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { getAuthHeaders } = useAdminAuth();

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  
  const [packets, setPackets] = useState<DynamicsPacket[]>([]);
  const [slots, setSlots] = useState<DynamicsSlot[]>([]);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPacketForDuration, setSelectedPacketForDuration] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStores();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      const qrGear = stores.find(s => s.id === 'qr-gear' || s.name.toLowerCase().includes('qr gear'));
      setSelectedStore(qrGear || stores[0]);
    }
  }, [stores, selectedStore]);

  useEffect(() => {
    if (selectedStore) {
      fetchChannels();
    } else {
      setChannels([]);
      setSelectedChannel(null);
    }
  }, [selectedStore]);

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  useEffect(() => {
    if (selectedStore && selectedChannel) {
      fetchPackets();
    } else {
      setPackets([]);
    }
  }, [selectedStore, selectedChannel]);

  const packetItems: ChannelItem[] = useMemo(() => {
    return packets.map(p => ({
      id: p.packetId,
      name: p.name,
      contentType: p.qrProductType === 'qr-play' ? 'video' as const : 'image' as const,
      imageUrl: p.thumbnailUrl,
    }));
  }, [packets]);

  const totalCycleSeconds = useMemo(() => {
    return slots.reduce((acc, s) => acc + s.durationSeconds, 0);
  }, [slots]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="glass-card max-w-md text-center">
          <h1 className="text-xl font-bold text-white mb-4">Authentication Required</h1>
          <p className="text-blue-200 mb-4">Please sign in to access QR Dynamics.</p>
          <a href="/" className="qr-btn qr-btn--primary qr-btn--touch">Go to Home</a>
        </div>
      </div>
    );
  }

  const fetchStores = async () => {
    try {
      setLoading("stores");
      const res = await authFetch("/api/admin/stores", getAuthHeaders);
      const data = await res.json();
      setStores(Array.isArray(data) ? data : (data.stores || []));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const fetchChannels = async () => {
    if (!selectedStore) return;
    try {
      setLoading("channels");
      const res = await authFetch(`/api/admin/stores/${selectedStore.id}/channels`, getAuthHeaders);
      const data = await res.json();
      const channelNames = Array.isArray(data) 
        ? data.map((c: any) => c.name || c.id) 
        : [];
      setChannels(channelNames);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const fetchPackets = async () => {
    if (!selectedStore || !selectedChannel) return;
    try {
      setLoading("packets");
      const res = await apiRequest("GET", `/api/dynamics/packets?storeId=${selectedStore.id}&channelId=${selectedChannel}`);
      const data = await res.json();
      setPackets(data.packets || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const addSlot = (packet: DynamicsPacket, durationSeconds: number = 86400) => {
    const existingSlot = slots.find(s => s.packetId === packet.packetId);
    if (existingSlot) {
      showError("This content is already in the rotation");
      return;
    }

    const newSlot: DynamicsSlot = {
      slotId: `slot-${Date.now()}`,
      packetId: packet.packetId,
      durationSeconds,
      order: slots.length + 1,
      packet,
    };
    setSlots(prev => [...prev, newSlot]);
    showSuccess(`Added "${packet.name}" to rotation`);
  };

  const removeSlot = (slotId: string) => {
    setSlots(prev => {
      const filtered = prev.filter(s => s.slotId !== slotId);
      return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
    });
  };

  const updateSlotDuration = (slotId: string, durationSeconds: number) => {
    setSlots(prev => prev.map(s => 
      s.slotId === slotId ? { ...s, durationSeconds } : s
    ));
    setSelectedPacketForDuration(null);
  };

  const moveSlot = (slotId: string, direction: 'up' | 'down') => {
    setSlots(prev => {
      const idx = prev.findIndex(s => s.slotId === slotId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;

      const newSlots = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newSlots[idx], newSlots[targetIdx]] = [newSlots[targetIdx], newSlots[idx]];
      return newSlots.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const createInstance = async () => {
    if (slots.length === 0) {
      showError("Add at least one slot to create an instance");
      return;
    }

    try {
      setLoading("creating");
      const res = await apiRequest("POST", "/api/dynamics/instances", {
        slots: slots.map(s => ({
          slotId: s.slotId,
          packetId: s.packetId,
          durationSeconds: s.durationSeconds,
          order: s.order,
        })),
      });
      const data = await res.json();
      if (data.success) {
        setInstanceId(data.instanceId);
        showSuccess(`Instance created! Resolver URL: ${data.resolverUrl}`);
        fetchPreview(data.instanceId);
      } else {
        showError(data.error || "Failed to create instance");
      }
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const fetchPreview = async (id?: string) => {
    const targetId = id || instanceId;
    if (!targetId) return;

    try {
      setLoading("preview");
      const res = await apiRequest("GET", `/api/dynamics/instances/${targetId}/preview`);
      const data = await res.json();
      if (data.success) {
        setPreview(data);
      }
    } catch (err: any) {
      console.error("Preview error:", err);
    } finally {
      setLoading(null);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const handlePacketAction = (item: ChannelItem) => {
    const packet = packets.find(p => p.packetId === item.id);
    if (packet) {
      addSlot(packet, 86400);
    }
  };

  const ChannelSkin = (props: { item: ChannelItem; onAction?: (item: ChannelItem) => void }) => (
    <ChannelItemSkin {...props} />
  );

  return (
    <AdminShell
      title="QR Dynamics V2"
      icon={Zap}
      subtitle="Build time-based rotating QR content with precise duration control"
      backHref="/admin/products"
      backLabel="Back to Products"
      sectionNav={<AdminSectionSubNav items={BUILD_SUBNAV} />}
    >
        {error && (
          <div className="glass-card bg-red-500/20 border-red-500/50">
            <p className="text-red-200">{error}</p>
            <button onClick={() => setError(null)} className="qr-btn qr-btn--outline qr-btn--sm mt-2">
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="glass-card bg-green-500/20 border-green-500/50">
            <p className="text-green-200 flex items-center gap-2">
              <Check className="h-5 w-5" />
              {successMessage}
            </p>
          </div>
        )}

        <div className="glass-card">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-5 w-5 text-blue-400" />
            <span className="text-white font-medium">
              {selectedStore?.name || "Loading..."} / {selectedChannel || "..."}
            </span>
            {(loading === "stores" || loading === "channels") && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            )}
          </div>
          
          <div className="flex gap-2">
            <Select
              value={selectedStore?.id || ""}
              onValueChange={(val) => {
                const store = stores.find(s => s.id === val);
                setSelectedStore(store || null);
                setSelectedChannel(null);
              }}
            >
              <SelectTrigger className="flex-1" data-testid="select-store">
                <SelectValue placeholder="Store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedChannel || ""}
              onValueChange={(val) => {
                setSelectedChannel(val);
              }}
            >
              <SelectTrigger className="flex-1" data-testid="select-channel">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {channels.map(channel => (
                  <SelectItem key={channel} value={channel}>
                    {channel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedStore && selectedChannel && (
          <>
            <div className="glass-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Film className="h-5 w-5 text-blue-400" />
                  Available Content ({packets.length})
                  <Badge variant="outline" className="text-xs">QR Canvas + QR Play only</Badge>
                </h3>
                {loading === "packets" && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
              </div>

              {packets.length === 0 ? (
                <div className="text-center py-6 text-blue-300 bg-slate-800/50 rounded-lg">
                  <Film className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No QR Canvas or QR Play content in this channel.</p>
                </div>
              ) : (
                <ScrollGridView
                  items={packetItems}
                  renderItem={(item) => (
                    <ChannelSkin item={item} onAction={handlePacketAction ? () => handlePacketAction(item) : undefined} />
                  )}
                  columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                  height="280px"
                  emptyMessage="No content available"
                  footer={null}
                />
              )}
            </div>

            <div className="glass-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-400" />
                  Rotation Slots ({slots.length})
                </h3>
                {slots.length > 0 && (
                  <Badge className="bg-purple-600">
                    Total: {formatDuration(totalCycleSeconds)}
                  </Badge>
                )}
              </div>

              {slots.length === 0 ? (
                <div className="text-center py-6 text-purple-300 bg-slate-800/50 rounded-lg">
                  <Layers className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Tap content above to add slots</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slots.map((slot, idx) => (
                    <div 
                      key={slot.slotId} 
                      className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700"
                    >
                      <div className="w-8 h-8 flex items-center justify-center bg-purple-600 rounded text-white text-sm font-bold">
                        {slot.order}
                      </div>
                      
                      {slot.packet?.thumbnailUrl && (
                        <img 
                          src={slot.packet.thumbnailUrl} 
                          alt={slot.packet?.name || 'Slot'} 
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">
                          {slot.packet?.name || slot.packetId}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={String(slot.durationSeconds)}
                            onValueChange={(val) => updateSlotDuration(slot.slotId, parseInt(val))}
                          >
                            <SelectTrigger className="h-7 w-28 bg-slate-700 border-slate-600 text-white text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DURATION_PRESETS.map(p => (
                                <SelectItem key={p.seconds} value={String(p.seconds)}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Badge variant="outline" className="text-xs">
                            {slot.packet?.qrProductType === 'qr-play' ? 'Video' : 'Image'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6"
                          onClick={() => moveSlot(slot.slotId, 'up')}
                          disabled={idx === 0}
                        >
                          <ArrowLeft className="h-3 w-3 rotate-90" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6"
                          onClick={() => moveSlot(slot.slotId, 'down')}
                          disabled={idx === slots.length - 1}
                        >
                          <ArrowLeft className="h-3 w-3 -rotate-90" />
                        </Button>
                      </div>
                      
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        onClick={() => removeSlot(slot.slotId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {slots.length > 0 && (
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={createInstance}
                    disabled={loading === "creating"}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    data-testid="button-create-instance"
                  >
                    {loading === "creating" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Instance
                  </Button>
                </div>
              )}
            </div>

            {instanceId && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Eye className="h-5 w-5 text-green-400" />
                    Live Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Instance ID</span>
                    <code className="text-green-400 text-xs bg-muted px-2 py-1 rounded">
                      {instanceId}
                    </code>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Resolver URL</span>
                    <a 
                      href={`/qr/d/${instanceId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-xs flex items-center gap-1 hover:underline"
                    >
                      /qr/d/{instanceId.slice(0, 8)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {preview && (
                    <>
                      <div className="border-t border-slate-700 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">Currently Active</span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => fetchPreview()}
                            disabled={loading === "preview"}
                          >
                            {loading === "preview" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Refresh
                          </Button>
                        </div>
                        
                        {preview.activeSlot && (
                          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                            {preview.activeSlot.packet?.thumbnailUrl && (
                              <img 
                                src={preview.activeSlot.packet.thumbnailUrl}
                                alt={preview.activeSlot.packet?.name || 'Active'}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <p className="text-white font-medium">
                                {preview.activeSlot.packet?.name || 'Unknown'}
                              </p>
                              <p className="text-slate-400 text-xs mt-1">
                                Slot {preview.activeIndex + 1} of {preview.totalSlots}
                              </p>
                              <p className="text-green-400 text-sm mt-1">
                                {formatTimeRemaining(preview.timeRemainingSeconds)} remaining
                              </p>
                            </div>
                            <Badge className="bg-green-600">
                              <Play className="h-3 w-3 mr-1" />
                              Live
                            </Badge>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <div className="bg-slate-900/30 p-2 rounded">
                            <span className="text-slate-400">Cycle Length</span>
                            <p className="text-white">{formatDuration(preview.cycleLength)}</p>
                          </div>
                          <div className="bg-slate-900/30 p-2 rounded">
                            <span className="text-slate-400">Next Slot</span>
                            <p className="text-white">#{preview.nextSlotIndex + 1}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
    </AdminShell>
  );
}
