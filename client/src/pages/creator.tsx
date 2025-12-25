import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useGuestCart";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navbar from "@/components/Navbar";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import SEO from "@/components/SEO";
import UsaFlag from "@/components/UsaFlag";
import { Upload, ImageIcon, Loader2, Palette, LayoutTemplate, Check, RefreshCw, Share2, Copy, Facebook, Twitter, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImageDesigner from "@/components/ImageDesigner";
import ProductMockup from "@/components/ProductMockup";
import type { Product, QrTemplate, HostingTier } from "@shared/schema";

const placementLabels: Record<string, string> = {
  "front": "Front",
  "back": "Back",
  "front-chest": "Front Chest",
  "front-pocket": "Front Pocket",
  "front-center": "Front Center",
  "back-center": "Back Center",
  "left": "Left Side",
  "right": "Right Side",
  "side": "Side",
  "side-left": "Left Side",
  "side-right": "Right Side",
  "left-shoulder": "Left Shoulder",
  "right-shoulder": "Right Shoulder",
  "left-sleeve": "Left Sleeve",
  "right-sleeve": "Right Sleeve",
  "sleeve_left": "Left Sleeve",
  "sleeve_right": "Right Sleeve",
  "pocket": "Pocket",
  "center": "Center",
  "wraparound": "Wraparound",
  "front_large": "Front (Large)",
  "front_small": "Front (Small)",
};

function formatPlacementLabel(position: string): string {
  if (placementLabels[position]) return placementLabels[position];
  return position
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const standardSizes = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "2XL", label: "2XL" },
  { value: "3XL", label: "3XL" },
];

const mugSizes = [
  { value: "11oz", label: "11 oz" },
  { value: "15oz", label: "15 oz" },
];

const hatSizes = [
  { value: "One Size", label: "One Size" },
];

const bagSizes = [
  { value: "Standard", label: "Standard" },
];

interface PriceQuote {
  productLine: string;
  basePrice: number;
  finalPrice: number;
  breakdown: {
    base: number;
    qrProduction: number;
    markup: number;
    textAboveUpcharge: number;
    textBelowUpcharge: number;
    templateUpcharge: number;
    hostingUpcharge: number;
    dynamicUpcharge: number;
  };
  hostingTier: string;
}

