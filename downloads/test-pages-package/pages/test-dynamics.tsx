import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { 
  ArrowLeft, Zap, Store, Layers, Film, 
  Check, Loader2, Plus, X, Calendar, Clock, CalendarDays
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GridScrollView, QRDynamicsScanLightbox } from "@/features/shared/components/views";
import { ChannelItemSkin, type ChannelItem, CollectionItemSkinV2, type CollectionItem } from "@/features/shared/components/skins";

interface StoreOption {
  id: string;
  name: string;
  roleType: string;
  availableSegments: string[];
}

interface ChannelContentItem {
  id: string;
  storeId: string;
  channelId: string;
  name: string;
  contentType: 'image' | 'video' | 'document';
  url: string;
  thumbnailUrl?: string;
}

interface CollectionItemData {
  id: string;
  collectionId: string;
  contentId: string;
  contentType: 'image' | 'video' | 'document';
  name: string;
  url: string;
  thumbnailUrl?: string;
  order: number;
  rotationInterval: 'daily' | 'weekly' | 'monthly';
}

interface Collection {
  id: string;
  name: string;
}

export default function TestDynamicsPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  
  const [channelContent, setChannelContent] = useState<ChannelContentItem[]>([]);
  const [collectionItems, setCollectionItems] = useState<CollectionItemData[]>([]);
  
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedItem, setSelectedItem] = useState<CollectionItemData | null>(null);

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
      fetchChannelContent();
      fetchCollections();
    } else {
      setChannelContent([]);
      setCollections([]);
      setSelectedCollection(null);
    }
  }, [selectedStore, selectedChannel]);

  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionItems();
    } else {
      setCollectionItems([]);
    }
  }, [selectedCollection]);

  const filteredChannelContent = useMemo(() => {
    return channelContent.filter(c => c.contentType === 'image' || c.contentType === 'video');
  }, [channelContent]);

  const channelItems: ChannelItem[] = useMemo(() => {
    return filteredChannelContent.map(c => ({
      id: c.id,
      name: c.name,
      contentType: c.contentType as 'image' | 'video',
      imageUrl: c.thumbnailUrl || c.url,
    }));
  }, [filteredChannelContent]);

  const collectionItemsForView: CollectionItem[] = useMemo(() => {
    return collectionItems
      .filter(c => c.contentType === 'image' || c.contentType === 'video')
      .map(c => ({
        id: c.id,
        name: c.name,
        imageUrl: c.thumbnailUrl || c.url,
        order: c.order,
        rotationInterval: c.rotationInterval,
      }));
  }, [collectionItems]);

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

  const fetchChannelContent = async () => {
    if (!selectedStore || !selectedChannel) return;
    try {
      setLoading("content");
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels/${selectedChannel}/content`);
      const data = await res.json();
      setChannelContent(data.content || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const fetchCollections = async () => {
    if (!selectedStore || !selectedChannel) return;
    try {
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels/${selectedChannel}/collections`);
      const data = await res.json();
      const collNames = data.collections || [];
      setCollections(collNames.map((name: string, idx: number) => ({ id: `coll-${idx}`, name })));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchCollectionItems = async () => {
    if (!selectedCollection) return;
    try {
      setLoading("items");
      const res = await fetch(`/api/test/collections/${encodeURIComponent(selectedCollection.name)}/items`);
      const data = await res.json();
      setCollectionItems(data.items || []);
    } catch (err: any) {
      setCollectionItems([]);
    } finally {
      setLoading(null);
    }
  };

  const createCollection = async (name: string) => {
    if (!selectedStore || !selectedChannel || !name.trim()) {
      setError("Please enter a collection name");
      return null;
    }
    try {
      setLoading("creating");
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels/${selectedChannel}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        const newColl = { id: data.collectionId, name: name.trim() };
        setCollections(prev => [...prev, newColl]);
        setSelectedCollection(newColl);
        showSuccess("Collection created!");
        return newColl;
      } else {
        setError(data.error || "Failed to create collection");
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(null);
    }
  };

  const addToCollection = async (contentItem: ChannelContentItem, collectionName: string) => {
    try {
      setLoading("adding");
      const res = await fetch(`/api/test/collections/${encodeURIComponent(collectionName)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: contentItem.id,
          contentType: contentItem.contentType,
          name: contentItem.name,
          url: contentItem.url,
          thumbnailUrl: contentItem.thumbnailUrl,
          rotationInterval: "daily",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("Added to collection!");
        const coll = collections.find(c => c.name === collectionName);
        if (coll) {
          setSelectedCollection(coll);
          fetchCollectionItems();
        }
      } else {
        setError(data.error || "Failed to add to collection");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const removeFromCollection = async (itemId: string) => {
    if (!selectedCollection) return;
    try {
      setLoading("removing");
      const res = await fetch(`/api/test/collections/${encodeURIComponent(selectedCollection.name)}/items/${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setCollectionItems(prev => prev.filter(i => i.id !== itemId));
        showSuccess("Item removed");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const updateItemInterval = async (itemId: string, interval: 'daily' | 'weekly' | 'monthly') => {
    if (!selectedCollection) return;
    try {
      setIsUpdating(true);
      const res = await fetch(`/api/test/collections/${encodeURIComponent(selectedCollection.name)}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotationInterval: interval }),
      });
      const data = await res.json();
      if (data.success) {
        setCollectionItems(prev => prev.map(i => 
          i.id === itemId ? { ...i, rotationInterval: interval } : i
        ));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleChannelItemAction = async (item: ChannelItem) => {
    const contentItem = channelContent.find(c => c.id === item.id);
    if (!contentItem) return;

    if (collections.length === 0) {
      const name = prompt("Create a new collection. Enter name:");
      if (name) {
        const newColl = await createCollection(name);
        if (newColl) {
          await addToCollection(contentItem, newColl.name);
        }
      }
    } else if (selectedCollection) {
      await addToCollection(contentItem, selectedCollection.name);
    } else {
      const collName = prompt(`Select collection:\n${collections.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}\n\nEnter collection name or number:`);
      if (collName) {
        const idx = parseInt(collName) - 1;
        const targetColl = collections[idx]?.name || collName;
        const existing = collections.find(c => c.name === targetColl);
        if (existing) {
          await addToCollection(contentItem, existing.name);
        } else {
          const newColl = await createCollection(targetColl);
          if (newColl) {
            await addToCollection(contentItem, newColl.name);
          }
        }
      }
    }
  };

  const handleCollectionItemAction = (item: CollectionItem) => {
    const fullItem = collectionItems.find(ci => ci.id === item.id);
    if (fullItem) {
      setSelectedItem(fullItem);
    }
  };

  const updateRotationInterval = async (itemId: string, interval: 'daily' | 'weekly' | 'monthly') => {
    if (!selectedCollection) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/test/collections/${selectedCollection.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotationInterval: interval }),
      });
      
      if (!response.ok) throw new Error('Failed to update interval');
      
      setCollectionItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, rotationInterval: interval } : item
      ));
      
      if (selectedItem?.id === itemId) {
        setSelectedItem(prev => prev ? { ...prev, rotationInterval: interval } : null);
      }
      
      setSuccessMessage(`Rotation set to ${interval}`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      setError('Failed to update rotation interval');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCollectionItemRemove = (item: CollectionItem) => {
    removeFromCollection(item.id);
  };

  const ChannelSkin = (props: { item: ChannelItem; onAction?: (item: ChannelItem) => void }) => (
    <ChannelItemSkin {...props} />
  );

  const CollectionSkin = (props: { item: CollectionItem; onAction?: (item: CollectionItem) => void }) => (
    <CollectionItemSkinV2 {...props} onRemove={handleCollectionItemRemove} />
  );

  return (
    <div className="page-wrap" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <h1 className="glass-title text-lg flex items-center gap-2 mb-2" data-testid="text-page-title">
            <Zap className="h-5 w-5 text-yellow-400" />
            QR Dynamics Builder
          </h1>
          <p className="text-sm text-blue-200 mb-4">
            Create rotating content that changes on a schedule
          </p>
          <Link href="/test-products">
            <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
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
                setSelectedCollection(null);
              }}
            >
              <SelectTrigger className="flex-1 bg-slate-800 border-slate-600 text-white" data-testid="select-store">
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
                setSelectedCollection(null);
              }}
            >
              <SelectTrigger className="flex-1 bg-slate-800 border-slate-600 text-white" data-testid="select-channel">
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
                  Media ({channelItems.length})
                </h3>
                {loading === "content" && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
              </div>

              {channelItems.length === 0 ? (
                <div className="text-center py-6 text-blue-300 bg-slate-800/50 rounded-lg">
                  <Film className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No media in this channel yet.</p>
                </div>
              ) : (
                <GridScrollView
                  items={channelItems}
                  Skin={ChannelSkin}
                  onAction={handleChannelItemAction}
                  columns={4}
                  height="280px"
                  emptyMessage="No media available"
                />
              )}
            </div>

            <div className="glass-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-400" />
                  Collection ({collectionItemsForView.length})
                </h3>
                {loading === "items" && <Loader2 className="h-4 w-4 animate-spin text-purple-400" />}
              </div>

              <div className="flex gap-2 mb-3">
                <Select
                  value={selectedCollection?.name || ""}
                  onValueChange={(val) => {
                    const coll = collections.find(c => c.name === val);
                    setSelectedCollection(coll || null);
                  }}
                >
                  <SelectTrigger className="flex-1 bg-slate-800 border-slate-600 text-white" data-testid="select-collection">
                    <SelectValue placeholder="Select collection..." />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map(coll => (
                      <SelectItem key={coll.id} value={coll.name}>
                        {coll.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="New collection name..."
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                  data-testid="input-new-collection"
                />
                <Button 
                  onClick={async () => {
                    if (newCollectionName.trim()) {
                      await createCollection(newCollectionName.trim());
                      setNewCollectionName("");
                    }
                  }}
                  disabled={!newCollectionName.trim() || loading === "creating"}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="button-create-collection"
                >
                  {loading === "creating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </Button>
              </div>

              {!selectedCollection ? (
                <div className="text-center py-6 text-purple-300 bg-slate-800/50 rounded-lg">
                  <Layers className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select or create a collection above.</p>
                </div>
              ) : collectionItemsForView.length === 0 ? (
                <div className="text-center py-6 text-purple-300 bg-slate-800/50 rounded-lg">
                  <Layers className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Tap media above to add to "{selectedCollection.name}"</p>
                </div>
              ) : (
                <GridScrollView
                  items={collectionItemsForView}
                  Skin={CollectionSkin}
                  onAction={handleCollectionItemAction}
                  columns={4}
                  height="280px"
                  emptyMessage="No items in collection"
                />
              )}
            </div>
          </>
        )}

        <QRDynamicsScanLightbox
          item={selectedItem ? {
            id: selectedItem.id,
            name: selectedItem.name,
            thumbnailUrl: selectedItem.thumbnailUrl,
            contentType: selectedItem.contentType,
            rotationInterval: selectedItem.rotationInterval,
            order: selectedItem.order,
          } : null}
          onClose={() => setSelectedItem(null)}
          onIntervalChange={updateRotationInterval}
          isUpdating={isUpdating}
        />
      </div>
    </div>
  );
}
