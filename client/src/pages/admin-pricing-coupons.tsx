import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Tag, Percent, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { Coupon } from '@shared/schema';

export function CouponsSection() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Coupon | null>(null);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    name: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    maxRedemptions: "",
    validUntil: "",
  });

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      code: string;
      name: string;
      discountType: string;
      discountValue: string;
      currency: string;
      isActive: boolean;
      maxRedemptions?: number | null;
      validUntil?: string | null;
    }) => apiRequest("POST", "/api/admin/coupons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setShowAddDialog(false);
      setNewCoupon({ code: "", name: "", discountType: "percent", discountValue: "", maxRedemptions: "", validUntil: "" });
      toast({ title: "Success", description: "Coupon created and synced with Stripe." });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to create coupon.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Coupon> }) =>
      apiRequest("PUT", `/api/admin/coupons/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Success", description: "Coupon updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update coupon.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setDeleteConfirm(null);
      toast({ title: "Success", description: "Coupon deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete coupon.", variant: "destructive" });
    },
  });

  function toggleActive(coupon: Coupon) {
    updateMutation.mutate({ id: coupon.id, updates: { isActive: !coupon.isActive } });
  }

  function handleCreateCoupon() {
    const missingFields: string[] = [];
    if (!newCoupon.code.trim()) missingFields.push("Coupon Code");
    if (!newCoupon.name.trim()) missingFields.push("Internal Name");
    if (!newCoupon.discountValue) missingFields.push(newCoupon.discountType === "percent" ? "Percentage" : "Amount");
    
    if (missingFields.length > 0) {
      toast({ 
        title: "Missing Information", 
        description: `Please fill in: ${missingFields.join(", ")}`, 
        variant: "destructive" 
      });
      return;
    }
    createMutation.mutate({
      code: newCoupon.code.trim().toUpperCase(),
      name: newCoupon.name.trim(),
      discountType: newCoupon.discountType,
      discountValue: newCoupon.discountValue,
      currency: "usd",
      isActive: true,
      maxRedemptions: newCoupon.maxRedemptions ? parseInt(newCoupon.maxRedemptions) : null,
      validUntil: newCoupon.validUntil || null,
    });
  }

  function formatDiscount(coupon: Coupon): string {
    if (coupon.discountType === "percent") {
      return `${coupon.discountValue}% off`;
    }
    return `$${coupon.discountValue} off`;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle>Coupons & Discounts</CardTitle>
            </div>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-coupon">
              <Plus className="h-4 w-4 mr-2" />
              Add Coupon
            </Button>
          </div>
          <CardDescription>
            Create discount codes that sync with Stripe. Customers can apply these at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!coupons || coupons.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">No coupons created yet.</p>
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-coupon-empty">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Coupon
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {coupons.map((coupon) => (
                <div 
                  key={coupon.id} 
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-md border-2 ${coupon.isActive ? "border-border bg-muted/30" : "border-border/50 bg-muted/10 opacity-60"}`}
                  data-testid={`coupon-${coupon.code}`}
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <Switch
                      checked={coupon.isActive ?? true}
                      onCheckedChange={() => toggleActive(coupon)}
                      data-testid={`toggle-coupon-${coupon.code}`}
                    />
                    <div className="flex items-center gap-2">
                      {coupon.discountType === "percent" ? (
                        <Percent className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <DollarSign className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-mono font-bold text-lg">{coupon.code}</span>
                        <p className="text-sm text-muted-foreground">{coupon.name}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {formatDiscount(coupon)}
                    </Badge>
                    {coupon.redemptionCount && coupon.redemptionCount > 0 && (
                      <Badge variant="outline" className="text-sm">
                        {coupon.redemptionCount} used
                      </Badge>
                    )}
                    {coupon.maxRedemptions && (
                      <Badge variant="outline" className="text-sm">
                        Limit: {coupon.maxRedemptions}
                      </Badge>
                    )}
                    {!coupon.isActive && (
                      <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                    )}
                    {coupon.stripePromotionCodeId && (
                      <Badge variant="default" className="bg-[#635BFF] text-white text-xs">Stripe</Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Button 
                      variant="outline"
                      size="icon"
                      onClick={() => setDeleteConfirm(coupon)}
                      data-testid={`button-delete-coupon-${coupon.code}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <p className="text-sm text-muted-foreground mt-4">
                Coupons are synced with Stripe. Customers enter the code at checkout for automatic discounts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Drawer open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Create Coupon</DrawerTitle>
            <DrawerDescription>Create a discount code that syncs with Stripe.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Coupon Code *</Label>
              <Input
                id="coupon-code"
                placeholder="e.g., SUMMER20"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                className="font-mono uppercase"
                maxLength={50}
                data-testid="input-coupon-code"
              />
              <p className="text-xs text-muted-foreground">Customers will enter this code at checkout</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-name">Internal Name *</Label>
              <Input
                id="coupon-name"
                placeholder="e.g., Summer Sale 2025"
                value={newCoupon.name}
                onChange={(e) => setNewCoupon({ ...newCoupon, name: e.target.value })}
                data-testid="input-coupon-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount-type">Discount Type</Label>
                <Select
                  value={newCoupon.discountType}
                  onValueChange={(value: "percent" | "fixed") => setNewCoupon({ ...newCoupon, discountType: value })}
                >
                  <SelectTrigger data-testid="select-discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Dollar Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-value">
                  {newCoupon.discountType === "percent" ? "Percentage *" : "Amount ($) *"}
                </Label>
                <Input
                  id="discount-value"
                  type="number"
                  placeholder={newCoupon.discountType === "percent" ? "20" : "5.00"}
                  value={newCoupon.discountValue}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })}
                  min="0"
                  step={newCoupon.discountType === "percent" ? "1" : "0.01"}
                  data-testid="input-discount-value"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-redemptions">Usage Limit</Label>
                <Input
                  id="max-redemptions"
                  type="number"
                  placeholder="Unlimited"
                  value={newCoupon.maxRedemptions}
                  onChange={(e) => setNewCoupon({ ...newCoupon, maxRedemptions: e.target.value })}
                  min="1"
                  data-testid="input-max-redemptions"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid-until">Expires</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={newCoupon.validUntil}
                  onChange={(e) => setNewCoupon({ ...newCoupon, validUntil: e.target.value })}
                  data-testid="input-valid-until"
                />
              </div>
            </div>
          </div>
          <DrawerFooter className="pt-4 border-t">
            <Button onClick={handleCreateCoupon} disabled={createMutation.isPending} className="w-full" data-testid="button-create-coupon">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Coupon
            </Button>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="w-full">Cancel</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Coupon?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.code}"? This will deactivate it in Stripe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-coupon"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
