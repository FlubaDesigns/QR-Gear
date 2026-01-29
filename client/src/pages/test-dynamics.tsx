import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Zap, Store, Layers, LayoutGrid, RefreshCw, Clock, Play, Check, ChevronDown, Loader2 } from "lucide-react";

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
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
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

  useEffect(() => {
    fetchStores();
    fetchSurfaces();
  }, []);

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

  const fetchStores = async () => {
    try {
      setLoading("stores");
      const res = await fetch("/api/test/stores");
      const data = await res.json();
      setStores(data.stores || []);
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

            {selectedStore && selectedStore.availableSegments?.length > 0 && (
              <div>
                <label className="text-sm text-blue-200 mb-2 block">Channel</label>
                <div className="flex flex-col gap-2">
                  {selectedStore.availableSegments.map(channel => (
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
              </div>
            )}

            {selectedChannel && (
              <div>
                <label className="text-sm text-blue-200 mb-2 block">
                  Collection
                  {loading === "collections" && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
                </label>
                {collections.length === 0 ? (
                  <p className="text-blue-300/70 text-sm">
                    No collections found. Add products with a collection name to this channel first.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
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
