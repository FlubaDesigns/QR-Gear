import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Gift, ArrowLeft, Search, Check, Package, Sparkles, Palette, Ruler, QrCode, Heart } from "lucide-react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

interface GiftDetails {
  giftCodeId: string;
  packageName: string;
  packageDescription: string;
  giftType: "product" | "dynamics";
  personalMessage?: string;
  buyerName?: string;
  expiresAt: string;
  allowColorChoice: boolean;
  allowSizeChoice: boolean;
  allowQrCustomization: boolean;
  product?: {
    id: string;
    title: string;
    imageUrl?: string;
    availableColors?: string[];
    availableSizes?: string[];
  };
  dynamicsTier?: string;
  dynamicsMonths?: number;
}

export default function GiftRedeemPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ code?: string }>();
  const { toast } = useToast();
  
  const [codeInput, setCodeInput] = useState(params.code || "");
  const [giftDetails, setGiftDetails] = useState<GiftDetails | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    recipientName: "",
    recipientEmail: "",
    selectedColor: "",
    selectedSize: "",
    qrContent: "",
    shippingAddress: "",
  });

  const lookupCode = async () => {
    if (!codeInput.trim()) {
      toast({ title: "Enter a code", description: "Please enter your gift code", variant: "destructive" });
      return;
    }
    
    setIsLookingUp(true);
    setLookupError("");
    
    try {
      const res = await fetch(`/api/gifts/redeem/${codeInput.trim().toUpperCase()}`);
      const data = await res.json();
      
      if (!res.ok) {
        setLookupError(data.error || "Invalid gift code");
        setGiftDetails(null);
      } else {
        setGiftDetails(data);
        setLookupError("");
      }
    } catch (error) {
      setLookupError("Failed to look up code. Please try again.");
      setGiftDetails(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const redeemMutation = useMutation({
    mutationFn: async () => {
      if (!giftDetails) throw new Error("No gift selected");
      const res = await apiRequest("POST", `/api/gifts/redeem/${codeInput.trim().toUpperCase()}`, {
        recipientName: formData.recipientName,
        recipientEmail: formData.recipientEmail,
        selectedColor: formData.selectedColor || undefined,
        selectedSize: formData.selectedSize || undefined,
        qrContent: formData.qrContent || undefined,
        shippingAddress: formData.shippingAddress || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setRedeemSuccess(true);
      toast({ title: "Gift Redeemed!", description: "Your gift is being processed." });
    },
    onError: (error: Error) => {
      toast({ title: "Redemption failed", description: error.message, variant: "destructive" });
    },
  });

  const handleRedeem = () => {
    if (!formData.recipientName || !formData.recipientEmail) {
      toast({ title: "Missing info", description: "Please fill in your name and email", variant: "destructive" });
      return;
    }
    if (giftDetails?.giftType === "product" && !formData.shippingAddress) {
      toast({ title: "Missing address", description: "Please enter your shipping address", variant: "destructive" });
      return;
    }
    redeemMutation.mutate();
  };

  if (redeemSuccess) {
    return (
      <div className="container max-w-lg py-12 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Gift Redeemed!</h1>
            <p className="text-muted-foreground mb-6">
              {giftDetails?.giftType === "product" 
                ? "Your personalized item is being created and will ship soon."
                : "Your QR Dynamics subscription is now active."}
            </p>
            <Button 
              className="h-12 px-6"
              onClick={() => navigate("/")}
              data-testid="button-go-home"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8 px-4">
      <BreadcrumbTrail />
      <Button
        variant="ghost"
        onClick={() => navigate("/gifts")}
        className="mb-6 h-12 px-4"
        data-testid="button-back-gifts"
      >
        <ArrowLeft className="mr-2 h-5 w-5" />
        Back to Gift Shop
      </Button>

      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <Gift className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold">Redeem Your Gift</h1>
        </div>
        <p className="text-muted-foreground">
          Enter your gift code to claim your personalized QR apparel.
        </p>
      </div>

      {/* Code Entry */}
      {!giftDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Enter Gift Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="GIFT-XXXX-XXXX-XXXX"
                className="h-12 font-mono text-lg tracking-wider flex-1"
                data-testid="input-gift-code"
              />
              <Button 
                onClick={lookupCode}
                disabled={isLookingUp}
                className="h-12 px-6"
                data-testid="button-lookup-code"
              >
                {isLookingUp ? "Looking..." : "Look Up"}
              </Button>
            </div>
            {lookupError && (
              <p className="text-destructive text-sm">{lookupError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gift Details & Redemption Form */}
      {giftDetails && (
        <div className="space-y-6">
          {/* Gift Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {giftDetails.giftType === "dynamics" ? (
                      <Sparkles className="h-5 w-5 text-primary" />
                    ) : (
                      <Package className="h-5 w-5 text-primary" />
                    )}
                    {giftDetails.packageName}
                  </CardTitle>
                  <CardDescription>{giftDetails.packageDescription}</CardDescription>
                </div>
              </div>
            </CardHeader>
            {giftDetails.personalMessage && (
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-primary">
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Heart className="h-4 w-4" />
                    Message from {giftDetails.buyerName || "your gift giver"}:
                  </div>
                  <p className="italic">"{giftDetails.personalMessage}"</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Redemption Form */}
          <Card>
            <CardHeader>
              <CardTitle>Claim Your Gift</CardTitle>
              <CardDescription>Fill in your details to receive your gift</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Your Name *</Label>
                  <Input
                    id="recipientName"
                    value={formData.recipientName}
                    onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                    placeholder="Your name"
                    className="h-12"
                    data-testid="input-recipient-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Your Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={formData.recipientEmail}
                    onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                    placeholder="your@email.com"
                    className="h-12"
                    data-testid="input-recipient-email"
                  />
                </div>
              </div>

              {/* Product Customization Options */}
              {giftDetails.giftType === "product" && (
                <>
                  {giftDetails.allowColorChoice && giftDetails.product?.availableColors && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Choose Color
                      </Label>
                      <Select
                        value={formData.selectedColor}
                        onValueChange={(v) => setFormData({ ...formData, selectedColor: v })}
                      >
                        <SelectTrigger className="h-12" data-testid="select-color">
                          <SelectValue placeholder="Select a color" />
                        </SelectTrigger>
                        <SelectContent>
                          {giftDetails.product.availableColors.map((color) => (
                            <SelectItem key={color} value={color} className="min-h-[48px]">
                              {color}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {giftDetails.allowSizeChoice && giftDetails.product?.availableSizes && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Choose Size
                      </Label>
                      <Select
                        value={formData.selectedSize}
                        onValueChange={(v) => setFormData({ ...formData, selectedSize: v })}
                      >
                        <SelectTrigger className="h-12" data-testid="select-size">
                          <SelectValue placeholder="Select a size" />
                        </SelectTrigger>
                        <SelectContent>
                          {giftDetails.product.availableSizes.map((size) => (
                            <SelectItem key={size} value={size} className="min-h-[48px]">
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {giftDetails.allowQrCustomization && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        QR Code Content
                      </Label>
                      <Input
                        value={formData.qrContent}
                        onChange={(e) => setFormData({ ...formData, qrContent: e.target.value })}
                        placeholder="https://your-website.com or custom text"
                        className="h-12"
                        data-testid="input-qr-content"
                      />
                      <p className="text-xs text-muted-foreground">Enter a URL or text for your QR code</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="shippingAddress">Shipping Address *</Label>
                    <Textarea
                      id="shippingAddress"
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                      placeholder="123 Main St&#10;City, State 12345&#10;Country"
                      rows={3}
                      data-testid="input-shipping-address"
                    />
                  </div>
                </>
              )}

              {/* Dynamics subscription info */}
              {giftDetails.giftType === "dynamics" && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="font-medium">QR Dynamics Subscription</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You'll receive {giftDetails.dynamicsMonths || 12} months of {giftDetails.dynamicsTier || "standard"} tier 
                    QR Dynamics, allowing you to change your QR code destination anytime.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setGiftDetails(null);
                  setCodeInput("");
                }}
                className="h-12 w-full sm:w-auto"
              >
                Use Different Code
              </Button>
              <Button
                onClick={handleRedeem}
                disabled={redeemMutation.isPending}
                className="h-12 w-full sm:flex-1"
                data-testid="button-redeem"
              >
                {redeemMutation.isPending ? "Processing..." : "Redeem Gift"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
