import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Gift, Plus, Edit, Trash2, Package, Sparkles, Clock, Eye, Copy, Mail, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { SELL_SUBNAV } from "@/components/admin/adminNavConfig";
import type { GiftPackage, GiftCode, GiftRedemption, MasterProduct } from "@shared/schema";
import { format } from "date-fns";

interface PackageFormData {
  name: string;
  description: string;
  giftType: "product" | "dynamics";
  masterProductId: string;
  dynamicsTier: string;
  dynamicsMonths: number;
  price: string;
  allowColorChoice: boolean;
  allowSizeChoice: boolean;
  allowQrCustomization: boolean;
  includePersonalMessage: boolean;
  redemptionValidDays: number;
  displayImage: string;
  isActive: boolean;
  sortOrder: number;
}

const defaultFormData: PackageFormData = {
  name: "",
  description: "",
  giftType: "product",
  masterProductId: "",
  dynamicsTier: "standard",
  dynamicsMonths: 12,
  price: "29.99",
  allowColorChoice: true,
  allowSizeChoice: true,
  allowQrCustomization: true,
  includePersonalMessage: true,
  redemptionValidDays: 365,
  displayImage: "",
  isActive: true,
  sortOrder: 0,
};

export default function AdminGiftsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("packages");
  const [editingPackage, setEditingPackage] = useState<GiftPackage | null>(null);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [formData, setFormData] = useState<PackageFormData>(defaultFormData);

  // Queries
  const { data: packages = [], isLoading: loadingPackages } = useQuery<GiftPackage[]>({
    queryKey: ["/api/admin/gifts/packages"],
  });

  const { data: codes = [], isLoading: loadingCodes } = useQuery<GiftCode[]>({
    queryKey: ["/api/admin/gifts/codes"],
  });

  const { data: redemptions = [], isLoading: loadingRedemptions } = useQuery<GiftRedemption[]>({
    queryKey: ["/api/admin/gifts/redemptions"],
  });

  const { data: masterProducts = [] } = useQuery<MasterProduct[]>({
    queryKey: ["/api/admin/orchestration/master-products"],
  });

  // Mutations
  const createPackageMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const res = await apiRequest("POST", "/api/admin/gifts/packages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts/packages"] });
      setShowPackageDialog(false);
      setFormData(defaultFormData);
      toast({ title: "Package created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PackageFormData> }) => {
      const res = await apiRequest("PATCH", `/api/admin/gifts/packages/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts/packages"] });
      setShowPackageDialog(false);
      setEditingPackage(null);
      setFormData(defaultFormData);
      toast({ title: "Package updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/gifts/packages/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts/packages"] });
      toast({ title: "Package deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRedemptionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/gifts/redemptions/${id}`, { fulfillmentStatus: status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts/redemptions"] });
      toast({ title: "Redemption updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEditDialog = (pkg: GiftPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      giftType: pkg.giftType as "product" | "dynamics",
      masterProductId: pkg.masterProductId || "",
      dynamicsTier: pkg.dynamicsTier || "standard",
      dynamicsMonths: pkg.dynamicsMonths || 12,
      price: pkg.price,
      allowColorChoice: pkg.allowColorChoice ?? true,
      allowSizeChoice: pkg.allowSizeChoice ?? true,
      allowQrCustomization: pkg.allowQrCustomization ?? true,
      includePersonalMessage: pkg.includePersonalMessage ?? true,
      redemptionValidDays: pkg.redemptionValidDays || 365,
      displayImage: pkg.displayImage || "",
      isActive: pkg.isActive ?? true,
      sortOrder: pkg.sortOrder || 0,
    });
    setShowPackageDialog(true);
  };

  const handleSavePackage = () => {
    if (!formData.name || !formData.price) {
      toast({ title: "Missing info", description: "Name and price are required", variant: "destructive" });
      return;
    }
    if (editingPackage) {
      updatePackageMutation.mutate({ id: editingPackage.id, data: formData });
    } else {
      createPackageMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "redeemed":
        return <Badge variant="secondary"><Gift className="h-3 w-3 mr-1" />Redeemed</Badge>;
      case "expired":
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getFulfillmentBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "processing":
        return <Badge variant="secondary"><Package className="h-3 w-3 mr-1" />Processing</Badge>;
      case "shipped":
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Shipped</Badge>;
      case "delivered":
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
      case "activated":
        return <Badge variant="default"><Sparkles className="h-3 w-3 mr-1" />Activated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: "Gift code copied to clipboard" });
  };

  return (
    <AdminShell
      title="Gift Management"
      subtitle="Manage gift packages, codes, and redemptions"
      icon={Gift}
      backHref="/admin"
      backLabel="Back"
      sectionNav={<AdminSectionSubNav items={SELL_SUBNAV} />}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="packages" className="!min-h-[48px] px-6" data-testid="tab-packages">
            <Package className="h-4 w-4 mr-2" />
            Packages ({packages.length})
          </TabsTrigger>
          <TabsTrigger value="codes" className="!min-h-[48px] px-6" data-testid="tab-codes">
            <Gift className="h-4 w-4 mr-2" />
            Codes ({codes.length})
          </TabsTrigger>
          <TabsTrigger value="redemptions" className="!min-h-[48px] px-6" data-testid="tab-redemptions">
            <CheckCircle className="h-4 w-4 mr-2" />
            Redemptions ({redemptions.length})
          </TabsTrigger>
        </TabsList>

        {/* Packages Tab */}
        <TabsContent value="packages">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Gift Packages</CardTitle>
                <CardDescription>Create and manage gift offerings</CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingPackage(null);
                  setFormData(defaultFormData);
                  setShowPackageDialog(true);
                }}
                className="h-12"
                data-testid="button-add-package"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Package
              </Button>
            </CardHeader>
            <CardContent>
              {loadingPackages ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : packages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No gift packages yet. Create your first one!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((pkg) => (
                      <TableRow key={pkg.id} data-testid={`row-package-${pkg.id}`}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell>
                          {pkg.giftType === "dynamics" ? (
                            <Badge variant="default"><Sparkles className="h-3 w-3 mr-1" />Dynamics</Badge>
                          ) : (
                            <Badge variant="secondary"><Package className="h-3 w-3 mr-1" />Product</Badge>
                          )}
                        </TableCell>
                        <TableCell>${parseFloat(pkg.price).toFixed(2)}</TableCell>
                        <TableCell>
                          {pkg.isActive ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditDialog(pkg)}
                              className="h-12 w-12"
                              data-testid={`button-edit-package-${pkg.id}`}
                            >
                              <Edit className="h-5 w-5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Delete this package?")) {
                                  deletePackageMutation.mutate(pkg.id);
                                }
                              }}
                              className="h-12 w-12 text-destructive"
                              data-testid={`button-delete-package-${pkg.id}`}
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Codes Tab */}
        <TabsContent value="codes">
          <Card>
            <CardHeader>
              <CardTitle>Gift Codes</CardTitle>
              <CardDescription>View all purchased gift codes</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCodes ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : codes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No gift codes purchased yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.map((code) => (
                      <TableRow key={code.id} data-testid={`row-code-${code.id}`}>
                        <TableCell className="font-mono font-medium">{code.code}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{code.buyerName || "—"}</div>
                            <div className="text-muted-foreground">{code.buyerEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(code.status)}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(code.expiresAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(code.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => copyCode(code.code)}
                              className="h-12 w-12"
                              data-testid={`button-copy-code-${code.id}`}
                            >
                              <Copy className="h-5 w-5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Redemptions Tab */}
        <TabsContent value="redemptions">
          <Card>
            <CardHeader>
              <CardTitle>Gift Redemptions</CardTitle>
              <CardDescription>Track redemptions and fulfillment</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRedemptions ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : redemptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No gifts redeemed yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Options</TableHead>
                      <TableHead>Fulfillment</TableHead>
                      <TableHead>Redeemed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((redemption) => (
                      <TableRow key={redemption.id} data-testid={`row-redemption-${redemption.id}`}>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{redemption.recipientName || "—"}</div>
                            <div className="text-muted-foreground">{redemption.recipientEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            {redemption.selectedColor && <div>Color: {redemption.selectedColor}</div>}
                            {redemption.selectedSize && <div>Size: {redemption.selectedSize}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{getFulfillmentBadge(redemption.fulfillmentStatus || "pending")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(redemption.redeemedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={redemption.fulfillmentStatus || "pending"}
                            onValueChange={(status) => updateRedemptionMutation.mutate({ id: redemption.id, status })}
                          >
                            <SelectTrigger className="h-12 w-36" data-testid={`select-fulfillment-${redemption.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending" className="min-h-[48px]">Pending</SelectItem>
                              <SelectItem value="processing" className="min-h-[48px]">Processing</SelectItem>
                              <SelectItem value="shipped" className="min-h-[48px]">Shipped</SelectItem>
                              <SelectItem value="delivered" className="min-h-[48px]">Delivered</SelectItem>
                              <SelectItem value="activated" className="min-h-[48px]">Activated</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Package Edit/Create Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPackage ? "Edit Package" : "Create Gift Package"}</DialogTitle>
            <DialogDescription>
              Configure your gift offering
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Package Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Birthday Gift Bundle"
                className="h-12"
                data-testid="input-package-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Perfect for birthdays..."
                rows={2}
                data-testid="input-package-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Gift Type</Label>
              <Select
                value={formData.giftType}
                onValueChange={(v) => setFormData({ ...formData, giftType: v as "product" | "dynamics" })}
              >
                <SelectTrigger className="h-12" data-testid="select-gift-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product" className="min-h-[48px]">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Physical Product
                    </div>
                  </SelectItem>
                  <SelectItem value="dynamics" className="min-h-[48px]">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      QR Dynamics Subscription
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.giftType === "product" && (
              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={formData.masterProductId}
                  onValueChange={(v) => setFormData({ ...formData, masterProductId: v })}
                >
                  <SelectTrigger className="h-12" data-testid="select-product">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {masterProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id} className="min-h-[48px]">
                        {product.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.giftType === "dynamics" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tier</Label>
                  <Select
                    value={formData.dynamicsTier}
                    onValueChange={(v) => setFormData({ ...formData, dynamicsTier: v })}
                  >
                    <SelectTrigger className="h-12" data-testid="select-dynamics-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic" className="min-h-[48px]">Basic</SelectItem>
                      <SelectItem value="standard" className="min-h-[48px]">Standard</SelectItem>
                      <SelectItem value="premium" className="min-h-[48px]">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dynamicsMonths">Months</Label>
                  <Input
                    id="dynamicsMonths"
                    type="number"
                    value={formData.dynamicsMonths}
                    onChange={(e) => setFormData({ ...formData, dynamicsMonths: parseInt(e.target.value) || 12 })}
                    className="h-12"
                    data-testid="input-dynamics-months"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="29.99"
                  className="h-12"
                  data-testid="input-package-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validDays">Valid for (days)</Label>
                <Input
                  id="validDays"
                  type="number"
                  value={formData.redemptionValidDays}
                  onChange={(e) => setFormData({ ...formData, redemptionValidDays: parseInt(e.target.value) || 365 })}
                  className="h-12"
                  data-testid="input-valid-days"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Customization Options</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between min-h-12">
                  <Label htmlFor="colorChoice" className="font-normal">Allow color choice</Label>
                  <Switch
                    id="colorChoice"
                    checked={formData.allowColorChoice}
                    onCheckedChange={(v) => setFormData({ ...formData, allowColorChoice: v })}
                    data-testid="switch-color-choice"
                  />
                </div>
                <div className="flex items-center justify-between min-h-12">
                  <Label htmlFor="sizeChoice" className="font-normal">Allow size choice</Label>
                  <Switch
                    id="sizeChoice"
                    checked={formData.allowSizeChoice}
                    onCheckedChange={(v) => setFormData({ ...formData, allowSizeChoice: v })}
                    data-testid="switch-size-choice"
                  />
                </div>
                <div className="flex items-center justify-between min-h-12">
                  <Label htmlFor="qrCustomization" className="font-normal">Allow QR customization</Label>
                  <Switch
                    id="qrCustomization"
                    checked={formData.allowQrCustomization}
                    onCheckedChange={(v) => setFormData({ ...formData, allowQrCustomization: v })}
                    data-testid="switch-qr-customization"
                  />
                </div>
                <div className="flex items-center justify-between min-h-12">
                  <Label htmlFor="personalMessage" className="font-normal">Include personal message</Label>
                  <Switch
                    id="personalMessage"
                    checked={formData.includePersonalMessage}
                    onCheckedChange={(v) => setFormData({ ...formData, includePersonalMessage: v })}
                    data-testid="switch-personal-message"
                  />
                </div>
                <div className="flex items-center justify-between min-h-12">
                  <Label htmlFor="isActive" className="font-normal">Active (visible in shop)</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                    data-testid="switch-is-active"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => setShowPackageDialog(false)}
              className="h-12"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePackage}
              disabled={createPackageMutation.isPending || updatePackageMutation.isPending}
              className="h-12"
              data-testid="button-save-package"
            >
              {createPackageMutation.isPending || updatePackageMutation.isPending 
                ? "Saving..." 
                : editingPackage ? "Update Package" : "Create Package"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
