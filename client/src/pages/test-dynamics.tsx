import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  ArrowLeft, Zap, Store, Layers, LayoutGrid, RefreshCw, Clock, 
  Play, Check, ChevronDown, Loader2, Plus, Image, Video, FileText,
  Trash2, ArrowUp, ArrowDown, Upload, X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  metadata?: {
    text?: string;
    duration?: number;
    pageCount?: number;
  };
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

const ROTATION_OPTIONS = [
  { value: "daily", label: "Daily", description: "Rotates at midnight" },
  { value: "weekly", label: "Weekly", description: "Rotates every Sunday" },
  { value: "monthly", label: "Monthly", description: "Rotates on the 1st" },
];

const ContentTypeIcon = ({ type }: { type: 'image' | 'video' | 'document' }) => {
  switch (type) {
    case 'video': return <Video className="h-4 w-4" />;
    case 'document': return <FileText className="h-4 w-4" />;
    default: return <Image className="h-4 w-4" />;
  }
};

export default function TestDynamicsPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  // Store/Channel state
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  
  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  
  // Channel content state
  const [channelContent, setChannelContent] = useState<ChannelContentItem[]>([]);
  
  // Collection items state
  const [collectionItems, setCollectionItems] = useState<CollectionItemData[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState<string>("channel");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Add to collection modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContentForAdd, setSelectedContentForAdd] = useState<ChannelContentItem | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [addToCollectionId, setAddToCollectionId] = useState<string>("");
  
  // Add content modal
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  const [newContentName, setNewContentName] = useState("");
  const [newContentType, setNewContentType] = useState<'image' | 'video' | 'document'>('image');
  const [newContentUrl, setNewContentUrl] = useState("");

  // Fetch stores on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchStores();
    }
  }, [isAuthenticated]);

  // Auto-select QR Gear store (or first available)
  useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      // Prefer QR Gear store
      const qrGear = stores.find(s => s.id === 'qr-gear' || s.name.toLowerCase().includes('qr gear'));
      setSelectedStore(qrGear || stores[0]);
    }
  }, [stores, selectedStore]);

  // Fetch channels when store selected
  useEffect(() => {
    if (selectedStore) {
      fetchChannels();
    } else {
      setChannels([]);
      setSelectedChannel(null);
    }
  }, [selectedStore]);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  // Fetch content and collections when channel selected
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

  // Fetch collection items when collection selected
  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionItems();
    } else {
      setCollectionItems([]);
    }
  }, [selectedCollection]);

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
      // Collection might not have items yet
      setCollectionItems([]);
    } finally {
      setLoading(null);
    }
  };

  const addContent = async () => {
    if (!selectedStore || !selectedChannel || !newContentName || !newContentUrl) {
      setError("Please fill in all fields");
      return;
    }
    try {
      setLoading("adding");
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels/${selectedChannel}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContentName,
          contentType: newContentType,
          url: newContentUrl,
          thumbnailUrl: newContentUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Content added!");
        setShowAddContentModal(false);
        setNewContentName("");
        setNewContentUrl("");
        fetchChannelContent();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "Failed to add content");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const createCollection = async () => {
    if (!selectedStore || !selectedChannel || !newCollectionName.trim()) {
      setError("Please enter a collection name");
      return;
    }
    try {
      setLoading("creating");
      const res = await fetch(`/api/test/stores/${selectedStore.id}/channels/${selectedChannel}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        const newColl = { id: data.collectionId, name: newCollectionName.trim() };
        setCollections(prev => [...prev, newColl]);
        setSelectedCollection(newColl);
        setNewCollectionName("");
        setSuccessMessage("Collection created!");
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

  const addToCollection = async () => {
    if (!selectedContentForAdd || (!addToCollectionId && !newCollectionName.trim())) {
      setError("Please select or create a collection");
      return;
    }
    
    // If creating new collection first
    if (newCollectionName.trim() && !addToCollectionId) {
      await createCollection();
      // After creating, add to it
    }
    
    const collectionName = addToCollectionId || newCollectionName.trim();
    
    try {
      setLoading("adding");
      const res = await fetch(`/api/test/collections/${encodeURIComponent(collectionName)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: selectedContentForAdd.id,
          contentType: selectedContentForAdd.contentType,
          name: selectedContentForAdd.name,
          url: selectedContentForAdd.url,
          thumbnailUrl: selectedContentForAdd.thumbnailUrl,
          rotationInterval: "daily",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Added to collection!`);
        setShowAddModal(false);
        setSelectedContentForAdd(null);
        setAddToCollectionId("");
        setNewCollectionName("");
        // Switch to collection view
        const coll = collections.find(c => c.name === collectionName);
        if (coll) {
          setSelectedCollection(coll);
          setActiveTab("collection");
        }
        setTimeout(() => setSuccessMessage(null), 3000);
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
        setSuccessMessage("Item removed");
        setTimeout(() => setSuccessMessage(null), 3000);
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
    }
  };

  const moveItem = async (itemId: string, direction: 'up' | 'down') => {
    const idx = collectionItems.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === collectionItems.length - 1) return;
    
    const newItems = [...collectionItems];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    
    // Update orders
    const reordered = newItems.map((item, i) => ({ ...item, order: i + 1 }));
    setCollectionItems(reordered);
    
    // Persist
    if (selectedCollection) {
      try {
        await fetch(`/api/test/collections/${encodeURIComponent(selectedCollection.name)}/items/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemOrders: reordered.map(i => ({ itemId: i.id, order: i.order })),
          }),
        });
      } catch (err: any) {
        console.error("Failed to persist order:", err);
      }
    }
  };

  const openAddModal = (content: ChannelContentItem) => {
    setSelectedContentForAdd(content);
    setAddToCollectionId("");
    setNewCollectionName("");
    setShowAddModal(true);
  };

  return (
    <div className="page-wrap" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      <div className="container mobile-compact mobile-compact-stack">
        {/* Header */}
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

        {/* Error/Success messages */}
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

        {/* Store/Channel Selector - Auto-populated */}
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-5 w-5 text-blue-400" />
            <span className="text-white font-medium">
              {selectedStore?.name || "Loading..."} / {selectedChannel || "..."}
            </span>
            {loading === "stores" || loading === "channels" ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            ) : null}
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

        {/* Main Content Area with Tabs */}
        {selectedStore && selectedChannel && (
          <div className="glass-card p-0 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full rounded-none border-b border-slate-700 bg-slate-800/50 p-0 h-auto">
                <TabsTrigger 
                  value="channel" 
                  className="flex-1 py-3 rounded-none data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-200"
                  data-testid="tab-channel"
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Channel Content
                </TabsTrigger>
                <TabsTrigger 
                  value="collection" 
                  className="flex-1 py-3 rounded-none data-[state=active]:bg-purple-600 data-[state=active]:text-white text-purple-200"
                  data-testid="tab-collection"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  Collection
                  {selectedCollection && ` (${collectionItems.length})`}
                </TabsTrigger>
              </TabsList>

              {/* Channel View */}
              <TabsContent value="channel" className="p-4 m-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium">
                    Available Content ({channelContent.length})
                  </h3>
                  <Button 
                    size="sm" 
                    onClick={() => setShowAddContentModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-add-content"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Content
                  </Button>
                </div>

                {loading === "content" ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  </div>
                ) : channelContent.length === 0 ? (
                  <div className="text-center py-8 text-blue-300">
                    <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No content in this channel yet.</p>
                    <p className="text-sm mt-2">Add images, videos, or documents to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {channelContent.map(content => (
                      <div 
                        key={content.id}
                        className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700 group"
                        data-testid={`content-${content.id}`}
                      >
                        <div className="aspect-square bg-slate-900 flex items-center justify-center overflow-hidden">
                          {content.thumbnailUrl || content.url ? (
                            <img 
                              src={content.thumbnailUrl || content.url} 
                              alt={content.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ContentTypeIcon type={content.contentType} />
                          )}
                        </div>
                        <div className="p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              <ContentTypeIcon type={content.contentType} />
                              <span className="ml-1 capitalize">{content.contentType}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-white truncate">{content.name}</p>
                          <Button 
                            size="sm" 
                            className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => openAddModal(content)}
                            data-testid={`button-add-${content.id}`}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add to Collection
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Collection View */}
              <TabsContent value="collection" className="p-4 m-0">
                {/* Collection selector */}
                <div className="flex items-center gap-2 mb-4">
                  <Select
                    value={selectedCollection?.name || ""}
                    onValueChange={(val) => {
                      const coll = collections.find(c => c.name === val);
                      setSelectedCollection(coll || null);
                    }}
                  >
                    <SelectTrigger className="flex-1 bg-slate-800 border-slate-600 text-white" data-testid="select-collection">
                      <SelectValue placeholder="Select a collection..." />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map(coll => (
                        <SelectItem key={coll.id} value={coll.name}>
                          {coll.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const name = prompt("New collection name:");
                      if (name) {
                        setNewCollectionName(name);
                        createCollection();
                      }
                    }}
                    className="border-purple-500 text-purple-300 hover:bg-purple-500/20"
                    data-testid="button-new-collection"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {!selectedCollection ? (
                  <div className="text-center py-8 text-purple-300">
                    <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select or create a collection to manage items.</p>
                  </div>
                ) : loading === "items" ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                  </div>
                ) : collectionItems.length === 0 ? (
                  <div className="text-center py-8 text-purple-300">
                    <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No items in "{selectedCollection.name}" yet.</p>
                    <p className="text-sm mt-2">Switch to Channel Content tab to add items.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collectionItems.map((item, idx) => (
                      <div 
                        key={item.id}
                        className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 flex gap-3"
                        data-testid={`collection-item-${item.id}`}
                      >
                        {/* Thumbnail */}
                        <div className="w-20 h-20 bg-slate-900 rounded overflow-hidden flex-shrink-0">
                          {item.thumbnailUrl || item.url ? (
                            <img 
                              src={item.thumbnailUrl || item.url} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ContentTypeIcon type={item.contentType} />
                            </div>
                          )}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-purple-600 text-white">#{item.order}</Badge>
                            <span className="text-white font-medium truncate">{item.name}</span>
                          </div>
                          
                          {/* Interval selector */}
                          <Select
                            value={item.rotationInterval}
                            onValueChange={(val: 'daily' | 'weekly' | 'monthly') => updateItemInterval(item.id, val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-slate-700 border-slate-600 text-white w-32" data-testid={`select-interval-${item.id}`}>
                              <Clock className="h-3 w-3 mr-1" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={idx === 0}
                            onClick={() => moveItem(item.id, 'up')}
                            data-testid={`button-up-${item.id}`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={idx === collectionItems.length - 1}
                            onClick={() => moveItem(item.id, 'down')}
                            data-testid={`button-down-${item.id}`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-7 w-7"
                            onClick={() => removeFromCollection(item.id)}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Add to Collection Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Add to Collection</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {selectedContentForAdd && (
                <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                  <div className="w-12 h-12 bg-slate-700 rounded overflow-hidden">
                    {selectedContentForAdd.thumbnailUrl && (
                      <img src={selectedContentForAdd.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{selectedContentForAdd.name}</p>
                    <p className="text-sm text-slate-400 capitalize">{selectedContentForAdd.contentType}</p>
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Select existing collection:</label>
                <Select value={addToCollectionId} onValueChange={setAddToCollectionId}>
                  <SelectTrigger className="bg-slate-800 border-slate-600" data-testid="select-add-collection">
                    <SelectValue placeholder="Choose collection..." />
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
              
              <div className="text-center text-slate-500">- or -</div>
              
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Create new collection:</label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection name..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                  data-testid="input-new-collection"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={addToCollection}
                disabled={loading === "adding" || (!addToCollectionId && !newCollectionName.trim())}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-confirm-add"
              >
                {loading === "adding" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Content Modal */}
        <Dialog open={showAddContentModal} onOpenChange={setShowAddContentModal}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Add Content to Channel</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Content Name</label>
                <input
                  type="text"
                  value={newContentName}
                  onChange={(e) => setNewContentName(e.target.value)}
                  placeholder="My Landing Page"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                  data-testid="input-content-name"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Content Type</label>
                <Select value={newContentType} onValueChange={(val: any) => setNewContentType(val)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600" data-testid="select-content-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-slate-300 mb-2 block">URL</label>
                <input
                  type="text"
                  value={newContentUrl}
                  onChange={(e) => setNewContentUrl(e.target.value)}
                  placeholder="https://example.com/my-image.png"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                  data-testid="input-content-url"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddContentModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={addContent}
                disabled={loading === "adding" || !newContentName || !newContentUrl}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-confirm-content"
              >
                {loading === "adding" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Add Content
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
