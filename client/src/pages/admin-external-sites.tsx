import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Globe,
  Users,
  Layout,
  MapPin,
  DollarSign,
  PieChart,
  FileText,
  CreditCard,
  Building2,
  Code,
  Eye,
  ShoppingBag,
  Hammer,
} from "lucide-react";

const SECTION_TABS: AdminTab[] = [
  { id: "hosts", label: "Hosts", icon: Building2 },
  { id: "profiles", label: "Profiles", icon: Layout },
  { id: "placements", label: "Placements", icon: MapPin },
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "revenue", label: "Revenue", icon: PieChart },
  { id: "attributions", label: "Attribution", icon: FileText },
  { id: "payouts", label: "Payouts", icon: CreditCard },
];

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

const EMBED_MODE_ICONS: Record<string, typeof Globe> = {
  store: ShoppingBag,
  product: Eye,
  builder: Hammer,
};

export default function AdminExternalSites() {
  const [activeTab, setActiveTab] = useState("hosts");

  return (
    <AdminShell
      title="External Sites"
      tabs={SECTION_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "hosts" && <HostsSection />}
      {activeTab === "profiles" && <ProfilesSection />}
      {activeTab === "placements" && <PlacementsSection />}
      {activeTab === "pricing" && <PricingSection />}
      {activeTab === "revenue" && <RevenueSection />}
      {activeTab === "attributions" && <AttributionsSection />}
      {activeTab === "payouts" && <PayoutsSection />}
    </AdminShell>
  );
}

// ============ HOSTS SECTION ============