export default function Creator() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { addItem: addGuestItem } = useGuestCart();
  const [qrType, setQrType] = useState<"text" | "image" | "upload" | "design" | "template" | "dynamic">("text");
  const [qrContent, setQrContent] = useState("");
  const [kcBusinessSlug, setKcBusinessSlug] = useState<string | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get("slug");
    if (slug) {
      setKcBusinessSlug(slug);
      const kcBusinessUrl = `https://kingdomconnects.org/business/${slug}.htm`;
      setQrContent(kcBusinessUrl);
    }
  }, []);
  const [qrColor, setQrColor] = useState("#000000");
  const [qrBgColor, setQrBgColor] = useState("#FFFFFF");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [placement, setPlacement] = useState("front-chest");
  const [productColor, setProductColor] = useState("");
  const [textAbove, setTextAbove] = useState("");
  const [textBelow, setTextBelow] = useState("");
  const [uploadedImage, setUploadedImage] = useState<{ id: string; url: string; preview: string } | null>(null);
  const [isVideoContent, setIsVideoContent] = useState(false);
  const [imageTitle, setImageTitle] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<QrTemplate | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [selectedHostingTier, setSelectedHostingTier] = useState<string>("1_year");
  const [overlayText, setOverlayText] = useState("");
  const [overlayFontFamily, setOverlayFontFamily] = useState("Inter");
  const [overlayFontColor, setOverlayFontColor] = useState("#FFFFFF");
  const [dynamicPageTitle, setDynamicPageTitle] = useState("");
  const [dynamicPageDescription, setDynamicPageDescription] = useState("");
  const [dynamicHostingTier, setDynamicHostingTier] = useState<string>("1_year");
  const [selectedSize, setSelectedSize] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [contentRightsConfirmed, setContentRightsConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track if we need to regenerate after current mutation completes
  const pendingRegenRef = useRef(false);
  const lastGeneratedRef = useRef({ content: "", type: "", color: "", bgColor: "" });

  const { data: products = [], isLoading: productsLoading, isError: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<QrTemplate[]>({
    queryKey: ["/api/templates"],
    enabled: qrType === "template",
  });

  const { data: hostingTiers = [] } = useQuery<HostingTier[]>({
    queryKey: ["/api/hosting-tiers"],
    enabled: qrType === "upload" || qrType === "dynamic",
  });

  const filteredTemplates = templateCategory === "all" 
    ? templates.filter(t => t.isActive)
    : templates.filter(t => t.isActive && t.category === templateCategory);

  const templateCategories = ["all", ...Array.from(new Set(templates.filter(t => t.isActive).map(t => t.category).filter(Boolean)))];

  const [pricingError, setPricingError] = useState(false);

  const pricingMutation = useMutation({
    mutationFn: async (data: { 
      productId: string; 
      productLine: string; 
      hasTextAbove: boolean; 
      hasTextBelow: boolean;
      hostingTierCode?: string;
      templateId?: string;
    }) => {
      const response = await apiRequest("POST", "/api/pricing/quote", data);
      return await response.json();
    },
    onSuccess: (data: PriceQuote) => {
      setPriceQuote(data);
      setPricingError(false);
    },
    onError: () => {
      setPriceQuote(null);
      setPricingError(true);
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      quantity: number;
      customization: {
        qrContent: string;
        qrType: string;
        qrColor: string;
        qrBgColor: string;
        placement: string;
        productColor: string;
        textAbove?: string;
        textBelow?: string;
        hostingTier?: string;
        templateId?: string;
        templateName?: string;
        overlayText?: string;
        overlayFontFamily?: string;
        overlayFontColor?: string;
        uploadedImageId?: string;
        dynamicPageTitle?: string;
        dynamicPageDescription?: string;
        dynamicHostingTier?: string;
      };
      price: string;
    }) => {
      const response = await apiRequest("POST", "/api/cart", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to cart",
        description: "Your custom QR product has been added to your cart",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add to cart. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const isVideo = file.type.startsWith("video/");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetType", isVideo ? "video" : "background");
      formData.append("name", imageTitle || file.name);
      
      const response = await fetch("/api/library/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      const asset = await response.json();
      return {
        id: asset.id,
        publicUrl: asset.publicUrl,
        landingUrl: `/i/${asset.id}`,
        mediaType: asset.mediaType,
      };
    },
    onSuccess: (data) => {
      const isVideo = data.mediaType === "video";
      const fullUrl = `${window.location.origin}${data.landingUrl}`;
      setUploadedImage({
        id: data.id,
        url: fullUrl,
        preview: data.publicUrl,
      });
      setIsVideoContent(isVideo);
      setQrContent(fullUrl);
      toast({
        title: isVideo ? "Video uploaded" : "Image uploaded",
        description: `Your ${isVideo ? "video" : "image"} is now hosted and ready for QR code generation`,
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for video, 10MB for image
      
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: isVideo ? "Please select a video under 100MB" : "Please select an image under 10MB",
          variant: "destructive",
        });
        return;
      }
      
      const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const validVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];
      
      if (!validImageTypes.includes(file.type) && !validVideoTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM, MOV)",
          variant: "destructive",
        });
        return;
      }
      
      setIsVideoContent(isVideo);
      uploadImageMutation.mutate(file);
    }
  };

  const uploadDesignMutation = useMutation({
    mutationFn: async (imageDataUrl: string) => {
      const base64 = imageDataUrl.split(",")[1];
      const response = await apiRequest("POST", "/api/images/upload", {
        imageData: base64,
        originalName: "custom-design.png",
        mimeType: "image/png",
        title: "Custom Design",
        description: "Created with QR Gear Designer",
      });
      return response.json();
    },
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}${data.landingUrl}`;
      setUploadedImage({
        id: data.id,
        url: fullUrl,
        preview: data.publicUrl,
      });
      setQrContent(fullUrl);
      toast({
        title: "Design saved",
        description: "Your custom design is ready for QR code generation",
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Failed to save design. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDesignReady = (imageDataUrl: string) => {
    uploadDesignMutation.mutate(imageDataUrl);
  };

  const generateQRMutation = useMutation({
    mutationFn: async (data: { content: string; type: string; style: any }) => {
      const response = await apiRequest("POST", "/api/qr/generate", data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      // Only update QR image if current state matches what we just generated
      // This prevents stale QR codes from appearing if user changed inputs during generation
      const currentMatchesGenerated = 
        lastGeneratedRef.current.content === qrContent &&
        lastGeneratedRef.current.type === qrType &&
        lastGeneratedRef.current.color === qrColor &&
        lastGeneratedRef.current.bgColor === qrBgColor;
      
      if (currentMatchesGenerated && qrContent.trim()) {
        setQrCodeImage(data.qrCode);
      }
      
      // If inputs changed while we were generating, trigger another generation
      if (pendingRegenRef.current) {
        pendingRegenRef.current = false;
        handleGenerateQR();
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
      
      // If there was a pending regeneration, try it after clearing error state
      const hadPendingRegen = pendingRegenRef.current;
      
      // Clear flags and state to allow retries
      pendingRegenRef.current = false;
      lastGeneratedRef.current = { content: "", type: "", color: "", bgColor: "" };
      
      // If inputs changed while the failed request was pending, retry with latest state
      if (hadPendingRegen) {
        handleGenerateQR();
      }
    },
  });

  const isValidURL = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  const handleGenerateQR = () => {
    if (!qrContent.trim()) {
      return;
    }

    // For image, upload, design, and template types, validate URL before generating
    if ((qrType === "image" || qrType === "upload" || qrType === "design" || qrType === "template") && !isValidURL(qrContent)) {
      return;
    }

    const currentState = {
      content: qrContent,
      type: qrType,
      color: qrColor,
      bgColor: qrBgColor,
    };

    // Check if this is the same as what we last generated
    const isSameAsLast = 
      lastGeneratedRef.current.content === currentState.content &&
      lastGeneratedRef.current.type === currentState.type &&
      lastGeneratedRef.current.color === currentState.color &&
      lastGeneratedRef.current.bgColor === currentState.bgColor;

    if (isSameAsLast) {
      return; // Already generated this exact QR code
    }

    // If already pending, mark that we need to regenerate
    if (generateQRMutation.isPending) {
      pendingRegenRef.current = true;
      return;
    }

    // Update last generated state
    lastGeneratedRef.current = currentState;

    generateQRMutation.mutate({
      content: qrContent,
      type: (qrType === "upload" || qrType === "design" || qrType === "template" || qrType === "dynamic") ? "image" : qrType,
      style: {
        color: qrColor,
        backgroundColor: qrBgColor,
      },
    });
  };

  useEffect(() => {
    if (qrContent) {
      const debounce = setTimeout(() => {
        handleGenerateQR();
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      // Clear QR and reset generation state when content is empty
      setQrCodeImage("");
      lastGeneratedRef.current = { content: "", type: "", color: "", bgColor: "" };
      pendingRegenRef.current = false;
    }
  }, [qrContent, qrColor, qrBgColor, qrType]);

  const availablePlacements = selectedProduct?.availablePlacements || [];
  const availableColors = (selectedProduct?.availableColors as any[]) || [];

  const getAvailableSizes = () => {
    if (!selectedProduct) return [];
    const productName = selectedProduct.name.toLowerCase();
    if (productName.includes("mug")) return mugSizes;
    if (productName.includes("hat") || productName.includes("cap")) return hatSizes;
    if (productName.includes("bag") || productName.includes("tote")) return bagSizes;
    return standardSizes;
  };
  const availableSizes = getAvailableSizes();

  useEffect(() => {
    if (selectedProduct && availableSizes.length > 0 && !selectedSize) {
      const mediumSize = availableSizes.find(s => s.value === "M" || s.value === "L");
      setSelectedSize(mediumSize?.value || availableSizes[0].value);
    }
  }, [selectedProduct?.id]);

  const hasTextAbove = textAbove.trim().length > 0;
  const hasTextBelow = textBelow.trim().length > 0;

  const handleShare = async () => {
    const shareData = {
      title: selectedProduct ? `My custom ${selectedProduct.name} design` : 'My QR Gear Design',
      text: `Check out this custom QR code product I'm designing!${textAbove ? ` "${textAbove}"` : ''}${textBelow ? ` "${textBelow}"` : ''}`,
      url: window.location.href,
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({ title: "Shared successfully!" });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setShareDialogOpen(true);
        }
      }
    } else {
      setShareDialogOpen(true);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied to clipboard!" });
      setShareDialogOpen(false);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
    setShareDialogOpen(false);
  };

  const shareToTwitter = () => {
    const text = `Check out this custom QR code product I'm designing!`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, '_blank');
    setShareDialogOpen(false);
  };

  const shareByEmail = () => {
    const subject = selectedProduct ? `My custom ${selectedProduct.name} design` : 'My QR Gear Design';
    const body = `Check out this custom QR code product I'm designing!\n\n${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShareDialogOpen(false);
  };

  useEffect(() => {
    if (selectedProduct) {
      let productLine = "text";
      let hostingTierCode: string | undefined;
      let templateId: string | undefined;
      
      if (qrType === "upload" || qrType === "design") {
        productLine = "custom";
        hostingTierCode = selectedHostingTier;
      } else if (qrType === "template" && selectedTemplate) {
        productLine = "template";
        templateId = selectedTemplate.id;
      } else if (qrType === "dynamic") {
        productLine = "dynamic";
        hostingTierCode = dynamicHostingTier;
      }
      
      const debounce = setTimeout(() => {
        pricingMutation.mutate({
          productId: selectedProduct.id,
          productLine,
          hasTextAbove,
          hasTextBelow,
          hostingTierCode,
          templateId,
        });
      }, 300);
      return () => clearTimeout(debounce);
    } else {
      setPriceQuote(null);
      setPricingError(false);
    }
  }, [selectedProduct?.id, hasTextAbove, hasTextBelow, qrType, selectedTemplate?.id, selectedHostingTier, dynamicHostingTier]);

  const totalPrice = priceQuote?.finalPrice.toFixed(2) || "0.00";

  const handleAddToCart = () => {
    if (!selectedProduct || !priceQuote) return;
    if (qrType === "template" && !selectedTemplate) return;
    if (qrType === "dynamic" && !dynamicPageTitle.trim()) return;
    if (qrType !== "dynamic" && !qrCodeImage) return;
    
    const cartData = {
      productId: selectedProduct.id,
      quantity: 1,
      customization: {
        qrContent: qrType === "dynamic" ? `pending-dynamic-${Date.now()}` : qrContent,
        qrType: qrType === "template" ? "template" : (qrType === "upload" || qrType === "design") ? "image" : qrType,
        qrColor,
        qrBgColor,
        placement,
        productColor,
        productSize: selectedSize,
        productName: selectedProduct.name,
        productImage: selectedProduct.imageUrl,
        textAbove: hasTextAbove && qrType !== "dynamic" ? textAbove : undefined,
        textBelow: hasTextBelow && qrType !== "dynamic" ? textBelow : undefined,
        hostingTier: (qrType === "upload" || qrType === "design") ? selectedHostingTier : undefined,
        templateId: qrType === "template" ? selectedTemplate?.id : undefined,
        templateName: qrType === "template" ? selectedTemplate?.name : undefined,
        overlayText: qrType === "upload" && overlayText ? overlayText : undefined,
        overlayFontFamily: qrType === "upload" && overlayText ? overlayFontFamily : undefined,
        overlayFontColor: qrType === "upload" && overlayText ? overlayFontColor : undefined,
        uploadedImageId: qrType === "upload" && uploadedImage ? uploadedImage.id : undefined,
        dynamicPageTitle: qrType === "dynamic" ? dynamicPageTitle : undefined,
        dynamicPageDescription: qrType === "dynamic" ? dynamicPageDescription : undefined,
        dynamicHostingTier: qrType === "dynamic" ? dynamicHostingTier : undefined,
      },
      price: priceQuote.finalPrice.toFixed(2),
    };

    if (isAuthenticated) {
      addToCartMutation.mutate(cartData);
    } else {
      addGuestItem(cartData);
      toast({
        title: "Added to cart",
        description: "Your custom QR product has been added to your cart",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="QR Code Creator | Design Your Custom QR Products | QR Gear"
        description="Design your custom QR code merchandise. Add text, upload images, or create QR Dynamics - living QR codes you can update anytime. USA-made products."
        keywords="QR code creator, custom QR design, QR merchandise designer, QR Dynamics, living QR codes, dynamic QR products"
      />
      <Navbar />
      <PageBreadcrumb currentPage="Create" />
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
        <h1 className="font-heading text-2xl sm:text-4xl font-bold mb-2">QR Code Creator</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
          Design your custom QR code product in three easy steps
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Step 1: Product Selection - MOVED TO TOP */}
            <Card>
              <CardHeader>
                <CardTitle>1. Choose Your Product</CardTitle>
                <CardDescription>Select the item to print on</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {productsLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading products...
                  </div>
                )}
                
                {productsError && (
                  <div className="text-center py-8 text-destructive">
                    Failed to load products. Please try refreshing the page.
                  </div>
                )}
                
                {!productsLoading && !productsError && (
                  <div className="grid grid-cols-2 gap-3">
                    {products.map((product) => (
                    <Card
                      key={product.id}
                      className={`cursor-pointer hover-elevate transition-all ${
                        selectedProduct?.id === product.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => {
                        setSelectedProduct(product);
                        setProductColor("");
                      }}
                      data-testid={`card-product-${product.id}`}
                    >
                      <CardContent className="p-2 sm:p-3">
                        <div className="aspect-square bg-muted rounded-md mb-2 overflow-hidden relative">
                          <img
                            src={product.imageUrl || ""}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = "/assets/generated_images/Product_mockup_white_tee_de332d78.png";
                            }}
                          />
                          {product.madeInUSA && (
                            <Badge className="absolute top-1 right-1 text-xs gap-1">
                              <UsaFlag className="w-3 h-2" />
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-semibold truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">${product.basePrice}</p>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: QR Code Content - MOVED DOWN */}
            <Card>
              <CardHeader>
                <CardTitle>2. Create Your QR Code</CardTitle>
                <CardDescription>Enter your message or image URL</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={qrType} onValueChange={(v) => {
                  setQrType(v as "text" | "image" | "upload" | "design" | "template" | "dynamic");
                  if (v === "upload" || v === "design" || v === "dynamic") {
                    setQrContent("");
                    setUploadedImage(null);
                    setIsVideoContent(false);
                  } else if (v === "text") {
                    setQrContent("");
                    setUploadedImage(null);
                    setIsVideoContent(false);
                  }
                  if (v !== "template") {
                    setSelectedTemplate(null);
                  }
                }}>
                  <TabsList className="flex w-full overflow-x-auto gap-1 pb-1">
                    <TabsTrigger value="text" data-testid="tab-qr-text" className="flex-shrink-0 px-3">
                      Text
                    </TabsTrigger>
                    <TabsTrigger value="template" data-testid="tab-qr-template" className="flex-shrink-0 px-3 flex items-center gap-1">
                      <LayoutTemplate className="w-3 h-3" />
                      Gift
                    </TabsTrigger>
                    <TabsTrigger value="image" data-testid="tab-qr-image" className="flex-shrink-0 px-3">
                      URL
                    </TabsTrigger>
                    <TabsTrigger value="upload" data-testid="tab-qr-upload" className="flex-shrink-0 px-3 flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="design" data-testid="tab-qr-design" className="flex-shrink-0 px-3 flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      Design
                    </TabsTrigger>
                    <TabsTrigger value="dynamic" data-testid="tab-qr-dynamic" className="flex-shrink-0 px-3 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      QR Dynamics™
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="text" className="space-y-4">
                    <div>
                      {kcBusinessSlug && (
                        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-md">
                          <p className="text-sm font-medium text-primary">Kingdom Connects Business Promo</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Your QR code will link to your Kingdom Connects business page. Customers can scan it to find you!
                          </p>
                        </div>
                      )}
                      <Label htmlFor="qr-text">Your Message</Label>
                      <Textarea
                        id="qr-text"
                        placeholder={kcBusinessSlug ? "Your Kingdom Connects business URL is pre-filled..." : "I love QR Gear! Or any message you want..."}
                        value={qrContent}
                        onChange={(e) => setQrContent(e.target.value)}
                        rows={4}
                        data-testid="textarea-qr-content"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {kcBusinessSlug ? "This QR links to your KC business listing" : "Works offline - message embedded in QR code"}
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="template" className="space-y-4">
                    <div>
                      <Label>Pre-designed Gift Background</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Choose a curated background - your QR code will be placed on it
                      </p>
                      
                      {templateCategories.length > 1 && (
                        <div className="flex gap-2 mb-4 flex-wrap">
                          {templateCategories.map((cat) => (
                            <Button
                              key={cat}
                              size="sm"
                              variant={templateCategory === cat ? "default" : "outline"}
                              onClick={() => setTemplateCategory(cat as string)}
                              data-testid={`button-category-${cat}`}
                            >
                              {cat === "all" ? "All" : (cat as string).charAt(0).toUpperCase() + (cat as string).slice(1)}
                            </Button>
                          ))}
                        </div>
                      )}
                      
                      {templatesLoading ? (
                        <div className="text-center py-8">
                          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredTemplates.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No templates available yet.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                          {filteredTemplates.map((template) => (
                            <div
                              key={template.id}
                              className={`relative cursor-pointer rounded-md overflow-hidden border-2 transition-all hover-elevate ${
                                selectedTemplate?.id === template.id 
                                  ? "border-primary ring-2 ring-primary/30" 
                                  : "border-transparent"
                              }`}
                              onClick={() => setSelectedTemplate(template)}
                              data-testid={`template-${template.id}`}
                            >
                              <div className="aspect-square">
                                <img
                                  src={template.thumbnailUrl}
                                  alt={template.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {selectedTemplate?.id === template.id && (
                                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                              {template.isFeatured && (
                                <Badge className="absolute top-1 left-1 text-xs">Featured</Badge>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                <p className="text-white text-xs font-medium truncate">{template.name}</p>
                                {parseFloat(template.priceUpcharge || "0") > 0 && (
                                  <p className="text-white/80 text-xs">+${template.priceUpcharge}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {selectedTemplate && (
                        <div className="mt-4 p-3 bg-muted rounded-md">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{selectedTemplate.name}</p>
                              {selectedTemplate.description && (
                                <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                              )}
                            </div>
                            {parseFloat(selectedTemplate.priceUpcharge || "0") > 0 && (
                              <Badge variant="outline">+${selectedTemplate.priceUpcharge}</Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {selectedTemplate && (
                      <div>
                        <Label htmlFor="template-qr-url">QR Code Link</Label>
                        <Input
                          id="template-qr-url"
                          type="url"
                          placeholder="https://your-website.com"
                          value={qrContent}
                          onChange={(e) => setQrContent(e.target.value)}
                          className={qrContent && !isValidURL(qrContent) ? "border-destructive" : ""}
                          data-testid="input-template-qr-url"
                        />
                        {qrContent && !isValidURL(qrContent) ? (
                          <p className="text-xs text-destructive mt-1">
                            Please enter a valid URL (e.g., https://example.com)
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter the URL your QR code should link to
                          </p>
                        )}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="image" className="space-y-4">
                    <div>
                      <Label htmlFor="qr-image-url">Image URL</Label>
                      <Input
                        id="qr-image-url"
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={qrContent}
                        onChange={(e) => setQrContent(e.target.value)}
                        data-testid="input-image-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Requires internet - displays image when scanned
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="upload" className="space-y-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                    
                    {!uploadedImage ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="image-title">Image Title (Optional)</Label>
                          <Input
                            id="image-title"
                            placeholder="My Business Card"
                            value={imageTitle}
                            onChange={(e) => setImageTitle(e.target.value)}
                            data-testid="input-image-title"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="image-description">Description (Optional)</Label>
                          <Textarea
                            id="image-description"
                            placeholder="A brief description of the image..."
                            value={imageDescription}
                            onChange={(e) => setImageDescription(e.target.value)}
                            rows={2}
                            data-testid="textarea-image-description"
                          />
                        </div>
                        <div className="flex items-start gap-3 p-3 border rounded-md bg-muted/30">
                          <Checkbox
                            id="content-rights"
                            checked={contentRightsConfirmed}
                            onCheckedChange={(checked) => setContentRightsConfirmed(checked === true)}
                            className="mt-0.5"
                            data-testid="checkbox-content-rights"
                          />
                          <Label 
                            htmlFor="content-rights" 
                            className="text-sm leading-relaxed cursor-pointer"
                          >
                            I confirm that I own this content or have the legal right to use it. 
                            I understand that QR Gear is not responsible for any copyright or intellectual property issues.
                          </Label>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full h-24 border-dashed"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadImageMutation.isPending || !contentRightsConfirmed}
                          data-testid="button-upload-image"
                        >
                          {uploadImageMutation.isPending ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <ImageIcon className="w-8 h-8 text-muted-foreground" />
                              <span className="text-muted-foreground">Click to upload image</span>
                              <span className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP up to 10MB</span>
                            </div>
                          )}
                        </Button>
                        {!contentRightsConfirmed && (
                          <p className="text-xs text-muted-foreground text-center">
                            Please confirm content ownership above to enable upload
                          </p>
                        )}
                        <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md">
                          <Badge variant="outline" className="text-xs">Included</Badge>
                          <span className="text-sm">1-year image hosting included in price</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                          <ImageIcon className="w-8 h-8 text-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">Image uploaded successfully</p>
                            <p className="text-xs text-muted-foreground truncate">{uploadedImage.url}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUploadedImage(null);
                              setIsVideoContent(false);
                              setQrContent("");
                              setQrCodeImage("");
                              setOverlayText("");
                              setContentRightsConfirmed(false);
                            }}
                            data-testid="button-remove-upload"
                          >
                            Remove
                          </Button>
                        </div>

                        <div className="space-y-3 p-3 border rounded-md">
                          <h4 className="text-sm font-medium">Text Overlay (Optional)</h4>
                          <div className="space-y-2">
                            <Label htmlFor="overlay-text">Text</Label>
                            <Input
                              id="overlay-text"
                              placeholder="Your Company Name"
                              value={overlayText}
                              onChange={(e) => setOverlayText(e.target.value)}
                              maxLength={50}
                              data-testid="input-overlay-text"
                            />
                            <p className="text-xs text-muted-foreground">{overlayText.length}/50 characters</p>
                          </div>
                          
                          {overlayText && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="overlay-font">Font</Label>
                                <Select value={overlayFontFamily} onValueChange={setOverlayFontFamily}>
                                  <SelectTrigger data-testid="select-overlay-font">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Inter">Inter</SelectItem>
                                    <SelectItem value="Arial">Arial</SelectItem>
                                    <SelectItem value="Georgia">Georgia</SelectItem>
                                    <SelectItem value="Verdana">Verdana</SelectItem>
                                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                                    <SelectItem value="Courier New">Courier New</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="overlay-color">Color</Label>
                                <div className="flex gap-2">
                                  <Input
                                    id="overlay-color"
                                    type="color"
                                    value={overlayFontColor}
                                    onChange={(e) => setOverlayFontColor(e.target.value)}
                                    className="w-12 h-9 p-1"
                                    data-testid="input-overlay-color"
                                  />
                                  <Input
                                    value={overlayFontColor}
                                    onChange={(e) => setOverlayFontColor(e.target.value)}
                                    className="flex-1 font-mono text-xs"
                                    data-testid="input-overlay-color-hex"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 p-3 border rounded-md">
                          <h4 className="text-sm font-medium">Hosting Duration</h4>
                          <p className="text-xs text-muted-foreground">
                            Your {isVideoContent ? "video" : "image"} will be hosted online and accessible via QR code for the selected duration.
                            {isVideoContent && <span className="text-orange-600 dark:text-orange-400"> Video hosting costs more than image hosting.</span>}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {hostingTiers.filter(t => t.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((tier) => {
                              const price = isVideoContent 
                                ? parseFloat(tier.videoPriceUpcharge || tier.priceUpcharge || "0")
                                : parseFloat(tier.priceUpcharge || "0");
                              return (
                                <button
                                  key={tier.id}
                                  type="button"
                                  onClick={() => setSelectedHostingTier(tier.code)}
                                  className={`p-3 rounded-md border text-left transition-colors ${
                                    selectedHostingTier === tier.code 
                                      ? "border-primary bg-primary/5" 
                                      : "hover-elevate"
                                  }`}
                                  data-testid={`button-hosting-tier-${tier.code}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{tier.name}</span>
                                    {selectedHostingTier === tier.code && (
                                      <Check className="w-4 h-4 text-primary" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {tier.isIncluded ? (
                                      <Badge variant="outline" className="text-xs">Included</Badge>
                                    ) : (
                                      <Badge 
                                        variant="secondary" 
                                        className={`text-xs ${isVideoContent ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : ""}`}
                                      >
                                        +${price.toFixed(0)}
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Your {isVideoContent ? "video" : "image"} is now hosted. The QR code will link to a branded landing page showing your {isVideoContent ? "video" : "image"}.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="design" className="space-y-4">
                    {!uploadedImage ? (
                      <ImageDesigner 
                        onImageReady={handleDesignReady}
                        isUploading={uploadDesignMutation.isPending}
                      />
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                          <Palette className="w-8 h-8 text-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">Design saved successfully</p>
                            <p className="text-xs text-muted-foreground truncate">{uploadedImage.url}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUploadedImage(null);
                              setIsVideoContent(false);
                              setQrContent("");
                              setQrCodeImage("");
                            }}
                            data-testid="button-remove-design"
                          >
                            Start Over
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Your custom design is now hosted. The QR code will link to a branded landing page showing your creation.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="dynamic" className="space-y-4">
                    <div className="space-y-4">
                      <div className="p-4 bg-primary/10 rounded-md border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <RefreshCw className="w-5 h-5 text-primary" />
                          <span className="font-semibold text-primary">QR Dynamics™</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <strong>"Your shirt is a digital billboard you control from your phone."</strong>
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Buy once, change the content forever. Your QR code stays the same, but the page it links to 
                          is yours to update anytime - show seasonal specials, event info, photos, videos, or anything else!
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="dynamic-title">Page Title</Label>
                        <Input
                          id="dynamic-title"
                          placeholder="My Dynamic QR Page"
                          value={dynamicPageTitle}
                          onChange={(e) => setDynamicPageTitle(e.target.value)}
                          data-testid="input-dynamic-title"
                        />
                        <p className="text-xs text-muted-foreground">
                          Give your dynamic page a title that describes its purpose
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dynamic-description">Description (optional)</Label>
                        <Textarea
                          id="dynamic-description"
                          placeholder="A description for your dynamic page..."
                          value={dynamicPageDescription}
                          onChange={(e) => setDynamicPageDescription(e.target.value)}
                          rows={2}
                          data-testid="textarea-dynamic-description"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Hosting Duration</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          How long should your dynamic page remain active? Prices shown are for images. Video hosting costs more.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {hostingTiers.filter(t => t.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((tier) => {
                            const imagePrice = parseFloat(tier.priceUpcharge || "0");
                            const videoPrice = parseFloat(tier.videoPriceUpcharge || tier.priceUpcharge || "0");
                            const hasVideoUpcharge = videoPrice > imagePrice;
                            return (
                              <button
                                key={tier.id}
                                type="button"
                                className={`p-3 rounded-md border text-left transition-all hover-elevate ${
                                  dynamicHostingTier === tier.code 
                                    ? "border-primary bg-primary/5" 
                                    : "border-border"
                                }`}
                                onClick={() => setDynamicHostingTier(tier.code)}
                                data-testid={`button-dynamic-tier-${tier.code}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">{tier.name}</span>
                                  {dynamicHostingTier === tier.code && (
                                    <Check className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                  {tier.isIncluded ? (
                                    <Badge variant="outline" className="text-xs w-fit">Included</Badge>
                                  ) : (
                                    <>
                                      <Badge variant="secondary" className="text-xs w-fit">+${imagePrice.toFixed(0)} img</Badge>
                                      {hasVideoUpcharge && (
                                        <Badge className="text-xs w-fit bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                          +${videoPrice.toFixed(0)} video
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 border rounded-md bg-muted/30">
                        <Checkbox
                          id="dynamic-content-rights"
                          checked={contentRightsConfirmed}
                          onCheckedChange={(checked) => setContentRightsConfirmed(checked === true)}
                          className="mt-0.5"
                          data-testid="checkbox-dynamic-content-rights"
                        />
                        <Label 
                          htmlFor="dynamic-content-rights" 
                          className="text-sm leading-relaxed cursor-pointer"
                        >
                          I understand that any content I upload must be owned by me or I must have the legal right to use it.
                          QR Gear is not responsible for any copyright or intellectual property issues.
                        </Label>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        After purchase, you can upload and swap images or videos anytime from your account dashboard.
                        The QR code on your product will always show whatever content you have set as active.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="qr-color">QR Code Color</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="qr-color"
                        type="color"
                        value={qrColor}
                        onChange={(e) => setQrColor(e.target.value)}
                        className="w-16 h-9 p-1"
                        data-testid="input-qr-color"
                      />
                      <Input
                        type="text"
                        value={qrColor}
                        onChange={(e) => setQrColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="qr-bg-color">Background Color</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="qr-bg-color"
                        type="color"
                        value={qrBgColor}
                        onChange={(e) => setQrBgColor(e.target.value)}
                        className="w-16 h-9 p-1"
                        data-testid="input-qr-bg-color"
                      />
                      <Input
                        type="text"
                        value={qrBgColor}
                        onChange={(e) => setQrBgColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mobile-only mini preview - shows QR code inline */}
            {qrCodeImage && (
              <div className="lg:hidden p-4 bg-muted/50 rounded-lg border border-border" data-testid="mobile-mini-preview">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 bg-white p-2 rounded-md">
                    <img src={qrCodeImage} alt="QR Preview" className="w-20 h-20" data-testid="mobile-qr-preview" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground" data-testid="text-qr-label">Your QR Code</p>
                    {textAbove && <p className="text-xs text-muted-foreground truncate" data-testid="text-above-preview">"{textAbove}" above</p>}
                    {textBelow && <p className="text-xs text-muted-foreground truncate" data-testid="text-below-preview">"{textBelow}" below</p>}
                    <p className="text-xs text-primary mt-1">Scroll down for full preview</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Customization */}
            {selectedProduct && (
              <Card>
                <CardHeader>
                  <CardTitle>3. Customize Placement & Color</CardTitle>
                  <CardDescription>Fine-tune your design</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="placement">QR Code Placement</Label>
                    <Select value={placement} onValueChange={setPlacement}>
                      <SelectTrigger id="placement" data-testid="select-placement">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlacements.length > 0 ? (
                          availablePlacements.map((pos: string) => (
                            <SelectItem key={pos} value={pos}>
                              {formatPlacementLabel(pos)}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="front">Front</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Product Color</Label>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {availableColors.map((color: any) => (
                        <Button
                          key={color.name}
                          variant={productColor === color.name ? "default" : "outline"}
                          size="sm"
                          className="flex items-center gap-2 px-3 py-2"
                          onClick={() => setProductColor(color.name)}
                          data-testid={`button-color-${color.name.toLowerCase()}`}
                        >
                          <div
                            className="w-4 h-4 rounded-full border flex-shrink-0"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-xs">{color.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Size</Label>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {availableSizes.map((size) => (
                        <Button
                          key={size.value}
                          variant={selectedSize === size.value ? "default" : "outline"}
                          size="sm"
                          className="min-w-[3rem] px-4"
                          onClick={() => setSelectedSize(size.value)}
                          data-testid={`button-size-${size.value.toLowerCase()}`}
                        >
                          {size.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {selectedProduct.madeInUSA && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <UsaFlag className="w-6 h-4" />
                      <span className="text-sm font-medium">Proudly Made in USA</span>
                    </div>
                  )}

                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <Label>Custom Text (Optional)</Label>
                      {priceQuote && priceQuote.breakdown.textAboveUpcharge > 0 && (
                        <Badge variant="outline" className="text-xs">+${priceQuote.breakdown.textAboveUpcharge.toFixed(2)} each</Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="text-above">
                        Text Above QR <span className="text-muted-foreground text-xs">({textAbove.length}/20)</span>
                      </Label>
                      <Input
                        id="text-above"
                        type="text"
                        placeholder="SCAN ME"
                        maxLength={20}
                        value={textAbove}
                        onChange={(e) => setTextAbove(e.target.value)}
                        data-testid="input-text-above"
                      />
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="text-below">
                        Text Below QR <span className="text-muted-foreground text-xs">({textBelow.length}/30)</span>
                      </Label>
                      <Input
                        id="text-below"
                        type="text"
                        placeholder="Connect with us!"
                        maxLength={30}
                        value={textBelow}
                        onChange={(e) => setTextBelow(e.target.value)}
                        data-testid="input-text-below"
                      />
                    </div>
                    
                    {priceQuote && (hasTextAbove || hasTextBelow) && (
                      <p className="text-xs text-muted-foreground">
                        Text adds +${(priceQuote.breakdown.textAboveUpcharge + priceQuote.breakdown.textBelowUpcharge).toFixed(2)} to your order
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1"
                disabled={
                  !qrCodeImage || 
                  !selectedProduct || 
                  addToCartMutation.isPending || 
                  !priceQuote || 
                  pricingError || 
                  pricingMutation.isPending ||
                  (qrType === "template" && !selectedTemplate)
                }
                onClick={handleAddToCart}
                data-testid="button-add-to-cart"
              >
                {addToCartMutation.isPending ? "Adding..." : 
                 pricingMutation.isPending ? "Calculating..." : 
                 pricingError ? "Pricing Error" :
                 (qrType === "template" && !selectedTemplate) ? "Select a Template" :
                 !qrCodeImage ? "Enter QR Content" :
                 `Add to Cart - $${totalPrice}`}
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={!qrCodeImage || !selectedProduct}
                data-testid="button-save-design"
              >
                Save Design
              </Button>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">Your Design Preview</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">See your finished product with QR code</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleShare}
                    disabled={!qrCodeImage}
                    data-testid="button-share-design"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Share Your Design</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-3 pt-4">
                        <Button onClick={copyToClipboard} variant="outline" className="flex items-center gap-2" data-testid="button-copy-link">
                          <Copy className="h-4 w-4" /> Copy Link
                        </Button>
                        <Button onClick={shareByEmail} variant="outline" className="flex items-center gap-2" data-testid="button-share-email">
                          <Mail className="h-4 w-4" /> Email
                        </Button>
                        <Button onClick={shareToFacebook} variant="outline" className="flex items-center gap-2" data-testid="button-share-facebook">
                          <Facebook className="h-4 w-4" /> Facebook
                        </Button>
                        <Button onClick={shareToTwitter} variant="outline" className="flex items-center gap-2" data-testid="button-share-twitter">
                          <Twitter className="h-4 w-4" /> X / Twitter
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <ProductMockup
                  product={selectedProduct}
                  qrCodeImage={qrCodeImage}
                  placement={placement}
                  productColor={productColor}
                  textAbove={textAbove}
                  textBelow={textBelow}
                />

                {selectedProduct && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-sm">
                      <span className="font-semibold">{selectedProduct.name}</span>
                      {productColor && <> in <span className="font-semibold">{productColor}</span></>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      QR Code: {placement.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    </p>
                    {(hasTextAbove || hasTextBelow) && (
                      <p className="text-xs text-muted-foreground">
                        {hasTextAbove && `"${textAbove}" above`}
                        {hasTextAbove && hasTextBelow && " • "}
                        {hasTextBelow && `"${textBelow}" below`}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* QR Code Only Preview - Matte zone for scannability */}
            {qrCodeImage && (
              <div className="card">
                <div className="card__title mb-3">
                  QR Code Close-up
                  <span className="pill">High Contrast</span>
                </div>
                <div className="qr-zone">
                  <div className="qr-zone__frame">
                    {hasTextAbove && (
                      <p className="text-sm font-bold tracking-wide mb-2" data-testid="preview-text-above">
                        {textAbove}
                      </p>
                    )}
                    <img
                      src={qrCodeImage}
                      alt="QR Code Preview"
                      className="w-32 h-32"
                      data-testid="preview-qr-code"
                    />
                    {hasTextBelow && (
                      <p className="text-sm font-bold tracking-wide mt-2" data-testid="preview-text-below">
                        {textBelow}
                      </p>
                    )}
                  </div>
                  <div className="qr-note">
                    Matte background ensures fast, reliable scanning.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
