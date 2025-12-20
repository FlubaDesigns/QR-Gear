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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navbar from "@/components/Navbar";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import UsaFlag from "@/components/UsaFlag";
import { Upload, ImageIcon, Loader2, Palette, LayoutTemplate, Check, RefreshCw } from "lucide-react";
import ImageDesigner from "@/components/ImageDesigner";
import ProductMockup from "@/components/ProductMockup";
import type { Product } from "@shared/schema";

interface QrTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnailUrl: string;
  fullImageUrl: string;
  priceUpcharge: string;
  isActive: boolean;
  isFeatured: boolean;
}

interface HostingTier {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationDays: number;
  isIncluded: boolean;
  priceUpcharge: string;
  isActive: boolean;
  sortOrder: number;
}

const placements = [
  { value: "front-chest", label: "Front Chest (Large)" },
  { value: "front-pocket", label: "Front Pocket (Small)" },
  { value: "back", label: "Back (Large)" },
  { value: "left-shoulder", label: "Left Shoulder" },
  { value: "right-shoulder", label: "Right Shoulder" },
  { value: "left-sleeve", label: "Left Sleeve" },
  { value: "right-sleeve", label: "Right Sleeve" },
  { value: "front-center", label: "Front Center" },
  { value: "side-left", label: "Side Left" },
  { value: "side-right", label: "Side Right" },
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
  const [qrType, setQrType] = useState<"text" | "image" | "upload" | "design" | "template" | "dynamic">("text");
  const [qrContent, setQrContent] = useState("");
  const [qrColor, setQrColor] = useState("#000000");
  const [qrBgColor, setQrBgColor] = useState("#FFFFFF");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [placement, setPlacement] = useState("front-chest");
  const [productColor, setProductColor] = useState("");
  const [textAbove, setTextAbove] = useState("");
  const [textBelow, setTextBelow] = useState("");
  const [uploadedImage, setUploadedImage] = useState<{ id: string; url: string; preview: string } | null>(null);
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
      const reader = new FileReader();
      return new Promise<{ id: string; publicUrl: string; landingUrl: string }>((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(",")[1];
            const response = await apiRequest("POST", "/api/images/upload", {
              imageData: base64,
              originalName: file.name,
              mimeType: file.type,
              title: imageTitle || null,
              description: imageDescription || null,
            });
            const data = await response.json();
            resolve(data);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
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
        title: "Image uploaded",
        description: "Your image is now hosted and ready for QR code generation",
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 10MB",
          variant: "destructive",
        });
        return;
      }
      if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a JPEG, PNG, GIF, or WebP image",
          variant: "destructive",
        });
        return;
      }
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

  const hasTextAbove = textAbove.trim().length > 0;
  const hasTextBelow = textBelow.trim().length > 0;

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
    // QR code image is required for all types except dynamic (which generates later)
    if (qrType !== "dynamic" && !qrCodeImage) return;
    
    addToCartMutation.mutate({
      productId: selectedProduct.id,
      quantity: 1,
      customization: {
        qrContent: qrType === "dynamic" ? `pending-dynamic-${Date.now()}` : qrContent,
        qrType: qrType === "template" ? "template" : (qrType === "upload" || qrType === "design") ? "image" : qrType,
        qrColor,
        qrBgColor,
        placement,
        productColor,
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
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PageBreadcrumb currentPage="Create" />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="font-heading text-4xl font-bold mb-2">QR Code Creator</h1>
        <p className="text-muted-foreground mb-8">
          Design your custom QR code product in three easy steps
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Step 1: QR Code Content */}
            <Card>
              <CardHeader>
                <CardTitle>1. Create Your QR Code</CardTitle>
                <CardDescription>Enter your message or image URL</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={qrType} onValueChange={(v) => {
                  setQrType(v as "text" | "image" | "upload" | "design" | "template" | "dynamic");
                  if (v === "upload" || v === "design" || v === "dynamic") {
                    setQrContent("");
                    setUploadedImage(null);
                  } else if (v === "text") {
                    setQrContent("");
                    setUploadedImage(null);
                  }
                  if (v !== "template") {
                    setSelectedTemplate(null);
                  }
                }}>
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="text" data-testid="tab-qr-text">Text</TabsTrigger>
                    <TabsTrigger value="template" data-testid="tab-qr-template" className="flex items-center gap-1">
                      <LayoutTemplate className="w-3 h-3" />
                      Gift
                    </TabsTrigger>
                    <TabsTrigger value="image" data-testid="tab-qr-image">URL</TabsTrigger>
                    <TabsTrigger value="upload" data-testid="tab-qr-upload" className="flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="design" data-testid="tab-qr-design" className="flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      Design
                    </TabsTrigger>
                    <TabsTrigger value="dynamic" data-testid="tab-qr-dynamic" className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Dynamic
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="text" className="space-y-4">
                    <div>
                      <Label htmlFor="qr-text">Your Message</Label>
                      <Textarea
                        id="qr-text"
                        placeholder="I love QR Gear! Or any message you want..."
                        value={qrContent}
                        onChange={(e) => setQrContent(e.target.value)}
                        rows={4}
                        data-testid="textarea-qr-content"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Works offline - message embedded in QR code
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
                                {parseFloat(template.priceUpcharge) > 0 && (
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
                            {parseFloat(selectedTemplate.priceUpcharge) > 0 && (
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
                      accept="image/jpeg,image/png,image/gif,image/webp"
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
                        <Button
                          variant="outline"
                          className="w-full h-24 border-dashed"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadImageMutation.isPending}
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
                              setQrContent("");
                              setQrCodeImage("");
                              setOverlayText("");
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
                            Your image will be hosted online and accessible via QR code for the selected duration.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {hostingTiers.filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((tier) => (
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
                                    <Badge variant="secondary" className="text-xs">+${parseFloat(tier.priceUpcharge).toFixed(0)}</Badge>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Your image is now hosted. The QR code will link to a branded landing page showing your image.
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
                          <span className="font-semibold text-primary">Dynamic QR Code</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Create a QR code that links to a page you control. Change the displayed image anytime - 
                          today it could be a sunflower, tomorrow a battleship! Your QR code stays the same, 
                          but the content can change whenever you want.
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
                          How long should your dynamic page remain active?
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {hostingTiers.filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((tier) => (
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
                              <div className="flex items-center gap-2 mt-1">
                                {tier.isIncluded ? (
                                  <Badge variant="outline" className="text-xs">Included</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">+${parseFloat(tier.priceUpcharge).toFixed(0)}</Badge>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        After purchase, you can upload and swap images anytime from your account dashboard.
                        The QR code on your product will always show whatever image you have set as active.
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

            {/* Step 2: Product Selection */}
            <Card>
              <CardHeader>
                <CardTitle>2. Choose Your Product</CardTitle>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      <CardContent className="p-3">
                        <div className="aspect-square bg-muted rounded-md mb-2 overflow-hidden relative">
                          <img
                            src={product.imageUrl || ""}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                          {product.madeInUSA && (
                            <Badge className="absolute top-1 right-1 text-xs gap-1">
                              <UsaFlag className="w-3 h-2" />
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">${product.basePrice}</p>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
                        {placements
                          .filter((p) => availablePlacements.includes(p.value))
                          .map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Product Color</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {availableColors.map((color: any) => (
                        <Button
                          key={color.name}
                          variant={productColor === color.name ? "default" : "outline"}
                          className="flex items-center gap-2"
                          onClick={() => setProductColor(color.name)}
                          data-testid={`button-color-${color.name.toLowerCase()}`}
                        >
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-xs">{color.name}</span>
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
            <Card>
              <CardHeader>
                <CardTitle>Product Preview</CardTitle>
                <CardDescription>See your design on the actual product</CardDescription>
              </CardHeader>
              <CardContent>
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
