import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import {
  Plus, Trash2, Pencil, Loader2,
  PieChart, FileText, CreditCard,
} from "lucide-react";

interface RevenueSplit {
  id: string;
  name: string;
  affiliateSharePercent: number;
  platformSharePercent: number;
  notes: string;
  status: string;
}

interface OrderAttribution {
  id: string;
  orderId: string;
  displaySalePrice: number;
  grossProfitAmount: number;
  affiliatePercent: number;
  affiliateAmount: number;
  netPlatformProfitAmount: number;
  createdAt: string;
}

interface AffiliatePayout {
  id: string;
  orderId: string;
  affiliateUserId: string;
  affiliateAmount: number;
  status: string;
  createdAt: string;
}

interface BuilderHostRef {
  id: string;
  name: string;
}

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

export function RevenueSection() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingSplit, setEditingSplit] = useState<RevenueSplit | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    affiliateSharePercent: 25,
    platformSharePercent: 75,
    notes: "",
    status: "draft",
  });

  const { data: splits = [], isLoading } = useQuery<RevenueSplit[]>({ queryKey: ["/api/admin/external/revenue-splits"] });

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

  const openEdit = (split: RevenueSplit) => {
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
    <AdminSectionCard
      title={`Revenue Splits (${splits.length})`}
      icon={PieChart}
      actions={
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-split">
          <Plus className="w-4 h-4 mr-1" /> Add Split
        </Button>
      }
    >
      {splits.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-no-splits">No revenue splits configured. Default is 25% affiliate / 75% platform.</div>
      ) : (
        <div className="space-y-3">
          {splits.map((split) => (
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
                    <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => openEdit(split)} data-testid={`button-edit-split-${split.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { if (confirm("Delete this split?")) deleteMutation.mutate(split.id); }} data-testid={`button-delete-split-${split.id}`}><Trash2 className="w-4 h-4" /></Button>
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
    </AdminSectionCard>
  );
}

export function AttributionsSection() {
  const [filterHost, setFilterHost] = useState("__all__");
  const [filterAffiliate, setFilterAffiliate] = useState("");

  const queryParams = new URLSearchParams();
  if (filterHost && filterHost !== "__all__") queryParams.set("builderHostId", filterHost);
  if (filterAffiliate) queryParams.set("affiliateUserId", filterAffiliate);
  const queryString = queryParams.toString();
  const url = `/api/admin/external/attributions${queryString ? `?${queryString}` : ""}`;

  const { data: attributions = [], isLoading } = useQuery<OrderAttribution[]>({ queryKey: [url] });
  const { data: hosts = [] } = useQuery<BuilderHostRef[]>({ queryKey: ["/api/admin/external/hosts"] });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" data-testid="loader-attributions" /></div>;

  return (
    <AdminSectionCard
      title={`Order Attributions (${attributions.length})`}
      icon={FileText}
    >
      <div className="flex gap-2 flex-wrap mb-4">
        <Select value={filterHost} onValueChange={setFilterHost}>
          <SelectTrigger className="w-[180px]" data-testid="select-attr-host"><SelectValue placeholder="All hosts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All hosts</SelectItem>
            {hosts.map((h) => (
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
        <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-no-attributions">No order attributions recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {attributions.map((attr) => (
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
    </AdminSectionCard>
  );
}

export function PayoutsSection() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState("__all__");

  const queryParams = new URLSearchParams();
  if (filterStatus && filterStatus !== "__all__") queryParams.set("status", filterStatus);
  const queryString = queryParams.toString();
  const url = `/api/admin/external/payouts${queryString ? `?${queryString}` : ""}`;

  const { data: payouts = [], isLoading } = useQuery<AffiliatePayout[]>({ queryKey: [url] });

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

  const totalPending = payouts.filter((p) => p.status === "pending").reduce((sum, p) => sum + (p.affiliateAmount || 0), 0);
  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + (p.affiliateAmount || 0), 0);

  return (
    <AdminSectionCard
      title={`Affiliate Payouts (${payouts.length})`}
      icon={CreditCard}
    >
      <div className="grid grid-cols-2 gap-3 mb-4">
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

      <div className="mb-4">
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
      </div>

      {payouts.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-no-payouts">No payout entries yet.</div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
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
                      className="min-h-[44px]"
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
                      className="min-h-[44px]"
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
    </AdminSectionCard>
  );
}