function HostsSection() {
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
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold" data-testid="text-hosts-title">Builder Hosts ({hosts.length})</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-host">
          <Plus className="w-4 h-4 mr-1" /> Add Host
        </Button>
      </div>

      {hosts.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-hosts">No builder hosts yet. Add one to get started.</CardContent></Card>
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
                    <Button size="icon" variant="ghost" onClick={() => openEdit(host)} data-testid={`button-edit-host-${host.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this host?")) deleteMutation.mutate(host.id); }} data-testid={`button-delete-host-${host.id}`}><Trash2 className="w-4 h-4" /></Button>
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
    </div>
  );
}

// ============ PROFILES SECTION ============

function ProfilesSection() {
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
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold" data-testid="text-profiles-title">Builder Profiles ({profiles.length})</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-profile">
          <Plus className="w-4 h-4 mr-1" /> Add Profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-profiles">No builder profiles yet.</CardContent></Card>
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
                      <Button size="icon" variant="ghost" onClick={() => openEdit(profile)} data-testid={`button-edit-profile-${profile.id}`}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this profile?")) deleteMutation.mutate(profile.id); }} data-testid={`button-delete-profile-${profile.id}`}><Trash2 className="w-4 h-4" /></Button>
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
                  <div key={perm.key} className="flex items-center gap-2">
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
    </div>
  );
}

// ============ PLACEMENTS SECTION ============

function PlacementsSection() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState<any>(null);
  const [formData, setFormData] = useState({
    builderHostId: "",
    builderProfileId: "",
    surfaceId: "",
    placementName: "",
    slug: "",
    domainHint: "",
    embedMode: "store",
    status: "active",
  });

  const { data: placements = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/external/placements"] });
  const { data: hosts = [] } = useQuery<any[]>({ queryKey: ["/api/admin/external/hosts"] });
  const { data: profiles = [] } = useQuery<any[]>({ queryKey: ["/api/admin/external/profiles"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/external/placements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/placements"] });
      toast({ title: "Placement created" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/admin/external/placements/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/placements"] });
      toast({ title: "Placement updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/external/placements/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/placements"] });
      toast({ title: "Placement deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingPlacement(null);
    setFormData({ builderHostId: "", builderProfileId: "", surfaceId: "", placementName: "", slug: "", domainHint: "", embedMode: "store", status: "active" });
  };

  const openEdit = (p: any) => {
    setEditingPlacement(p);
    setFormData({
      builderHostId: p.builderHostId || "",
      builderProfileId: p.builderProfileId || "",
      surfaceId: p.surfaceId || "",
      placementName: p.placementName || "",
      slug: p.slug || "",
      domainHint: p.domainHint || "",
      embedMode: p.embedMode || "store",
      status: p.status || "active",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const cleaned = { ...formData, builderProfileId: formData.builderProfileId === "__none__" ? "" : formData.builderProfileId };
    if (editingPlacement) {
      updateMutation.mutate({ id: editingPlacement.id, ...cleaned });
    } else {
      createMutation.mutate(cleaned);
    }
  };

  const getHostName = (id: string) => (hosts as any[]).find((h: any) => h.id === id)?.name || id;

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" data-testid="loader-placements" /></div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold" data-testid="text-placements-title">Builder Placements ({placements.length})</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-placement">
          <Plus className="w-4 h-4 mr-1" /> Add Placement
        </Button>
      </div>

      {placements.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-placements">No placements yet. Create a host first, then add placements.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {placements.map((p: any) => {
            const ModeIcon = EMBED_MODE_ICONS[p.embedMode] || Globe;
            return (
              <Card key={p.id} data-testid={`card-placement-${p.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ModeIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium" data-testid={`text-placement-name-${p.id}`}>{p.placementName}</span>
                        <Badge variant="outline" className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge>
                        <Badge variant="secondary">{p.embedMode}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Host: {getHostName(p.builderHostId)}</p>
                      {p.slug && <p className="text-xs text-muted-foreground font-mono">/{p.slug}</p>}
                      {p.domainHint && <p className="text-xs text-muted-foreground">{p.domainHint}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-placement-${p.id}`}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this placement?")) deleteMutation.mutate(p.id); }} data-testid={`button-delete-placement-${p.id}`}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPlacement ? "Edit Placement" : "Add Placement"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Host</Label>
              <Select value={formData.builderHostId} onValueChange={(v) => setFormData({ ...formData, builderHostId: v })}>
                <SelectTrigger data-testid="select-placement-host"><SelectValue placeholder="Select host" /></SelectTrigger>
                <SelectContent>
                  {(hosts as any[]).map((h: any) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Placement Name</Label><Input value={formData.placementName} onChange={(e) => setFormData({ ...formData, placementName: e.target.value })} data-testid="input-placement-name" /></div>
            <div><Label>Slug</Label><Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="auto-generated from name" data-testid="input-placement-slug" /></div>
            <div><Label>Domain Hint</Label><Input value={formData.domainHint} onChange={(e) => setFormData({ ...formData, domainHint: e.target.value })} placeholder="patriotmerch.example.com" data-testid="input-placement-domain" /></div>
            <div>
              <Label>Profile</Label>
              <Select value={formData.builderProfileId} onValueChange={(v) => setFormData({ ...formData, builderProfileId: v })}>
                <SelectTrigger data-testid="select-placement-profile"><SelectValue placeholder="Select profile" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {(profiles as any[]).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Surface ID</Label><Input value={formData.surfaceId} onChange={(e) => setFormData({ ...formData, surfaceId: e.target.value })} data-testid="input-placement-surface" /></div>
            <div>
              <Label>Embed Mode</Label>
              <Select value={formData.embedMode} onValueChange={(v) => setFormData({ ...formData, embedMode: v })}>
                <SelectTrigger data-testid="select-placement-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Mini Store</SelectItem>
                  <SelectItem value="product">Single Product</SelectItem>
                  <SelectItem value="builder">Mini Builder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="select-placement-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-placement">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.placementName.trim() || !formData.builderHostId || createMutation.isPending || updateMutation.isPending} data-testid="button-save-placement">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingPlacement ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ PRICING SECTION ============

function PricingSection() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    currency: "USD",
    baseCostMode: "snapshot",
    baseRetailPrice: 0,
    platformMarginType: "percent",
    platformMarginValue: 0,
    affiliatePercent: 25,
    roundingMode: "round",
    status: "draft",
  });

  const { data: policies = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/external/pricing-policies"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/external/pricing-policies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/pricing-policies"] });
      toast({ title: "Pricing policy created" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/admin/external/pricing-policies/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/pricing-policies"] });
      toast({ title: "Policy updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/external/pricing-policies/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/pricing-policies"] });
      toast({ title: "Policy deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingPolicy(null);
    setFormData({ name: "", currency: "USD", baseCostMode: "snapshot", baseRetailPrice: 0, platformMarginType: "percent", platformMarginValue: 0, affiliatePercent: 25, roundingMode: "round", status: "draft" });
  };

  const openEdit = (policy: any) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name || "",
      currency: policy.currency || "USD",
      baseCostMode: policy.baseCostMode || "snapshot",
      baseRetailPrice: policy.baseRetailPrice || 0,
      platformMarginType: policy.platformMarginType || "percent",
      platformMarginValue: policy.platformMarginValue || 0,
      affiliatePercent: policy.affiliatePercent ?? 25,
      roundingMode: policy.roundingMode || "round",
      status: policy.status || "draft",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" data-testid="loader-pricing" /></div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold" data-testid="text-pricing-title">Pricing Policies ({policies.length})</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-pricing">
          <Plus className="w-4 h-4 mr-1" /> Add Policy
        </Button>
      </div>

      {policies.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-pricing">No pricing policies yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {policies.map((policy: any) => (
            <Card key={policy.id} data-testid={`card-pricing-${policy.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{policy.name}</span>
                      <Badge variant="outline" className={STATUS_COLORS[policy.status] || ""}>{policy.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {policy.affiliatePercent}% affiliate share | {policy.currency} | {policy.baseCostMode} cost mode
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(policy)} data-testid={`button-edit-pricing-${policy.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this policy?")) deleteMutation.mutate(policy.id); }} data-testid={`button-delete-pricing-${policy.id}`}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPolicy ? "Edit Policy" : "Add Pricing Policy"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="input-pricing-name" /></div>
            <div><Label>Currency</Label><Input value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} data-testid="input-pricing-currency" /></div>
            <div>
              <Label>Base Cost Mode</Label>
              <Select value={formData.baseCostMode} onValueChange={(v) => setFormData({ ...formData, baseCostMode: v })}>
                <SelectTrigger data-testid="select-pricing-costmode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="snapshot">Snapshot</SelectItem>
                  <SelectItem value="live-cost">Live Cost</SelectItem>
                  <SelectItem value="variant-cost">Variant Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Base Retail Price</Label><Input type="number" step="0.01" value={formData.baseRetailPrice} onChange={(e) => setFormData({ ...formData, baseRetailPrice: parseFloat(e.target.value) || 0 })} data-testid="input-pricing-retail" /></div>
            <div>
              <Label>Platform Margin Type</Label>
              <Select value={formData.platformMarginType} onValueChange={(v) => setFormData({ ...formData, platformMarginType: v })}>
                <SelectTrigger data-testid="select-pricing-margintype"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Platform Margin Value</Label><Input type="number" step="0.01" value={formData.platformMarginValue} onChange={(e) => setFormData({ ...formData, platformMarginValue: parseFloat(e.target.value) || 0 })} data-testid="input-pricing-marginval" /></div>
            <div><Label>Affiliate Percent</Label><Input type="number" value={formData.affiliatePercent} onChange={(e) => setFormData({ ...formData, affiliatePercent: parseFloat(e.target.value) || 25 })} data-testid="input-pricing-affiliate" /></div>
            <div>
              <Label>Rounding Mode</Label>
              <Select value={formData.roundingMode} onValueChange={(v) => setFormData({ ...formData, roundingMode: v })}>
                <SelectTrigger data-testid="select-pricing-rounding"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="round">Round</SelectItem>
                  <SelectItem value="ceil">Ceil</SelectItem>
                  <SelectItem value="floor">Floor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="select-pricing-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-pricing">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending} data-testid="button-save-pricing">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingPolicy ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ REVENUE SECTION ============

function RevenueSection() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingSplit, setEditingSplit] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    affiliateSharePercent: 25,
    platformSharePercent: 75,
    notes: "",
    status: "draft",
  });

  const { data: splits = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/external/revenue-splits"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/external/revenue-splits", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/revenue-splits"] });
      toast({ title: "Revenue split created" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/admin/external/revenue-splits/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/revenue-splits"] });
      toast({ title: "Split updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/external/revenue-splits/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external/revenue-splits"] });
      toast({ title: "Split deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingSplit(null);
    setFormData({ name: "", affiliateSharePercent: 25, platformSharePercent: 75, notes: "", status: "draft" });
  };

  const openEdit = (split: any) => {
    setEditingSplit(split);
    setFormData({
      name: split.name || "",
      affiliateSharePercent: split.affiliateSharePercent ?? 25,
      platformSharePercent: split.platformSharePercent ?? 75,
      notes: split.notes || "",
      status: split.status || "draft",
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (editingSplit) {
      updateMutation.mutate({ id: editingSplit.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" data-testid="loader-revenue" /></div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold" data-testid="text-revenue-title">Revenue Splits ({splits.length})</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-split">
          <Plus className="w-4 h-4 mr-1" /> Add Split
        </Button>
      </div>

      {splits.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-splits">No revenue splits configured. Default is 25% affiliate / 75% platform.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {splits.map((split: any) => (
            <Card key={split.id} data-testid={`card-split-${split.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PieChart className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{split.name}</span>
                      <Badge variant="outline" className={STATUS_COLORS[split.status] || ""}>{split.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Affiliate: {split.affiliateSharePercent}% | Platform: {split.platformSharePercent}%
                    </p>
                    {split.notes && <p className="text-xs text-muted-foreground">{split.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(split)} data-testid={`button-edit-split-${split.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this split?")) deleteMutation.mutate(split.id); }} data-testid={`button-delete-split-${split.id}`}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingSplit ? "Edit Split" : "Add Revenue Split"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="input-split-name" /></div>
            <div><Label>Affiliate Share %</Label><Input type="number" value={formData.affiliateSharePercent} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setFormData({ ...formData, affiliateSharePercent: v, platformSharePercent: 100 - v }); }} data-testid="input-split-affiliate" /></div>
            <div><Label>Platform Share %</Label><Input type="number" value={formData.platformSharePercent} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setFormData({ ...formData, platformSharePercent: v, affiliateSharePercent: 100 - v }); }} data-testid="input-split-platform" /></div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} data-testid="input-split-notes" /></div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="select-split-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-split">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending} data-testid="button-save-split">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingSplit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ ATTRIBUTIONS SECTION ============

function AttributionsSection() {
  const [filterHost, setFilterHost] = useState("__all__");
  const [filterAffiliate, setFilterAffiliate] = useState("");

  const queryParams = new URLSearchParams();
  if (filterHost && filterHost !== "__all__") queryParams.set("builderHostId", filterHost);
  if (filterAffiliate) queryParams.set("affiliateUserId", filterAffiliate);
  const queryString = queryParams.toString();
  const url = `/api/admin/external/attributions${queryString ? `?${queryString}` : ""}`;

  const { data: attributions = [], isLoading } = useQuery<any[]>({ queryKey: [url] });
  const { data: hosts = [] } = useQuery<any[]>({ queryKey: ["/api/admin/external/hosts"] });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" data-testid="loader-attributions" /></div>;

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold" data-testid="text-attributions-title">Order Attributions ({attributions.length})</h2>

      <div className="flex gap-2 flex-wrap">
        <Select value={filterHost} onValueChange={setFilterHost}>
          <SelectTrigger className="w-[180px]" data-testid="select-attr-host"><SelectValue placeholder="All hosts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All hosts</SelectItem>
            {(hosts as any[]).map((h: any) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by affiliate user ID"
          value={filterAffiliate}
          onChange={(e) => setFilterAffiliate(e.target.value)}
          className="w-[220px]"
          data-testid="input-attr-affiliate"
        />
      </div>

      {attributions.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-attributions">No order attributions recorded yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {attributions.map((attr: any) => (
            <Card key={attr.id} data-testid={`card-attr-${attr.id}`}>
              <CardContent className="p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium font-mono text-sm">Order: {attr.orderId}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Sale Price:</span><span>${attr.displaySalePrice?.toFixed(2)}</span>
                    <span className="text-muted-foreground">Gross Profit:</span><span>${attr.grossProfitAmount?.toFixed(2)}</span>
                    <span className="text-muted-foreground">Affiliate ({attr.affiliatePercent}%):</span><span className="text-green-600 font-medium">${attr.affiliateAmount?.toFixed(2)}</span>
                    <span className="text-muted-foreground">Platform Net:</span><span>${attr.netPlatformProfitAmount?.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{attr.createdAt}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ PAYOUTS SECTION ============

function PayoutsSection() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState("__all__");

  const queryParams = new URLSearchParams();
  if (filterStatus && filterStatus !== "__all__") queryParams.set("status", filterStatus);
  const queryString = queryParams.toString();
  const url = `/api/admin/external/payouts${queryString ? `?${queryString}` : ""}`;

  const { data: payouts = [], isLoading } = useQuery<any[]>({ queryKey: [url] });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/external/payouts/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [url] });
      toast({ title: "Payout updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" data-testid="loader-payouts" /></div>;

  const totalPending = payouts.filter((p: any) => p.status === "pending").reduce((sum: number, p: any) => sum + (p.affiliateAmount || 0), 0);
  const totalPaid = payouts.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + (p.affiliateAmount || 0), 0);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold" data-testid="text-payouts-title">Affiliate Payouts ({payouts.length})</h2>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-xl font-bold text-yellow-600" data-testid="text-pending-total">${totalPending.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-xl font-bold text-green-600" data-testid="text-paid-total">${totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="w-[180px]" data-testid="select-payout-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="reversed">Reversed</SelectItem>
        </SelectContent>
      </Select>

      {payouts.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-payouts">No payout entries yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout: any) => (
            <Card key={payout.id} data-testid={`card-payout-${payout.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">${payout.affiliateAmount?.toFixed(2)}</span>
                      <Badge variant="outline" className={STATUS_COLORS[payout.status] || ""}>{payout.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Order: {payout.orderId}</p>
                    <p className="text-xs text-muted-foreground">User: {payout.affiliateUserId}</p>
                    <p className="text-xs text-muted-foreground">{payout.createdAt}</p>
                  </div>
                  {payout.status === "pending" && (
                    <Button
                      variant="outline"
                      onClick={() => updateMutation.mutate({ id: payout.id, status: "approved" })}
                      disabled={updateMutation.isPending}
                      data-testid={`button-approve-payout-${payout.id}`}
                    >
                      Approve
                    </Button>
                  )}
                  {payout.status === "approved" && (
                    <Button
                      variant="outline"
                      onClick={() => updateMutation.mutate({ id: payout.id, status: "paid" })}
                      disabled={updateMutation.isPending}
                      data-testid={`button-pay-payout-${payout.id}`}
                    >
                      Mark Paid
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
