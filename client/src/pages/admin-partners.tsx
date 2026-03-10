import { useState } from "react";
import { Link } from "wouter";
import AdminShell from "@/components/AdminShell";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Store, Copy, RefreshCw, ExternalLink, Key, Globe, Loader2 } from "lucide-react";
import type { PartnerStore } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface StoreFormData {
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  websiteUrl: string;
  businessPageUrlPattern: string;
  allowedOrigins: string;
  primaryColor: string;
  accentColor: string;
  commissionPercent: string;
  availableSegments: string;
  isInternal: boolean;
  isActive: boolean;
}

const defaultFormData: StoreFormData = {
  slug: "",
  name: "",
  description: "",
  logoUrl: "",
  websiteUrl: "",
  businessPageUrlPattern: "",
  allowedOrigins: "",
  primaryColor: "#4f46e5",
  accentColor: "#f59e0b",
  commissionPercent: "0",
  availableSegments: "",
  isInternal: false,
  isActive: true,
};

export default function AdminPartners() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingStore, setEditingStore] = useState<PartnerStore | null>(null);
  const [formData, setFormData] = useState<StoreFormData>(defaultFormData);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [viewingStore, setViewingStore] = useState<PartnerStore | null>(null);

  const { data: stores = [], isLoading } = useQuery<PartnerStore[]>({
    queryKey: ["/api/admin/partner-stores"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/partner-stores", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      setShowDialog(false);
      setFormData(defaultFormData);
      toast({ title: "Partner store created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/partner-stores/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      setShowDialog(false);
      setEditingStore(null);
      setFormData(defaultFormData);
      toast({ title: "Partner store updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/partner-stores/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      toast({ title: "Partner store deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/partner-stores/${id}/regenerate-key`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      toast({ title: "API key regenerated", description: "New key: " + data.apiKey.substring(0, 20) + "..." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDialog = (store?: PartnerStore) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        slug: store.slug,
        name: store.name,
        description: store.description || "",
        logoUrl: store.logoUrl || "",
        websiteUrl: store.websiteUrl || "",
        businessPageUrlPattern: store.businessPageUrlPattern || "",
        allowedOrigins: (store.allowedOrigins || []).join(", "),
        primaryColor: store.primaryColor || "#4f46e5",
        accentColor: store.accentColor || "#f59e0b",
        commissionPercent: store.commissionPercent || "0",
        availableSegments: (store.availableSegments || []).join(", "),
        isInternal: store.isInternal || false,
        isActive: store.isActive ?? true,
      });
    } else {
      setEditingStore(null);
      setFormData(defaultFormData);
    }
    setShowDialog(true);
  };

  const handleSubmit = () => {
    // Parse arrays - send undefined instead of empty arrays for optional fields
    const allowedOriginsArr = formData.allowedOrigins 
      ? formData.allowedOrigins.split(",").map(s => s.trim()).filter(Boolean) 
      : [];
    const availableSegmentsArr = formData.availableSegments 
      ? formData.availableSegments.split(",").map(s => s.trim()).filter(Boolean) 
      : [];
    
    const data: Record<string, any> = {
      slug: formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name: formData.name,
      description: formData.description || null,
      logoUrl: formData.logoUrl || null,
      websiteUrl: formData.websiteUrl || null,
      businessPageUrlPattern: formData.businessPageUrlPattern || null,
      primaryColor: formData.primaryColor || null,
      accentColor: formData.accentColor || null,
      commissionPercent: formData.commissionPercent || "0",
      isInternal: formData.isInternal,
      isActive: formData.isActive,
    };
    
    // Only include arrays if they have values (avoids Zod rejecting empty arrays)
    if (allowedOriginsArr.length > 0) {
      data.allowedOrigins = allowedOriginsArr;
    }
    if (availableSegmentsArr.length > 0) {
      data.availableSegments = availableSegmentsArr;
    }

    if (editingStore) {
      updateMutation.mutate({ id: editingStore.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  return (
    <AdminShell
      title="Store Management"
      subtitle="Internal stores (ours) & partner stores (external)"
      icon={Store}
      actions={
        user ? (
          <>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Logged in as</p>
              <p className="text-sm font-medium">{user.email || user.id}</p>
            </div>
            <Button 
              variant="outline" 
              onClick={copyUserId}
              className="font-mono text-xs qr-touch-48"
              data-testid="button-copy-user-id"
            >
              Copy ID
            </Button>
          </>
        ) : undefined
      }
    >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>All Stores</CardTitle>
              <CardDescription>
                Internal stores = our QR Gear stores. Partner stores = external partners like Kingdom Connects.
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="h-12 px-6" data-testid="button-add-store">
              <Plus className="h-5 w-5 mr-2" />
              Add Store
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : stores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Store className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No stores configured yet.</p>
                <p className="text-sm mt-1">Add an internal store (like QR Maine) or a partner store (for external sites).</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((store) => (
                      <TableRow key={store.id} data-testid={`row-store-${store.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {store.logoUrl ? (
                              <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Store className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{store.name}</p>
                              {store.websiteUrl && (
                                <a href={store.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {new URL(store.websiteUrl).hostname}
                                </a>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{store.slug}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={store.isInternal ? "default" : "outline"}>
                            {store.isInternal ? "Internal" : "Partner"}
                          </Badge>
                        </TableCell>
                        <TableCell>{store.commissionPercent || "0"}%</TableCell>
                        <TableCell>
                          <Badge variant={store.isActive ? "default" : "secondary"}>
                            {store.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => {
                                setViewingStore(store);
                                setShowApiKeyDialog(true);
                              }}
                              data-testid={`button-view-key-${store.id}`}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => handleOpenDialog(store)}
                              data-testid={`button-edit-${store.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-destructive"
                              onClick={() => {
                                if (confirm(`Delete "${store.name}"?`)) {
                                  deleteMutation.mutate(store.id);
                                }
                              }}
                              data-testid={`button-delete-${store.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Link href="/admin/sales/build">
              <Button variant="outline" className="h-12 px-6" data-testid="link-store-build">
                <ExternalLink className="h-4 w-4 mr-2" />
                Sales / Build Product Line
              </Button>
            </Link>
          </CardContent>
        </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStore ? "Edit Partner Store" : "Add Partner Store"}</DialogTitle>
            <DialogDescription>
              Configure partner store settings for widget embedding
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Store Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Kingdom Connects"
                  className="h-12"
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL-safe)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="kingdom-connects"
                  className="h-12"
                  data-testid="input-slug"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Partner store description..."
                data-testid="input-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="https://..."
                  className="h-12"
                  data-testid="input-logo-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://..."
                  className="h-12"
                  data-testid="input-website-url"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessPageUrlPattern">Business Page URL Pattern</Label>
              <Input
                id="businessPageUrlPattern"
                value={formData.businessPageUrlPattern}
                onChange={(e) => setFormData({ ...formData, businessPageUrlPattern: e.target.value })}
                placeholder="https://partner.com/business/{slug}.htm"
                className="h-12"
                data-testid="input-url-pattern"
              />
              <p className="text-xs text-muted-foreground">Use {"{slug}"} as placeholder for business slug</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="allowedOrigins">Allowed Origins (CORS)</Label>
              <Input
                id="allowedOrigins"
                value={formData.allowedOrigins}
                onChange={(e) => setFormData({ ...formData, allowedOrigins: e.target.value })}
                placeholder="https://partner.com, https://www.partner.com"
                className="h-12"
                data-testid="input-allowed-origins"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of origins allowed to embed the widget</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-12 h-12 p-1"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="h-12 flex-1"
                    data-testid="input-primary-color"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="w-12 h-12 p-1"
                  />
                  <Input
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="h-12 flex-1"
                    data-testid="input-accent-color"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionPercent">Commission %</Label>
                <Input
                  id="commissionPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.commissionPercent}
                  onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                  className="h-12"
                  data-testid="input-commission"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="availableSegments">Available Segments</Label>
              <Input
                id="availableSegments"
                value={formData.availableSegments}
                onChange={(e) => setFormData({ ...formData, availableSegments: e.target.value })}
                placeholder="Religious, Business, Gift Shop"
                className="h-12"
                data-testid="input-segments"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of store segments this partner can access</p>
            </div>
            
            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="isInternal"
                  checked={formData.isInternal}
                  onCheckedChange={(checked) => setFormData({ ...formData, isInternal: checked })}
                  data-testid="switch-internal"
                />
                <Label htmlFor="isInternal">Internal Store (ours, not a partner)</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-active"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="h-12" data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending || !formData.name || !formData.slug}
              className="h-12"
              data-testid="button-save"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingStore ? "Update Store" : "Create Store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key for {viewingStore?.name}</DialogTitle>
            <DialogDescription>
              Use this key for widget authentication
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={viewingStore?.apiKey || ""}
                  readOnly
                  className="font-mono text-sm h-12"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => copyToClipboard(viewingStore?.apiKey || "", "API Key")}
                  data-testid="button-copy-api-key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Widget Embed Code</Label>
              <Textarea
                readOnly
                value={`<script src="${window.location.origin}/widget.js" data-partner="${viewingStore?.slug}"></script>`}
                className="font-mono text-xs"
                rows={3}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => copyToClipboard(`<script src="${window.location.origin}/widget.js" data-partner="${viewingStore?.slug}"></script>`, "Embed code")}
                data-testid="button-copy-embed"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Embed Code
              </Button>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (viewingStore && confirm("Regenerate API key? The old key will stop working immediately.")) {
                  regenerateKeyMutation.mutate(viewingStore.id);
                }
              }}
              disabled={regenerateKeyMutation.isPending}
              className="h-12"
              data-testid="button-regenerate-key"
            >
              {regenerateKeyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Regenerate Key
            </Button>
            <Button variant="outline" onClick={() => setShowApiKeyDialog(false)} className="h-12" data-testid="button-close-key-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
