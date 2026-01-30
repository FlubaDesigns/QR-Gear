import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Zap, Store, Layers, LayoutGrid, RefreshCw, Clock, Play, Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface StoreOption {
  id: string;
  name: string;
  roleType: string;
  availableSegments: string[];
}

interface CollectionItem {
  id: string;
  linkId: string;
  packetId: string | null;
  name: string;
  imageUrl: string | null;
  mockupUrl: string | null;
  qrProductState: string | null;
  landingPageUrl: string | null;
}

interface Surface {
  id: string;
  name: string;
  storeId: string;
  channelId: string;
  collectionName: string;
  rotationInterval: string;
  isEnabled: boolean;
}

interface ResolverResult {
  success: boolean;
  surfaceId: string;
  isEnabled: boolean;
  rotationInterval: string;
  totalItems: number;
  activeIndex: number;
  activeItem: {
    id: string;
    packetId: string;
    name: string;
    imageUrl: string;
    mockupUrl: string;
    landingPageUrl: string;
    qrProductState: string;
  } | null;
  nextSwitch: string;
  serverNowIso: string;
}

const ROTATION_OPTIONS = [
  { value: "daily", label: "Daily", description: "Rotates at midnight" },
  { value: "weekly", label: "Weekly", description: "Rotates every Sunday" },
  { value: "monthly", label: "Monthly", description: "Rotates on the 1st" },
];

