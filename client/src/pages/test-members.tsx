import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  UserPlus, 
  Store, 
  Mail,
  Shield,
  Loader2,
  Trash2,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";
import { queryClient } from "@/lib/queryClient";

interface Member {
  id: string;
  email: string;
  displayName: string;
  roleType: string;
  storeId: string;
  storeName: string;
  isActive: boolean;
  createdAt: string;
}

interface MemberStore {
  id: string;
  name: string;
  roleType: string;
  isActive: boolean;
  channelCount: number;
}

export default function TestMembersSandbox() {
  const { user } = useAuth();
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const { data: stores, isLoading: storesLoading, refetch: refetchStores } = useQuery<MemberStore[]>({
    queryKey: ["/api/test/stores", "all"],
    queryFn: async () => {
      const res = await fetch("/api/test/stores");
      const data = await res.json();
      return data || [];
    },
  });

  const { data: members, isLoading: membersLoading, refetch: refetchMembers } = useQuery<Member[]>({
    queryKey: ["/api/test/members", selectedStoreId],
    queryFn: async () => {
      const url = selectedStoreId 
        ? `/api/test/members?storeId=${selectedStoreId}`
        : "/api/test/members";
      const res = await fetch(url);
      const data = await res.json();
      return data || [];
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, storeId }: { email: string; storeId: string }) => {
      const res = await fetch("/api/test/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, storeId }),
      });
      return res.json();
    },
    onSuccess: () => {
      setNewMemberEmail("");
      refetchMembers();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/test/members/${memberId}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      refetchMembers();
    },
  });

  const storeList = stores || [];
  const memberList = members || [];

  return (
    <div className="page-wrap" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      <SEO title="Members Sandbox" description="Test member management features" />
      
      <div className="container py-8 max-w-4xl mx-auto">
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Members Sandbox</h1>
          </div>
          <p className="text-white/70">Test member management, invitations, and role assignments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Store className="w-5 h-5" />
                Stores
              </CardTitle>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => refetchStores()}
                data-testid="button-refresh-stores"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {storesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              ) : storeList.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No stores found</p>
              ) : (
                <div className="space-y-2">
                  {storeList.map((store) => (
                    <button
                      key={store.id}
                      onClick={() => setSelectedStoreId(store.id === selectedStoreId ? null : store.id)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedStoreId === store.id 
                          ? 'bg-blue-600/30 border border-blue-500' 
                          : 'bg-slate-700/50 hover:bg-slate-700'
                      }`}
                      data-testid={`button-store-${store.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{store.name}</span>
                        <Badge variant={store.isActive ? "default" : "secondary"}>
                          {store.roleType}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Invite Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedStoreId ? (
                <p className="text-slate-400 text-center py-4">Select a store first</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="member@example.com"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                      data-testid="input-member-email"
                    />
                    <Button
                      onClick={() => {
                        if (newMemberEmail && selectedStoreId) {
                          inviteMutation.mutate({ email: newMemberEmail, storeId: selectedStoreId });
                        }
                      }}
                      disabled={!newMemberEmail || inviteMutation.isPending}
                      data-testid="button-invite-member"
                    >
                      {inviteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {inviteMutation.data?.error && (
                    <p className="text-red-400 text-sm">{inviteMutation.data.error}</p>
                  )}
                  {inviteMutation.data?.success && (
                    <p className="text-green-400 text-sm">Invitation sent!</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 mt-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Members {selectedStoreId && `(${storeList.find(s => s.id === selectedStoreId)?.name || ''})`}
            </CardTitle>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => refetchMembers()}
              data-testid="button-refresh-members"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : memberList.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                {selectedStoreId ? "No members in this store" : "Select a store to view members"}
              </p>
            ) : (
              <div className="space-y-2">
                {memberList.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                    data-testid={`member-row-${member.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{member.displayName || member.email}</p>
                        <p className="text-slate-400 text-sm">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.roleType}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={() => removeMutation.mutate(member.id)}
                        disabled={removeMutation.isPending}
                        data-testid={`button-remove-member-${member.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-white/50 text-sm">
          Logged in as: {user?.email || "Not logged in"}
        </div>
      </div>
    </div>
  );
}
