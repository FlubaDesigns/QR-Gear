import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Plus, Loader2, Layers } from "lucide-react";
import { type MemberChannel } from "./wizardTypes";
import { memberFetch } from "@/lib/memberFetch";

export function ChannelStep({ 
  selectedChannel, 
  onSelect,
  memberId,
  isCreatingChannel,
  setIsCreatingChannel,
  newChannelName,
  setNewChannelName
}: { 
  selectedChannel: { id: string; name: string } | null;
  onSelect: (channel: { id: string; name: string }) => void;
  memberId: string;
  isCreatingChannel: boolean;
  setIsCreatingChannel: (v: boolean) => void;
  newChannelName: string;
  setNewChannelName: (v: string) => void;
}) {
  const { toast } = useToast();
  
  const { data: channels = [], isLoading, refetch } = useQuery<MemberChannel[]>({
    queryKey: ["/api/members", memberId, "channels"],
    queryFn: async () => {
      return memberFetch<MemberChannel[]>(`/${memberId}/channels`);
    },
    enabled: !!memberId,
  });

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      return memberFetch<any>(`/${memberId}/channels`, {
        method: "POST",
        json: { name },
      });
    },
    onSuccess: (data) => {
      toast({ title: "Channel Created", description: `"${data.name}" is ready to use.` });
      onSelect({ id: data.id, name: data.name });
      setIsCreatingChannel(false);
      setNewChannelName('');
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (newChannelName.trim()) {
      createChannelMutation.mutate(newChannelName.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-white mb-2">Choose Your Channel</h2>
        <p className="text-slate-400">Products are organized into channels for your store</p>
      </div>

      {isCreatingChannel ? (
        <div className="max-w-md mx-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name" className="text-white">Channel Name</Label>
            <Input
              id="channel-name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="e.g., Summer Collection, Tech Gear..."
              className="bg-slate-700 border-slate-600 text-white"
              data-testid="input-new-channel-name"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreatingChannel(false)}
              className="flex-1"
              data-testid="button-cancel-channel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newChannelName.trim() || createChannelMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-channel"
            >
              {createChannelMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Channel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onSelect({ id: channel.id, name: channel.name })}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedChannel?.id === channel.id
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                }`}
                data-testid={`button-channel-${channel.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedChannel?.id === channel.id ? 'bg-blue-500' : 'bg-slate-700'
                  }`}>
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{channel.name}</h3>
                    {channel.productCount !== undefined && (
                      <p className="text-sm text-slate-400">{channel.productCount} products</p>
                    )}
                  </div>
                  {selectedChannel?.id === channel.id && (
                    <Check className="w-5 h-5 text-blue-400 ml-auto" />
                  )}
                </div>
              </button>
            ))}

            <button
              onClick={() => setIsCreatingChannel(true)}
              className="p-4 rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/30 hover:border-blue-500 hover:bg-blue-500/10 transition-all"
              data-testid="button-new-channel"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-700">
                  <Plus className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Create New Channel</h3>
                  <p className="text-sm text-slate-400">Start a new product line</p>
                </div>
              </div>
            </button>
          </div>

          {channels.length === 0 && (
            <div className="text-center py-4">
              <p className="text-slate-400">No channels yet. Create your first one!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