export default function TestDynamicsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlStoreId = urlParams.get("storeId");
  const urlChannel = urlParams.get("channel");

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [rotationInterval, setRotationInterval] = useState<string>("daily");
  
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [selectedSurface, setSelectedSurface] = useState<Surface | null>(null);
  const [resolverResult, setResolverResult] = useState<ResolverResult | null>(null);
  
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [urlParamsApplied, setUrlParamsApplied] = useState(false);
  
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetchStores();
      fetchSurfaces();
    }
  }, [isAuthenticated]);

  // Fetch channels when store is selected
  useEffect(() => {
    if (selectedStore) {
      fetchChannels();
    } else {
      setChannels([]);
      setSelectedChannel(null);
    }
  }, [selectedStore]);

  // Auto-select store/channel from URL params after stores are loaded
  useEffect(() => {
    if (stores.length > 0 && urlStoreId && !urlParamsApplied) {
      const matchingStore = stores.find(s => s.id === urlStoreId);
      if (matchingStore) {
        setSelectedStore(matchingStore);
        // Channel will be set after channels are fetched
        setUrlParamsApplied(true);
      }
    }
  }, [stores, urlStoreId, urlParamsApplied]);

  // Auto-select channel from URL params after channels are loaded
  useEffect(() => {
    if (channels.length > 0 && urlChannel && urlParamsApplied && !selectedChannel) {
      if (channels.includes(urlChannel)) {
        setSelectedChannel(urlChannel);
      }
    }
  }, [channels, urlChannel, urlParamsApplied, selectedChannel]);

  useEffect(() => {
    if (selectedStore && selectedChannel) {
      fetchCollections();
    } else {
      setCollections([]);
      setSelectedCollection(null);
    }
  }, [selectedStore, selectedChannel]);

  useEffect(() => {
    if (selectedStore && selectedChannel && selectedCollection) {
      fetchCollectionItems();
    } else {
      setCollectionItems([]);
    }
  }, [selectedStore, selectedChannel, selectedCollection]);
  
  // Auth check - must be AFTER all hooks
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
          <Link href="/">
            <a className="qr-btn qr-btn--primary qr-btn--touch">Go to Home</a>
          </Link>
        </div>
      </div>
    );
  }

  const fetchStores = async () => {
    try {
      setLoading("stores");
      const res = await fetch("/api/test/stores");
      const data = await res.json();
      // API returns array directly, not { stores: [] }
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
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels`);
      const data = await res.json();
      // Extract channel names from the response
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

  const fetchCollections = async () => {
    if (!selectedStore || !selectedChannel) return;
    try {
      setLoading("collections");
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels/${selectedChannel}/collections`);
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const fetchCollectionItems = async () => {
    if (!selectedStore || !selectedChannel || !selectedCollection) return;
    try {
      setLoading("items");
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels/${selectedChannel}/collections/${encodeURIComponent(selectedCollection)}/items`);
      const data = await res.json();
      setCollectionItems(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const fetchSurfaces = async () => {
    try {
      const res = await fetch("/api/test/dynamics/surfaces");
      const data = await res.json();
      setSurfaces(data.surfaces || []);
    } catch (err: any) {
      console.error("Error fetching surfaces:", err);
    }
  };

  const createCollection = async () => {
    if (!selectedStore || !selectedChannel || !newCollectionName.trim()) {
      setError("Please select store, channel, and enter a collection name");
      return;
    }
    try {
      setLoading("creating");
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels/${selectedChannel}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCollectionName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Collection "${newCollectionName}" created`);
        setCollections(prev => [...prev, newCollectionName.trim()].sort());
        setSelectedCollection(newCollectionName.trim());
        setNewCollectionName("");
        setShowCreateCollection(false);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "Failed to create collection");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const createSurface = async () => {
    if (!selectedStore || !selectedChannel || !selectedCollection) {
      setError("Please select store, channel, and collection first");
      return;
    }
    try {
      setLoading("creating");
      const res = await fetch("/api/test/dynamics/surfaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${selectedStore.name} / ${selectedChannel} / ${selectedCollection}`,
          storeId: selectedStore.id,
          channelId: selectedChannel,
          collectionName: selectedCollection,
          rotationInterval,
          isEnabled: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Surface created: ${data.surfaceId}`);
        fetchSurfaces();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "Failed to create surface");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const resolveSurface = async (surface: Surface) => {
    try {
      setLoading("resolving");
      setSelectedSurface(surface);
      const res = await fetch(`/api/test/dynamics/resolve/${surface.id}`);
      const data = await res.json();
      setResolverResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="page-wrap" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
            <Zap className="h-5 w-5 text-yellow-400" />
            QR Dynamics Builder
          </h1>
          <p className="text-base text-blue-200 mb-4">
            Create rotating content that changes on a schedule
          </p>
          <Link href="/test-products" className="block">
            <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full qr-btn--xl" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
              Back to Products
            </button>
          </Link>
        </div>

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
          <h2 className="glass-title text-base flex items-center gap-2 mb-4">
            <Store className="h-5 w-5 text-blue-400" />
            1. Select Source
          </h2>

          <div className="space-y-4">
            {/* Show summary if store/channel came from URL params */}
            {urlStoreId && urlChannel && selectedStore && selectedChannel ? (
              <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
                <p className="text-blue-200 text-sm">
                  <span className="font-medium">Store:</span> {selectedStore.name}
                </p>
                <p className="text-blue-200 text-sm mt-1">
                  <span className="font-medium">Channel:</span> {selectedChannel}
                </p>
                <button
                  onClick={() => {
                    setSelectedStore(null);
                    setSelectedChannel(null);
                    setChannels([]);
                    setCollections([]);
                    setSelectedCollection(null);
                  }}
                  className="text-xs text-blue-300 underline mt-2"
                >
                  Change selection
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm text-blue-200 mb-2 block">Store</label>
                  <div className="relative">
                    <select
                      value={selectedStore?.id || ""}
                      onChange={(e) => {
                        const store = stores.find(s => s.id === e.target.value);
                        setSelectedStore(store || null);
                        setSelectedChannel(null);
                        setSelectedCollection(null);
                      }}
                      className="w-full h-14 px-4 rounded-md border bg-slate-800 text-white text-base appearance-none cursor-pointer"
                      data-testid="select-store"
                    >
                      <option value="">Select a store...</option>
                      {stores.map(store => (
                        <option key={store.id} value={store.id}>
                          {store.name} ({store.roleType})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-300 pointer-events-none" />
                  </div>
                </div>

                {selectedStore && (
              <div>
                <label className="text-sm text-blue-200 mb-2 block">
                  Channel
                  {loading === "channels" && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
                </label>
                {channels.length === 0 && loading !== "channels" ? (
                  <p className="text-blue-300/70 text-sm">
                    No channels found for this store. Create a channel first.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {channels.map(channel => (
                      <button
                        key={channel}
                        onClick={() => {
                          setSelectedChannel(channel);
                          setSelectedCollection(null);
                        }}
                        className={`qr-btn qr-btn--touch qr-btn--full ${selectedChannel === channel ? "qr-btn--primary" : "qr-btn--outline"}`}
                        data-testid={`channel-${channel}`}
                      >
                        {channel}
                      </button>
                    ))}
                  </div>
                )}
              </div>
                )}
              </>
            )}

            {selectedChannel && (
              <div>
                <label className="text-sm text-blue-200 mb-2 block">
                  Collection
                  {loading === "collections" && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
                </label>
                
                {collections.length > 0 && (
                  <div className="flex flex-col gap-2 mb-3">
                    {collections.map(coll => (
                      <button
                        key={coll}
                        onClick={() => setSelectedCollection(coll)}
                        className={`qr-btn qr-btn--touch qr-btn--full ${selectedCollection === coll ? "qr-btn--primary" : "qr-btn--outline"}`}
                        data-testid={`collection-${coll}`}
                      >
                        <Layers className="h-4 w-4" />
                        {coll}
                      </button>
                    ))}
                  </div>
                )}
                
                {showCreateCollection ? (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    <label className="text-sm text-blue-200 mb-2 block">New Collection Name</label>
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="e.g., Summer 2026, Holiday Special"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-400 mb-3"
                      data-testid="input-collection-name"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={createCollection}
                        disabled={!newCollectionName.trim() || loading === "creating"}
                        className="qr-btn qr-btn--primary qr-btn--touch flex-1"
                        data-testid="button-create-collection"
                      >
                        {loading === "creating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateCollection(false);
                          setNewCollectionName("");
                        }}
                        className="qr-btn qr-btn--outline qr-btn--touch"
                        data-testid="button-cancel-collection"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateCollection(true)}
                    className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
                    data-testid="button-add-collection"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Collection
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedCollection && collectionItems.length > 0 && (
          <div className="glass-card">
            <h2 className="glass-title text-base flex items-center gap-2 mb-4">
              <LayoutGrid className="h-5 w-5 text-purple-400" />
              Items in "{selectedCollection}" ({collectionItems.length})
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {collectionItems.map((item, idx) => (
                <div 
                  key={item.id} 
                  className="bg-slate-800/50 rounded-lg p-3 border border-slate-700"
                  data-testid={`item-${item.id}`}
                >
                  {(item.mockupUrl || item.imageUrl) && (
                    <img 
                      src={item.mockupUrl || item.imageUrl || ""} 
                      alt={item.name}
                      className="w-full aspect-square object-contain rounded mb-2 bg-slate-900"
                    />
                  )}
                  <p className="text-sm text-white truncate">{item.name}</p>
                  <p className="text-xs text-blue-300">#{idx + 1} - {item.qrProductState || "basic"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedCollection && (
          <div className="glass-card">
            <h2 className="glass-title text-base flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-green-400" />
              2. Rotation Schedule
            </h2>
            <div className="flex flex-col gap-2">
              {ROTATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRotationInterval(opt.value)}
                  className={`qr-btn qr-btn--touch qr-btn--full text-left ${rotationInterval === opt.value ? "qr-btn--primary" : "qr-btn--outline"}`}
                  data-testid={`rotation-${opt.value}`}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="flex-1">
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-sm opacity-70 ml-2">{opt.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedCollection && (
          <div className="glass-card">
            <h2 className="glass-title text-base flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-yellow-400" />
              3. Create Dynamics Surface
            </h2>
            <p className="text-sm text-blue-200 mb-4">
              This will create a rotating surface that cycles through {collectionItems.length} items on a {rotationInterval} basis.
            </p>
            <button
              onClick={createSurface}
              disabled={loading === "creating" || collectionItems.length === 0}
              className="qr-btn qr-btn--primary qr-btn--xxl qr-btn--full disabled:opacity-50"
              data-testid="button-create-surface"
            >
              {loading === "creating" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
              Create Dynamics Surface
            </button>
          </div>
        )}

        {surfaces.length > 0 && (
          <div className="glass-card">
            <h2 className="glass-title text-base flex items-center gap-2 mb-4">
              <Play className="h-5 w-5 text-cyan-400" />
              Existing Surfaces ({surfaces.length})
            </h2>
            <div className="flex flex-col gap-3">
              {surfaces.map(surface => (
                <div 
                  key={surface.id}
                  className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
                  data-testid={`surface-${surface.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white font-medium truncate flex-1">{surface.name}</p>
                    <span className={`px-2 py-1 rounded text-xs ${surface.isEnabled ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                      {surface.isEnabled ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-sm text-blue-300 mb-3">
                    {surface.rotationInterval} rotation
                  </p>
                  <button
                    onClick={() => resolveSurface(surface)}
                    disabled={loading === "resolving"}
                    className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
                    data-testid={`resolve-${surface.id}`}
                  >
                    {loading === "resolving" && selectedSurface?.id === surface.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Test Resolver
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {resolverResult && (
          <div className="glass-card bg-cyan-500/10 border-cyan-500/30">
            <h2 className="glass-title text-base flex items-center gap-2 mb-4">
              <Play className="h-5 w-5 text-cyan-400" />
              Resolver Result
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-blue-300">Server Time:</span>
                <span className="text-white">{resolverResult.serverNowIso}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-300">Rotation:</span>
                <span className="text-white">{resolverResult.rotationInterval}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-300">Active Item:</span>
                <span className="text-white">{resolverResult.activeIndex + 1} of {resolverResult.totalItems}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-300">Next Switch:</span>
                <span className="text-white">{resolverResult.nextSwitch}</span>
              </div>
              
              {resolverResult.activeItem && (
                <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-white font-medium mb-2">{resolverResult.activeItem.name}</p>
                  {resolverResult.activeItem.mockupUrl && (
                    <img 
                      src={resolverResult.activeItem.mockupUrl} 
                      alt={resolverResult.activeItem.name}
                      className="w-full max-w-xs mx-auto rounded"
                    />
                  )}
                  {resolverResult.activeItem.landingPageUrl && (
                    <a 
                      href={resolverResult.activeItem.landingPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full mt-3"
                    >
                      View Landing Page
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
