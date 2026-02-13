import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowLeft,
  Tag,
  Plus,
  Percent,
  DollarSign,
  Calendar,
  Users,
  MoreVertical,
  Check,
  X,
} from "lucide-react";
import type { Coupon } from "@shared/schema";

function CouponForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    discountType: "percent",
    discountValue: "",
    minOrderAmount: "",
    maxRedemptions: "",
    validFrom: "",
    validUntil: "",
    isActive: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      minOrderAmount: formData.minOrderAmount || null,
      maxRedemptions: formData.maxRedemptions ? parseInt(formData.maxRedemptions) : null,
      validFrom: formData.validFrom || null,
      validUntil: formData.validUntil || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">Promo Code</Label>
          <Input
            id="code"
            placeholder="SUMMER20"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            required
            className="h-12"
            data-testid="input-coupon-code"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Internal Name</Label>
          <Input
            id="name"
            placeholder="Summer Sale 20%"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="h-12"
            data-testid="input-coupon-name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Discount Type</Label>
          <Select
            value={formData.discountType}
            onValueChange={(v) => setFormData({ ...formData, discountType: v })}
          >
            <SelectTrigger className="h-12" data-testid="select-discount-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="discountValue">
            {formData.discountType === "percent" ? "Discount %" : "Discount $"}
          </Label>
          <Input
            id="discountValue"
            type="number"
            placeholder={formData.discountType === "percent" ? "20" : "5.00"}
            value={formData.discountValue}
            onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
            required
            className="h-12"
            data-testid="input-discount-value"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minOrderAmount">Min Order Amount (optional)</Label>
          <Input
            id="minOrderAmount"
            type="number"
            step="0.01"
            placeholder="25.00"
            value={formData.minOrderAmount}
            onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
            className="h-12"
            data-testid="input-min-order"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxRedemptions">Max Uses (optional)</Label>
          <Input
            id="maxRedemptions"
            type="number"
            placeholder="100"
            value={formData.maxRedemptions}
            onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
            className="h-12"
            data-testid="input-max-uses"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="validFrom">Valid From (optional)</Label>
          <Input
            id="validFrom"
            type="date"
            value={formData.validFrom}
            onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
            className="h-12"
            data-testid="input-valid-from"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="validUntil">Valid Until (optional)</Label>
          <Input
            id="validUntil"
            type="date"
            value={formData.validUntil}
            onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
            className="h-12"
            data-testid="input-valid-until"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          data-testid="switch-is-active"
        />
        <Label htmlFor="isActive" className="cursor-pointer">
          Active (customers can use this code)
        </Label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-12"
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 h-12"
          data-testid="button-create-coupon"
        >
          {isPending ? "Creating..." : "Create Coupon"}
        </Button>
      </div>
    </form>
  );
}

function CouponCard({
  coupon,
  onToggle,
}: {
  coupon: Coupon;
  onToggle: (id: string, isActive: boolean) => void;
}) {
  const isExpired = coupon.validUntil && new Date(coupon.validUntil) < new Date();
  const isMaxed = coupon.maxRedemptions && (coupon.redemptionCount || 0) >= coupon.maxRedemptions;

  return (
    <Card className={`${!coupon.isActive || isExpired || isMaxed ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-lg font-bold bg-muted px-2 py-1 rounded" data-testid={`text-coupon-code-${coupon.id}`}>
                {coupon.code}
              </code>
              {coupon.isActive && !isExpired && !isMaxed && (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  Active
                </Badge>
              )}
              {isExpired && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                  Expired
                </Badge>
              )}
              {isMaxed && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  Maxed Out
                </Badge>
              )}
              {!coupon.isActive && !isExpired && !isMaxed && (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Disabled
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{coupon.name}</p>

            <div className="flex items-center gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1">
                {coupon.discountType === "percent" ? (
                  <Percent className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {coupon.discountType === "percent"
                    ? `${coupon.discountValue}% off`
                    : `$${coupon.discountValue} off`}
                </span>
              </div>

              {coupon.minOrderAmount && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span>Min: ${coupon.minOrderAmount}</span>
                </div>
              )}

              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>
                  {coupon.redemptionCount || 0}
                  {coupon.maxRedemptions ? `/${coupon.maxRedemptions}` : ""} used
                </span>
              </div>
            </div>

            {(coupon.validFrom || coupon.validUntil) && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>
                  {coupon.validFrom && `From ${new Date(coupon.validFrom).toLocaleDateString()}`}
                  {coupon.validFrom && coupon.validUntil && " - "}
                  {coupon.validUntil && `Until ${new Date(coupon.validUntil).toLocaleDateString()}`}
                </span>
              </div>
            )}
          </div>

          <Switch
            checked={coupon.isActive ?? false}
            onCheckedChange={(checked) => onToggle(coupon.id, checked)}
            data-testid={`switch-coupon-active-${coupon.id}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminCoupons() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/coupons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setIsFormOpen(false);
      toast({ title: "Promo code created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create promo code", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PUT", `/api/admin/coupons/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Promo code updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update promo code", description: error.message, variant: "destructive" });
    },
  });

  const handleToggle = (id: string, isActive: boolean) => {
    toggleMutation.mutate({ id, isActive });
  };

  const FormWrapper = isMobile ? Drawer : Dialog;
  const FormContent = isMobile ? DrawerContent : DialogContent;
  const FormHeader = isMobile ? DrawerHeader : DialogHeader;
  const FormTitle = isMobile ? DrawerTitle : DialogTitle;
  const FormTrigger = isMobile ? DrawerTrigger : DialogTrigger;

  return (
    <div className="qr-admin-page">
      <BreadcrumbTrail />
      <div className="qr-admin-bar">
        <div className="qr-admin-bar__inner">
          <div className="qr-admin-bar__left">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
              className="text-white hover:bg-white/10 qr-touch-48"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Tag className="qr-admin-bar__icon" />
            <div>
              <h1 className="qr-admin-bar__title" data-testid="text-page-title">
                Promo Codes
              </h1>
              <p className="qr-admin-bar__subtitle">
                Manage discount codes
              </p>
            </div>
          </div>
          <div className="qr-admin-bar__right">
            <FormWrapper open={isFormOpen} onOpenChange={setIsFormOpen}>
              <FormTrigger asChild>
                <Button className="qr-touch-48" data-testid="button-add-coupon">
                  <Plus className="h-5 w-5 mr-2" />
                  Add Code
                </Button>
              </FormTrigger>
              <FormContent className={isMobile ? "" : "max-w-lg"}>
                <FormHeader>
                  <FormTitle>Create Promo Code</FormTitle>
                </FormHeader>
                <CouponForm
                  onSubmit={(data) => createMutation.mutate(data)}
                  onCancel={() => setIsFormOpen(false)}
                  isPending={createMutation.isPending}
                />
              </FormContent>
            </FormWrapper>
          </div>
        </div>
      </div>

      <main className="qr-admin-main">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-64 mt-3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : coupons && coupons.length > 0 ? (
          <div className="space-y-3">
            {coupons.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} onToggle={handleToggle} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No promo codes yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first promo code to offer discounts to customers
              </p>
              <Button onClick={() => setIsFormOpen(true)} data-testid="button-create-first">
                <Plus className="h-4 w-4 mr-2" />
                Create Promo Code
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
