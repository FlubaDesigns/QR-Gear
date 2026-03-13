import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ChevronLeft, Plus, ExternalLink, Trash2, AlertTriangle,
  Layers, Share2, Package, DollarSign, ChevronRight,
} from "lucide-react";
import {
  type ViewMode, type MemberChannel,
  getAuthHeaders,
} from "@/features/shared/components/wizardSteps";

interface MemberProduct {
  id: string;
  name: string;
  thumbnailUrl?: string;
  price: number;
  status: string;
  channelId?: string;
}

export function ChannelsView({ memberId, initialChannelId }: { memberId: string; initialChannelId?: string | null }) {
  const { toast } = useToast();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(initialChannelId || null);
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState<string | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);

  const { data: channels, isLoading } = useQuery<MemberChannel[]>({
    queryKey: ['/api/members', memberId, 'channels'],
    queryFn: async () => {
      if (!memberId) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels`, { headers });
      if (!res.ok) throw new Error('Failed to fetch channels');
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: products } = useQuery<MemberProduct[]>({
    queryKey: ['/api/members', memberId, 'products'],
    queryFn: async () => {
      if (!memberId) return [];
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/products`, { headers });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: packets } = useQuery<{ packets: any[] }>({
    queryKey: ['/api/member/packets'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/member/packets?memberId=${memberId}`, { headers });
      if (!res.ok) return { packets: [] };
      return res.json();
    },
    enabled: !!memberId
  });

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create channel');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Channel created' });
      setNewChannelName('');
      setShowNewChannel(false);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'channels'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels/${channelId}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) throw new Error('Failed to delete channel');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Channel deleted', description: `${(data.unlinkedProducts || 0) + (data.unlinkedPackets || 0)} items moved back to your library.` });
      setSelectedChannelId(null);
      setConfirmDeleteChannel(null);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/packets'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const removeFromChannelMutation = useMutation({
    mutationFn: async ({ channelId, itemId, itemType }: { channelId: string; itemId: string; itemType: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/channels/${channelId}/remove-item`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ itemId, itemType }),
      });
      if (!res.ok) throw new Error('Failed to remove item from channel');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Removed from channel', description: 'Item is still in your library.' });
      setConfirmDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/packets'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/products/${productId}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) throw new Error('Failed to delete product');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Product deleted' });
      setConfirmDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/packets'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const channelList = channels || [];
  const productList = products || [];
  const packetList = packets?.packets || [];
  const selectedChannel = selectedChannelId ? channelList.find(c => c.id === selectedChannelId) : null;

  const getProductPacket = (product: MemberProduct) => {
    const pid = (product as any).packetId;
    if (pid) return packetList.find((p: any) => p.id === pid);
    return null;
  };

  const deletePacketMutation = useMutation({
    mutationFn: async (packetId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/member/packets/${packetId}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) throw new Error('Failed to delete packet');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Item deleted' });
      setConfirmDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ['/api/member/packets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'products'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (selectedChannel) {
    const channelProducts = productList.filter(p => p.channelId === selectedChannelId);
    const channelPackets = packetList.filter((p: any) => p.channelId === selectedChannelId);
    const productPacketIds = new Set(channelProducts.map((p: any) => p.packetId).filter(Boolean));
    const normalizedProducts = channelProducts.map((p: any) => ({
      id: p.id,
      name: p.name || 'Untitled',
      thumbnailUrl: p.thumbnailUrl || null,
      price: p.price || 0,
      status: p.status || 'draft',
      channelId: p.channelId,
      packetId: p.packetId || null,
      memberEarnings: (p as any).memberEarnings || 0,
      _type: 'product' as const,
    }));
    const normalizedPackets = channelPackets
      .filter((p: any) => !productPacketIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        name: p.title || p.simpleTitle || 'Untitled',
        thumbnailUrl: p.itemImage || p.socialPacket?.itemImage || p.qrBasicMockup || p.qrPlusMockup || p.qrCanvasMockup || null,
        price: p.pricingSnapshot?.retailPrice || p.retailPrice || 0,
        status: p.status || 'draft',
        channelId: p.channelId,
        packetId: p.id,
        memberEarnings: p.pricingSnapshot?.memberEarnings || p.memberEarnings || 0,
        _type: 'packet' as const,
      }));
    const allItems = [...normalizedProducts, ...normalizedPackets];

    return (
      <div className="space-y-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => setSelectedChannelId(null)} data-testid="button-back-channels">
                <ChevronLeft className="w-5 h-5 text-white" />
              </Button>
              <CardTitle className="text-white flex items-center gap-2">
                <Layers className="w-5 h-5" />
                {selectedChannel.name}
              </CardTitle>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                {allItems.length} {allItems.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/channel/${selectedChannelId}`;
                  navigator.clipboard?.writeText(url);
                  toast({ title: 'Link copied' });
                }}
                className="border-slate-600 text-white"
                data-testid={`share-channel-${selectedChannelId}`}
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {confirmDeleteChannel === selectedChannelId ? (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="destructive" onClick={() => deleteChannelMutation.mutate(selectedChannelId!)} disabled={deleteChannelMutation.isPending} data-testid="button-confirm-delete-channel">
                    {deleteChannelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete Channel'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteChannel(null)} className="text-white" data-testid="button-cancel-delete-channel">Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmDeleteChannel(selectedChannelId)} className="border-red-500/50 text-red-400" data-testid={`delete-channel-${selectedChannelId}`}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Channel
                </Button>
              )}
            </div>
          </CardHeader>
          {confirmDeleteChannel === selectedChannelId && (
            <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">This will delete the channel. Your {allItems.length} items will stay in your library.</p>
            </div>
          )}
          <CardContent>
            {allItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items in this channel yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allItems.map((item: any) => {
                  const packet = getProductPacket(item) || (item.packetId ? packetList.find((p: any) => p.id === item.packetId) : null);
                  const retailPrice = packet?.pricingSnapshot?.retailPrice || item.price || 0;
                  const earnings = packet?.pricingSnapshot?.memberEarnings || item.memberEarnings || 0;
                  const imageUrl = item.thumbnailUrl || packet?.itemImage || packet?.socialPacket?.itemImage || null;
                  const title = item.name || packet?.title || 'Untitled';
                  const status = item.status || packet?.status || 'draft';

                  return (
                    <div key={item.id} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600" data-testid={`product-${item.id}`}>
                      <div className="flex items-center gap-4">
                        {imageUrl ? (
                          <img src={imageUrl} alt={title} className="w-16 h-16 rounded-lg object-cover bg-white flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-600 flex items-center justify-center flex-shrink-0">
                            <Package className="w-8 h-8 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{title}</h4>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-sm text-slate-300">
                              <DollarSign className="w-3 h-3 inline" />{retailPrice > 0 ? `${retailPrice.toFixed(2)} retail` : 'No price set'}
                            </span>
                            <span className="text-sm text-green-400">
                              <DollarSign className="w-3 h-3 inline" />{earnings > 0 ? `${earnings.toFixed(2)} you earn` : '—'}
                            </span>
                          </div>
                          <Badge className={`mt-1 text-xs ${status === 'published' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                            {status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {status === 'published' && item.packetId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const pkt = packetList.find((p: any) => p.id === item.packetId);
                                const shareUrl = pkt?.socialPacket?.shareUrl || `/p/${item.packetId}`;
                                const fullUrl = shareUrl.startsWith('http') ? shareUrl : `${window.location.origin}${shareUrl}`;
                                const refUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}ref=${memberId}`;
                                if (navigator.share) {
                                  navigator.share({ title: title, text: pkt?.socialPacket?.shareCaption || `Check out ${title}!`, url: refUrl }).catch(() => {});
                                } else {
                                  navigator.clipboard?.writeText(refUrl);
                                  toast({ title: 'Share link copied!' });
                                }
                              }}
                              className="text-blue-400"
                              data-testid={`share-product-${item.id}`}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          )}
                          {confirmDeleteProduct === item.id ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="destructive" onClick={() => {
                                removeFromChannelMutation.mutate({
                                  channelId: selectedChannelId!,
                                  itemId: item.id,
                                  itemType: item._type || 'product',
                                });
                              }} disabled={removeFromChannelMutation.isPending} data-testid={`confirm-delete-product-${item.id}`}>
                                {removeFromChannelMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteProduct(null)} className="text-white" data-testid={`cancel-delete-product-${item.id}`}>No</Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteProduct(item.id)} className="text-orange-400" data-testid={`delete-product-${item.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Layers className="w-5 h-5" />
          My Channels
        </CardTitle>
        <Button size="sm" className="bg-blue-600" onClick={() => setShowNewChannel(true)} data-testid="button-create-channel">
          <Plus className="w-4 h-4 mr-1" />
          New Channel
        </Button>
      </CardHeader>
      <CardContent>
        {showNewChannel && (
          <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border border-blue-500/30 flex items-center gap-2">
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Channel name..."
              className="flex-1 bg-transparent border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              data-testid="input-new-channel-name"
              onKeyDown={(e) => { if (e.key === 'Enter' && newChannelName.trim()) createChannelMutation.mutate(newChannelName.trim()); }}
            />
            <Button size="sm" onClick={() => createChannelMutation.mutate(newChannelName.trim())} disabled={!newChannelName.trim() || createChannelMutation.isPending} data-testid="button-save-new-channel">
              {createChannelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowNewChannel(false); setNewChannelName(''); }} className="text-white" data-testid="button-cancel-new-channel">Cancel</Button>
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : channelList.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No channels yet</p>
            <p className="text-sm">Create your first item to start a channel</p>
          </div>
        ) : (
          <div className="space-y-3">
            {channelList.map((channel) => {
              const channelProductCount = productList.filter(p => p.channelId === channel.id).length;
              const channelPacketCount = packetList.filter((p: any) => p.channelId === channel.id).length;
              const totalItems = Math.max(channelProductCount, channelPacketCount);
              return (
                <button 
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className="w-full p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer text-left"
                  data-testid={`channel-${channel.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Layers className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{channel.name}</h3>
                        <p className="text-sm text-slate-400">
                          {totalItems} {totalItems === 1 ? 'item' : 'items'} {channel.createdAt && `· Created ${new Date(channel.createdAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

