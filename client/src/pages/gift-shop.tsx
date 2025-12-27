import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Gift, Sparkles, Package, Clock, Heart, Check, Copy, ArrowLeft } from "lucide-react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import type { GiftPackage } from "@shared/schema";

export default function GiftShopPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<GiftPackage | null>(null);
  const [purchaseComplete, setPurchaseComplete] = useState<{ code: string; packageName: string; expiresAt: string } | null>(null);
  const [formData, setFormData] = useState({
    buyerName: "",
    buyerEmail: "",
    recipientEmail: "",
    personalMessage: "",
  });

  const { data: packages = [], isLoading } = useQuery<GiftPackage[]>({
    queryKey: ["/api/gifts/packages"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (data: {
      giftPackageId: string;
      buyerName: string;
      buyerEmail: string;
      recipientEmail?: string;
      personalMessage?: string;
    }) => {
      const res = await apiRequest("POST", "/api/gifts/purchase", data);
      return res.json();
    },
    onSuccess: (data) => {
      setPurchaseComplete({
        code: data.giftCode,
        packageName: data.packageName,
        expiresAt: data.expiresAt,
      });
      setSelectedPackage(null);
      setFormData({ buyerName: "", buyerEmail: "", recipientEmail: "", personalMessage: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Purchase failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePurchase = () => {
    if (!selectedPackage) return;
    if (!formData.buyerName || !formData.buyerEmail) {
      toast({ title: "Missing info", description: "Please fill in your name and email", variant: "destructive" });
      return;
    }
    purchaseMutation.mutate({
      giftPackageId: selectedPackage.id,
      buyerName: formData.buyerName,
      buyerEmail: formData.buyerEmail,
      recipientEmail: formData.recipientEmail || undefined,
      personalMessage: formData.personalMessage || undefined,
    });
  };

  const copyCode = () => {
    if (purchaseComplete?.code) {
      navigator.clipboard.writeText(purchaseComplete.code);
      toast({ title: "Copied!", description: "Gift code copied to clipboard" });
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">Loading gift options...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 px-4">
      <BreadcrumbTrail />
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-6 h-12 px-4"
        data-testid="button-back-home"
      >
        <ArrowLeft className="mr-2 h-5 w-5" />
        Back to Home
      </Button>

      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <Gift className="h-10 w-10 text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold">Gift Shop</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Give the gift of personalized QR apparel. Perfect for businesses, events, or anyone who loves unique tech-forward fashion.
        </p>
      </div>

      {packages.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No gift packages available at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card 
              key={pkg.id} 
              className="hover-elevate flex flex-col"
              data-testid={`card-gift-package-${pkg.id}`}
            >
              {pkg.displayImage && (
                <div className="aspect-video overflow-hidden rounded-t-lg">
                  <img 
                    src={pkg.displayImage} 
                    alt={pkg.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-xl">{pkg.name}</CardTitle>
                  <Badge variant={pkg.giftType === "dynamics" ? "default" : "secondary"}>
                    {pkg.giftType === "dynamics" ? (
                      <><Sparkles className="h-3 w-3 mr-1" /> Dynamics</>
                    ) : (
                      <><Package className="h-3 w-3 mr-1" /> Product</>
                    )}
                  </Badge>
                </div>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Valid for {pkg.redemptionValidDays || 365} days</span>
                  </div>
                  {pkg.includePersonalMessage && (
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      <span>Add a personal message</span>
                    </div>
                  )}
                  {pkg.allowColorChoice && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      <span>Recipient chooses color</span>
                    </div>
                  )}
                  {pkg.allowSizeChoice && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      <span>Recipient chooses size</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <div className="text-2xl font-bold text-center w-full">
                  ${parseFloat(pkg.price).toFixed(2)}
                </div>
                <Button 
                  className="w-full h-12"
                  onClick={() => setSelectedPackage(pkg)}
                  data-testid={`button-buy-gift-${pkg.id}`}
                >
                  <Gift className="mr-2 h-5 w-5" />
                  Buy This Gift
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Redeem Gift CTA */}
      <Card className="mt-12 max-w-lg mx-auto">
        <CardContent className="py-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Have a gift code?</h2>
          <p className="text-muted-foreground mb-4">Redeem your gift and customize your QR apparel.</p>
          <Button 
            variant="outline" 
            className="h-12 px-6"
            onClick={() => navigate("/gift/redeem")}
            data-testid="button-go-redeem"
          >
            Redeem a Gift
          </Button>
        </CardContent>
      </Card>

      {/* Purchase Dialog */}
      <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Purchase Gift
            </DialogTitle>
            <DialogDescription>
              {selectedPackage?.name} - ${selectedPackage ? parseFloat(selectedPackage.price).toFixed(2) : "0.00"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="buyerName">Your Name *</Label>
              <Input
                id="buyerName"
                value={formData.buyerName}
                onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
                placeholder="Your name"
                className="h-12"
                data-testid="input-buyer-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyerEmail">Your Email *</Label>
              <Input
                id="buyerEmail"
                type="email"
                value={formData.buyerEmail}
                onChange={(e) => setFormData({ ...formData, buyerEmail: e.target.value })}
                placeholder="your@email.com"
                className="h-12"
                data-testid="input-buyer-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Recipient Email (optional)</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={formData.recipientEmail}
                onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                placeholder="gift@recipient.com"
                className="h-12"
                data-testid="input-recipient-email"
              />
              <p className="text-xs text-muted-foreground">We'll send them the gift code</p>
            </div>
            {selectedPackage?.includePersonalMessage && (
              <div className="space-y-2">
                <Label htmlFor="personalMessage">Personal Message</Label>
                <Textarea
                  id="personalMessage"
                  value={formData.personalMessage}
                  onChange={(e) => setFormData({ ...formData, personalMessage: e.target.value })}
                  placeholder="Write a heartfelt message..."
                  rows={3}
                  data-testid="input-personal-message"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSelectedPackage(null)}
              className="h-12"
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePurchase}
              disabled={purchaseMutation.isPending}
              className="h-12"
              data-testid="button-confirm-purchase"
            >
              {purchaseMutation.isPending ? "Processing..." : "Complete Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={!!purchaseComplete} onOpenChange={() => setPurchaseComplete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Gift Purchased!
            </DialogTitle>
            <DialogDescription>
              Your gift for "{purchaseComplete?.packageName}" is ready.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Gift Code</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-xl md:text-2xl font-mono font-bold tracking-wider">
                  {purchaseComplete?.code}
                </code>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={copyCode}
                  className="h-10 w-10"
                  data-testid="button-copy-code"
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Valid until {purchaseComplete?.expiresAt ? new Date(purchaseComplete.expiresAt).toLocaleDateString() : ""}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => setPurchaseComplete(null)}
              className="h-12 w-full sm:w-auto"
            >
              Buy Another
            </Button>
            <Button 
              onClick={() => {
                setPurchaseComplete(null);
                navigate("/");
              }}
              className="h-12 w-full sm:w-auto"
              data-testid="button-done"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
