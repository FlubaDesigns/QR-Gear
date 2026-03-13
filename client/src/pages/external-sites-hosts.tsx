import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import {
  Plus, Trash2, Pencil, Loader2, Layout, Building2, Code, Eye,
  ShoppingBag, Hammer,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-600",
  paused: "text-yellow-600",
  disabled: "text-red-600",
  draft: "text-gray-500",
  archived: "text-gray-400",
  pending: "text-yellow-600",
  approved: "text-blue-600",
  paid: "text-green-600",
  reversed: "text-red-600",
};

export function HostsSection() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingHost, setEditingHost] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    ownerUserId: "",
    allowedDomains: "",
    contactEmail: "",
    contactName: "",
    notes: "",
    status: "active",
  });

  const { data: hosts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/external/hosts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/external/hosts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/hosts"] });
      toast({ title: "Host created" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/admin/external/hosts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/hosts"] });
      toast({ title: "Host updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/external/hosts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/hosts"] });
      toast({ title: "Host deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingHost(null);
    setFormData({ name: "", ownerUserId: "", allowedDomains: "", contactEmail: "", contactName: "", notes: "", status: "active" });
  };

  const openEdit = (host: any) => {
    setEditingHost(host);
    setFormData({
      name: host.name || "",
      ownerUserId: host.ownerUserId || "",
      allowedDomains: (host.allowedDomains || []).join(", "),
      contactEmail: host.contactEmail || "",
      contactName: host.contactName || "",
      notes: host.notes || "",
      status: host.status || "active",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...formData,
      allowedDomains: formData.allowedDomains.split(",").map((d: string) => d.trim()).filter(Boolean),
    };
    if (editingHost) {
      updateMutation.mutate({ id: editingHost.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" data-testid="loader-hosts" /></div>;

  return (
    <AdminSectionCard
      title={`Builder Hosts (${hosts.length})`}
      icon={Building2}
      actions={
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-host">
          <Plus className="w-4 h-4 mr-1" /> Add Host
        </Button>
      }
    >
      {hosts.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-no-hosts">No builder hosts yet. Add one to get started.</div>
      ) : (
        <div className="space-y-3">
          {hosts.map((host: any) => (
            <Card key={host.id} data-testid={`card-host-${host.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium" data-testid={`text-host-name-${host.id}`}>{host.name}</span>
                      <Badge variant="outline" className={STATUS_COLORS[host.status] || ""} data-testid={`badge-host-status-${host.id}`}>{host.status}</Badge>
                    </div>
                    {host.contactEmail && <p className="text-sm text-muted-foreground">{host.contactEmail}</p>}
                    {host.allowedDomains?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {host.allowedDomains.map((d: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => openEdit(host)} data-testid={`button-edit-host-${host.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { if (confirm("Delete this host?")) deleteMutation.mutate(host.id); }} data-testid={`button-delete-host-${host.id}`}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingHost ? "Edit Host" : "Add Host"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="input-host-name" /></div>
            <div><Label>Owner User ID</Label><Input value={formData.ownerUserId} onChange={(e) => setFormData({ ...formData, ownerUserId: e.target.value })} data-testid="input-host-owner" /></div>
            <div><Label>Allowed Domains (comma-separated)</Label><Input value={formData.allowedDomains} onChange={(e) => setFormData({ ...formData, allowedDomains: e.target.value })} placeholder="example.com, another.org" data-testid="input-host-domains" /></div>
            <div><Label>Contact Email</Label><Input value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} data-testid="input-host-email" /></div>
            <div><Label>Contact Name</Label><Input value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} data-testid="input-host-contact" /></div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} data-testid="input-host-notes" /></div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="select-host-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-host">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending} data-testid="button-save-host">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingHost ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSectionCard>
  );
}

export function ProfilesSection() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    storeId: "",
    surfaceId: "",
    defaultTheme: "",
    maxUploads: 5,
    status: "draft",
    allowHeaderText: true,
    allowHeaderImage: false,
    allowFooterText: true,
    allowFooterImage: false,
    allowCenterGraphic: true,
    allowQrModeSwitch: false,
    allowUpload: false,
    allowAssetLibrary: true,
    allowProductChange: false,
    allowVariantChange: true,
    allowSaveDraft: false,
    allowBuyNow: true,
  });

  const { data: profiles = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/external/profiles"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/external/profiles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/profiles"] });
      toast({ title: "Profile created" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/admin/external/profiles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/profiles"] });
      toast({ title: "Profile updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/external/profiles/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/profiles"] });
      toast({ title: "Profile deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingProfile(null);
    setFormData({
      name: "", storeId: "", surfaceId: "", defaultTheme: "", maxUploads: 5, status: "draft",
      allowHeaderText: true, allowHeaderImage: false, allowFooterText: true, allowFooterImage: false,
      allowCenterGraphic: true, allowQrModeSwitch: false, allowUpload: false, allowAssetLibrary: true,
      allowProductChange: false, allowVariantChange: true, allowSaveDraft: false, allowBuyNow: true,
    });
  };

  const openEdit = (profile: any) => {
    setEditingProfile(profile);
    const perms = profile.permissions || {};
    setFormData({
      name: profile.name || "",
      storeId: profile.storeId || "",
      surfaceId: profile.surfaceId || "",
      defaultTheme: profile.defaultTheme || "",
      maxUploads: profile.maxUploads ?? 5,
      status: profile.status || "draft",
      allowHeaderText: perms.allowHeaderText ?? true,
      allowHeaderImage: perms.allowHeaderImage ?? false,
      allowFooterText: perms.allowFooterText ?? true,
      allowFooterImage: perms.allowFooterImage ?? false,
      allowCenterGraphic: perms.allowCenterGraphic ?? true,
      allowQrModeSwitch: perms.allowQrModeSwitch ?? false,
      allowUpload: perms.allowUpload ?? false,
      allowAssetLibrary: perms.allowAssetLibrary ?? true,
      allowProductChange: perms.allowProductChange ?? false,
      allowVariantChange: perms.allowVariantChange ?? true,
      allowSaveDraft: perms.allowSaveDraft ?? false,
      allowBuyNow: perms.allowBuyNow ?? true,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const { name, storeId, surfaceId, defaultTheme, maxUploads, status, ...permFields } = formData;
    const payload = {
      name, storeId, surfaceId, defaultTheme, maxUploads, status,
      permissions: permFields,
    };
    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const permissionToggles = [
    { key: "allowHeaderText", label: "Header Text" },
    { key: "allowHeaderImage", label: "Header Image" },
    { key: "allowFooterText", label: "Footer Text" },
    { key: "allowFooterImage", label: "Footer Image" },
    { key: "allowCenterGraphic", label: "Center Graphic" },
    { key: "allowQrModeSwitch", label: "QR Mode Switch" },
    { key: "allowUpload", label: "Upload Files" },
    { key: "allowAssetLibrary", label: "Asset Library" },
    { key: "allowProductChange", label: "Change Product" },
    { key: "allowVariantChange", label: "Change Variant" },
    { key: "allowSaveDraft", label: "Save Draft" },
    { key: "allowBuyNow", label: "Buy Now" },
  ];

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" data-testid="loader-profiles" /></div>;

  return (
    <AdminSectionCard
      title={`Builder Profiles (${profiles.length})`}
      icon={Layout}
      actions={
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-profile">
          <Plus className="w-4 h-4 mr-1" /> Add Profile
        </Button>
      }
    >
      {profiles.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-no-profiles">No builder profiles yet.</div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile: any) => {
            const perms = profile.permissions || {};
            const enabledCount = Object.values(perms).filter(Boolean).length;
            return (
              <Card key={profile.id} data-testid={`card-profile-${profile.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Layout className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium" data-testid={`text-profile-name-${profile.id}`}>{profile.name}</span>
                        <Badge variant="outline" className={STATUS_COLORS[profile.status] || ""}>{profile.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{enabledCount} permissions enabled</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => openEdit(profile)} data-testid={`button-edit-profile-${profile.id}`}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { if (confirm("Delete this profile?")) deleteMutation.mutate(profile.id); }} data-testid={`button-delete-profile-${profile.id}`}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingProfile ? "Edit Profile" : "Add Profile"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="input-profile-name" /></div>
            <div><Label>Surface ID</Label><Input value={formData.surfaceId} onChange={(e) => setFormData({ ...formData, surfaceId: e.target.value })} data-testid="input-profile-surface" /></div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="select-profile-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Max Uploads</Label><Input type="number" value={formData.maxUploads} onChange={(e) => setFormData({ ...formData, maxUploads: parseInt(e.target.value) || 5 })} data-testid="input-profile-uploads" /></div>
            <div className="space-y-2">
              <Label className="text-base font-medium">Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {permissionToggles.map((perm) => (
                  <div key={perm.key} className="flex items-center gap-2 min-h-[44px]">
                    <Switch
                      checked={(formData as any)[perm.key]}
                      onCheckedChange={(checked) => setFormData({ ...formData, [perm.key]: checked })}
                      data-testid={`switch-${perm.key}`}
                    />
                    <Label className="text-sm cursor-pointer">{perm.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-profile">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending} data-testid="button-save-profile">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingProfile ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSectionCard>
  );
}
