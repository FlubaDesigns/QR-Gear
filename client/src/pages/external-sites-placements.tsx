import { useState } from "react";
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
import {
  Plus, Trash2, Pencil, Loader2, Globe, Users, Layout, MapPin,
  DollarSign, PieChart, FileText, CreditCard, Building2, Code, Eye,
  ShoppingBag, Hammer,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "border-green-500 text-green-600",
  pending: "border-yellow-500 text-yellow-600",
  inactive: "border-gray-400 text-gray-500",
  paused: "border-orange-500 text-orange-600",
  rejected: "border-red-500 text-red-600",
};

const EMBED_MODE_ICONS: Record<string, typeof Globe> = {
  iframe: Layout,
  widget: Code,
  popup: Eye,
  inline: ShoppingBag,
  custom: Hammer,
};

export function PlacementsSection() {
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

export function PricingSection() {
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

