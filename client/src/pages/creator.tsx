import { useState, useEffect, useRef, lazy, Suspense } from "react";
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
import { Upload, ImageIcon, Loader2, Palette, LayoutTemplate, Check, RefreshCw, Share2, Copy, Facebook, Twitter, Mail, ChevronRight, Sparkles, Video, Type, Image, Package, Shirt, Target, ArrowLeft, ArrowRight, RotateCw, ImagePlus } from "lucide-react";
const ImageCropper = lazy(() => import("@/components/ImageCropper"));
import { getSwatchColor } from "@/lib/admin-utils";
import { FontPicker } from "@/components/ui/font-picker";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImageDesigner from "@/components/ImageDesigner";
import ProductMockup from "@/components/ProductMockup";
import type { Product, QrTemplate, HostingTier, ProductCategory } from "@shared/schema";

type ProductLine = "static" | "static-plus" | "url" | "video" | "dynamics";

const productLineConfig: Record<ProductLine, {
  label: string;
  description: string;
  icon: any;
  qrTypes: string[];
  productLineFilter: string[];
  upsell?: { line: ProductLine; message: string };
}> = {
  "static": {
    label: "Simple QR",
    description: "Basic text or URL encoded in QR code",
    icon: Type,
    qrTypes: ["text"],
    productLineFilter: ["text", "all"],
    upsell: { line: "static-plus", message: "Add header/footer text for more impact" },
  },
  "static-plus": {
    label: "QR + Text",
    description: "Add header and footer text around your QR",
    icon: Type,
    qrTypes: ["text"],
    productLineFilter: ["text", "all"],
    upsell: { line: "url", message: "Add a custom background that shows when people scan your QR" },
  },
  "url": {
    label: "Custom Backgrounds",
    description: "Upload your own background or choose from our templates",
    icon: Image,
    qrTypes: ["template"],
    productLineFilter: ["template", "all"],
    upsell: { line: "dynamics", message: "Go Dynamic - update your content anytime without reprinting" },
  },
  "video": {
    label: "Video QR",
    description: "Upload a video that plays when scanned",
    icon: Video,
    qrTypes: ["upload"],
    productLineFilter: ["custom", "all"],
    upsell: { line: "dynamics", message: "Go Dynamic - swap videos anytime with QR Dynamics" },
  },
  "dynamics": {
    label: "QR Dynamics™",
    description: "Living QR codes you can update anytime",
    icon: Sparkles,
    qrTypes: ["dynamic"],
    productLineFilter: ["dynamic", "all"],
  },
};

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

// QR Placement options with icons (matching admin-products)
const QR_PLACEMENTS = [
  { id: "front-chest", label: "Front Chest", Icon: Shirt },
  { id: "front-center", label: "Front Center", Icon: Target },
  { id: "back", label: "Back", Icon: ArrowLeft },
  { id: "left-shoulder", label: "Left Shoulder", Icon: ArrowLeft },
  { id: "right-shoulder", label: "Right Shoulder", Icon: ArrowRight },
  { id: "wrap-around", label: "Wrap Around", Icon: RotateCw },
];

type PlacementMode = 'full' | 'qr-only';

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
  const [productLine, setProductLine] = useState<ProductLine>("static");
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
    
    const lineParam = urlParams.get("line") as ProductLine | null;
    if (lineParam && productLineConfig[lineParam]) {
      setProductLine(lineParam);
      const config = productLineConfig[lineParam];
      if (config.qrTypes[0] === "text") setQrType("text");
      else if (config.qrTypes[0] === "template") setQrType("template");
      else if (config.qrTypes[0] === "upload") setQrType("upload");
      else if (config.qrTypes[0] === "dynamic") setQrType("dynamic");
    }
  }, []);
  
  const handleProductLineChange = (line: ProductLine) => {
    setProductLine(line);
    const config = productLineConfig[line];
    if (config.qrTypes[0] === "text") setQrType("text");
    else if (config.qrTypes[0] === "template") setQrType("template");
    else if (config.qrTypes[0] === "upload") setQrType("upload");
    else if (config.qrTypes[0] === "dynamic") setQrType("dynamic");
    setQrContent("");
    setUploadedImage(null);
    setSelectedTemplate(null);
  };
  
  const currentLineConfig = productLineConfig[productLine];
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [qrColor, setQrColor] = useState("#000000");
  const [qrBgColor, setQrBgColor] = useState("#FFFFFF");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [placementConfigs, setPlacementConfigs] = useState<Record<string, PlacementMode>>({
    "front-chest": "full"
  });
  const placement = Object.keys(placementConfigs)[0] || "front-chest";
  const [productColor, setProductColor] = useState("");
  const [textAbove, setTextAbove] = useState("");
  const [textBelow, setTextBelow] = useState("");
  
  const [headerEnabled, setHeaderEnabled] = useState(false);
  const [headerFontFamily, setHeaderFontFamily] = useState("Arial");
  const [headerFontSize, setHeaderFontSize] = useState("120");
  const [headerColor, setHeaderColor] = useState("#000000");
  const [headerWarp, setHeaderWarp] = useState("straight");
  const [headerLetterSpacing, setHeaderLetterSpacing] = useState(0);
  const [headerStrokeColor, setHeaderStrokeColor] = useState("");
  const [headerStrokeWidth, setHeaderStrokeWidth] = useState(0);
  
  const [footerEnabled, setFooterEnabled] = useState(false);
  const [footerFontFamily, setFooterFontFamily] = useState("Arial");
  const [footerFontSize, setFooterFontSize] = useState("120");
  const [footerColor, setFooterColor] = useState("#000000");
  const [footerWarp, setFooterWarp] = useState("straight");
  const [footerLetterSpacing, setFooterLetterSpacing] = useState(0);
  const [footerStrokeColor, setFooterStrokeColor] = useState("");
  const [footerStrokeWidth, setFooterStrokeWidth] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<{ id: string; url: string; preview: string } | null>(null);
  const [isVideoContent, setIsVideoContent] = useState(false);
  const [imageTitle, setImageTitle] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<QrTemplate | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [showCustomUpload, setShowCustomUpload] = useState(false);
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
    queryKey: ["/api/products?store=qr-gear-main&segment=creator"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<QrTemplate[]>({
    queryKey: ["/api/templates"],
    enabled: qrType === "template",
  });

  const { data: hostingTiers = [] } = useQuery<HostingTier[]>({
    queryKey: ["/api/hosting-tiers"],
    enabled: qrType === "upload" || qrType === "dynamic",
  });

  interface RenderConfig {
    fonts: string[];
    warpPresets: { value: string; label: string }[];
  }
  const FONT_FAMILIES = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana", "Courier New", "Impact", "Comic Sans MS", "Trebuchet MS", "Palatino Linotype"];
  const { data: renderConfig } = useQuery<RenderConfig>({
    queryKey: ["/api/render/config"],
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
  
  // Get colors/sizes filtered by admin's enabled settings
  const getFilteredColors = () => {
    if (!selectedProduct) return [];
    const rawColors = Array.isArray((selectedProduct as any).availableColors) ? (selectedProduct as any).availableColors : [];
    const colors = rawColors.map((c: any) => ({
      name: typeof c === 'string' ? c : c.name || '',
      hex: typeof c === 'string' ? getSwatchColor(c) : c.hex || getSwatchColor(c.name || '')
    }));
    const enabledColors = ((selectedProduct as any).metadata?.enabledColors as string[] | undefined);
    if (enabledColors && enabledColors.length > 0) {
      return colors.filter((c: any) => enabledColors.includes(c.name));
    }
    return colors;
  };
  const availableColors = getFilteredColors();

  const getFilteredSizes = () => {
    if (!selectedProduct) return [];
    // Use product's availableSizes from admin config
    const productSizes = Array.isArray((selectedProduct as any).availableSizes) ? (selectedProduct as any).availableSizes as string[] : [];
    const enabledSizes = ((selectedProduct as any).metadata?.enabledSizes as string[] | undefined);
    
    // If product has specific sizes set, use those (filtered by enabled)
    if (productSizes.length > 0) {
      const filteredSizes = enabledSizes && enabledSizes.length > 0 
        ? productSizes.filter(s => enabledSizes.includes(s))
        : productSizes;
      return filteredSizes.map(s => ({ label: s, value: s }));
    }
    
    // Fallback to category-based sizes if no product-specific sizes
    const productName = selectedProduct.name.toLowerCase();
    let fallbackSizes = standardSizes;
    if (productName.includes("mug")) fallbackSizes = mugSizes;
    else if (productName.includes("hat") || productName.includes("cap")) fallbackSizes = hatSizes;
    else if (productName.includes("bag") || productName.includes("tote")) fallbackSizes = bagSizes;
    
    // Filter fallback sizes by enabled if set
    if (enabledSizes && enabledSizes.length > 0) {
      return fallbackSizes.filter(s => enabledSizes.includes(s.value));
    }
    return fallbackSizes;
  };
  const availableSizes = getFilteredSizes();

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
        <p className="text-sm sm:text-base text-muted-foreground mb-4">
          Design your custom QR code product in three easy steps
        </p>

        {/* Product Line Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-6" data-testid="product-line-selector">
          {(Object.entries(productLineConfig) as [ProductLine, typeof productLineConfig[ProductLine]][]).map(([key, config]) => {
            const IconComponent = config.icon;
            return (
              <button
                key={key}
                onClick={() => handleProductLineChange(key)}
                className={`qr-touch-48 flex flex-col items-center justify-center p-3 sm:p-4 rounded-md border transition-all ${
                  productLine === key
                    ? "border-primary bg-primary/10 ring-2 ring-primary"
                    : "border-border hover-elevate"
                }`}
                data-testid={`button-line-${key}`}
              >
                <IconComponent className={`h-5 w-5 sm:h-6 sm:w-6 mb-1 ${productLine === key ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs sm:text-sm font-medium ${productLine === key ? "text-primary" : ""}`}>
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Upsell Banner */}
        {currentLineConfig.upsell && (
          <div 
            className="mb-6 p-3 sm:p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-md flex items-center justify-between gap-3 cursor-pointer hover-elevate"
            onClick={() => handleProductLineChange(currentLineConfig.upsell!.line)}
            data-testid="banner-upsell"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm">
                <span className="font-medium">Upgrade:</span> {currentLineConfig.upsell.message}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-primary shrink-0" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Step 1: QR Code Content - NOW FIRST */}
            <Card>
              <CardHeader>
                <CardTitle>1. {currentLineConfig.label}</CardTitle>
                <CardDescription>{currentLineConfig.description}</CardDescription>
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
                    {showCustomUpload ? (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <Label>Upload Your Background</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowCustomUpload(false);
                              setCustomBackground(null);
                            }}
                            data-testid="button-back-to-templates"
                          >
                            Back to Templates
                          </Button>
                        </div>
                        <Suspense fallback={<div className="text-center py-8"><Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" /></div>}>
                          <ImageCropper
                            onCropComplete={(croppedImage) => {
                              setCustomBackground(croppedImage);
                              setSelectedTemplate(null);
                            }}
                            onCancel={() => {
                              setShowCustomUpload(false);
                              setCustomBackground(null);
                            }}
                          />
                        </Suspense>
                        {customBackground && (
                          <div className="mt-4 p-3 bg-muted rounded-md">
                            <div className="flex items-center gap-3">
                              <img
                                src={customBackground}
                                alt="Your background"
                                className="w-16 h-16 object-cover rounded"
                              />
                              <div className="flex-1">
                                <p className="font-medium">Your Custom Background</p>
                                <p className="text-xs text-muted-foreground">Ready to use</p>
                              </div>
                              <Check className="w-5 h-5 text-green-500" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="mb-4">
                          <button
                            onClick={() => {
                              setShowCustomUpload(true);
                              setSelectedTemplate(null);
                            }}
                            className="w-full p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center gap-3 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer min-h-12"
                            data-testid="button-upload-custom-background"
                          >
                            <ImagePlus className="w-6 h-6 text-muted-foreground" />
                            <span className="font-medium">Upload Your Own Background</span>
                          </button>
                          <p className="text-xs text-muted-foreground text-center mt-2">
                            Or choose from our templates below
                          </p>
                        </div>
                        
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
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setCustomBackground(null);
                                }}
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
                    )}
                    
                    {(selectedTemplate || customBackground) && (
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

            {/* Step 2: Product Selection */}
            <Card>
              <CardHeader>
                <CardTitle>2. Choose Your Product</CardTitle>
                <CardDescription>Select item, color, and size</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {productsLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Loading products...
                  </div>
                )}
                
                {productsError && (
                  <div className="text-center py-8 text-destructive">
                    Failed to load products. Please try refreshing the page.
                  </div>
                )}
                
                {!productsLoading && !productsError && (() => {
                  const lineFilter = currentLineConfig.productLineFilter;
                  const filteredProducts = products.filter((product) => {
                    const productLineValue = (product as any).productLine || "none";
                    if (productLineValue === "none") return false;
                    return lineFilter.includes(productLineValue) || productLineValue === "all";
                  });
                  
                  if (filteredProducts.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-medium">No products available for this line yet</p>
                        <p className="text-sm mt-1">Products will appear here once enabled by admin</p>
                      </div>
                    );
                  }
                  
                  return (
                    <>
                      {/* Product Grid - Store-style layout */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredProducts.map((product) => {
                          const isSelected = selectedProduct?.id === product.id;
                          return (
                            <Card 
                              key={product.id} 
                              className={`overflow-hidden cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary border-primary" : "hover-elevate"}`}
                              onClick={() => {
                                setSelectedProduct(product);
                                const rawColors = Array.isArray((product as any).availableColors) ? (product as any).availableColors : [];
                                const colors = rawColors.map((c: any) => typeof c === 'string' ? c : c.name || '');
                                const sizes = Array.isArray((product as any).availableSizes) ? (product as any).availableSizes as string[] : [];
                                if (!productColor && colors.length > 0) setProductColor(colors[0]);
                                if (!selectedSize && sizes.length > 0) setSelectedSize(sizes[0]);
                              }}
                              data-testid={`card-product-${product.id}`}
                            >
                              <div className="relative aspect-square bg-muted">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-12 h-12 text-muted-foreground" />
                                  </div>
                                )}
                                {product.madeInUSA && (
                                  <Badge className="absolute top-3 right-3 gap-1.5" variant="secondary">
                                    <UsaFlag className="w-4 h-3" />
                                    USA Made
                                  </Badge>
                                )}
                                {isSelected && (
                                  <div className="absolute top-3 left-3">
                                    <Badge className="gap-1">
                                      <Check className="w-3 h-3" />
                                      Selected
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              <CardContent className="p-4">
                                <h3 className="font-semibold text-foreground mb-1 truncate">{product.name}</h3>
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                  {product.description || `Custom QR ${product.category}`}
                                </p>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-lg font-bold text-primary">${product.customerPrice || product.basePrice}</span>
                                  <Button 
                                    size="sm"
                                    variant={isSelected ? "default" : "outline"}
                                    className="qr-touch-48"
                                    data-testid={`button-select-${product.id}`}
                                  >
                                    {isSelected ? "Selected" : "Select"}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      {/* Color, Size & Placement Panel - appears after product selection */}
                      {selectedProduct && (() => {
                        const rawColors = Array.isArray((selectedProduct as any).availableColors) ? (selectedProduct as any).availableColors : [];
                        const colors = rawColors.map((c: any) => ({
                          name: typeof c === 'string' ? c : c.name || '',
                          hex: typeof c === 'string' ? getSwatchColor(c) : c.hex || getSwatchColor(c.name || '')
                        }));
                        const sizes = Array.isArray((selectedProduct as any).availableSizes) ? (selectedProduct as any).availableSizes as string[] : [];
                        const enabledColors = ((selectedProduct as any).metadata?.enabledColors as string[] | undefined) || colors.map((c: any) => c.name);
                        const enabledSizes = ((selectedProduct as any).metadata?.enabledSizes as string[] | undefined) || sizes;
                        const visibleColors = colors.filter((c: any) => enabledColors.includes(c.name));
                        const visibleSizes = sizes.filter((s: string) => enabledSizes.includes(s));

                        return (
                          <div className="mt-6 p-4 bg-muted/50 rounded-lg border" data-testid="panel-product-options">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                                <img src={selectedProduct.imageUrl || ""} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{selectedProduct.name}</p>
                                {selectedProduct.madeInUSA && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <UsaFlag className="w-4 h-3" />
                                    <span className="text-xs text-muted-foreground">Made in USA</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-lg font-bold text-primary">${selectedProduct.customerPrice || selectedProduct.basePrice}</span>
                            </div>

                            {visibleColors.length > 0 && (
                              <div className="mb-4">
                                <Label className="text-sm mb-2 block">Color: <span className="font-normal text-muted-foreground">{productColor}</span></Label>
                                <div className="flex flex-wrap gap-2">
                                  {visibleColors.map((color: any) => (
                                    <button
                                      key={color.name}
                                      type="button"
                                      className={`w-10 h-10 rounded-full border-2 transition-all qr-touch-48 ${
                                        productColor === color.name 
                                          ? "ring-2 ring-primary ring-offset-2 border-primary" 
                                          : "border-muted hover:border-foreground/50"
                                      }`}
                                      style={{ backgroundColor: color.hex }}
                                      onClick={() => setProductColor(color.name)}
                                      title={color.name}
                                      data-testid={`button-swatch-${color.name}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {visibleSizes.length > 0 && (
                              <div className="mb-4">
                                <Label className="text-sm mb-2 block">Size: <span className="font-normal text-muted-foreground">{selectedSize}</span></Label>
                                <div className="flex flex-wrap gap-2">
                                  {visibleSizes.map((size: string) => (
                                    <button
                                      key={size}
                                      type="button"
                                      className={`px-4 py-2 text-sm rounded border transition-all qr-touch-48 ${
                                        selectedSize === size 
                                          ? "bg-primary text-primary-foreground border-primary" 
                                          : "bg-background border-muted hover:border-foreground/50"
                                      }`}
                                      onClick={() => setSelectedSize(size)}
                                      data-testid={`button-size-${size}`}
                                    >
                                      {size}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* QR Placement - matching products page layout */}
                            <div className="pt-4 border-t">
                              <Label className="text-sm mb-2 block">Print Placements</Label>
                              <p className="text-xs text-muted-foreground mb-3">Select placement and choose artwork type</p>
                              
                              <div className="space-y-3">
                                {QR_PLACEMENTS.map(({ id, label, Icon }) => {
                                  const isSelected = id in placementConfigs;
                                  const mode = placementConfigs[id] || "full";
                                  
                                  return (
                                    <div 
                                      key={id}
                                      className={`p-3 rounded-lg border-2 transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}
                                    >
                                      <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <Button
                                          variant={isSelected ? "default" : "outline"}
                                          className="h-12 min-w-[140px] flex-1 qr-touch-48"
                                          onClick={() => {
                                            const newConfigs = { ...placementConfigs };
                                            if (isSelected) {
                                              if (Object.keys(newConfigs).length > 1) {
                                                delete newConfigs[id];
                                              }
                                            } else {
                                              newConfigs[id] = "full";
                                            }
                                            setPlacementConfigs(newConfigs);
                                          }}
                                          data-testid={`button-placement-${id}`}
                                        >
                                          <Icon className="h-5 w-5 mr-2" />
                                          {label}
                                        </Button>
                                        
                                        {isSelected && (
                                          <div className="flex gap-1 bg-muted rounded-md p-1">
                                            <Button
                                              variant={mode === "full" ? "default" : "ghost"}
                                              size="sm"
                                              className="h-10 px-3 text-xs qr-touch-48"
                                              onClick={() => {
                                                setPlacementConfigs({
                                                  ...placementConfigs,
                                                  [id]: "full"
                                                });
                                              }}
                                              data-testid={`placement-${id}-full`}
                                            >
                                              Full Artwork
                                            </Button>
                                            <Button
                                              variant={mode === "qr-only" ? "default" : "ghost"}
                                              size="sm"
                                              className="h-10 px-3 text-xs qr-touch-48"
                                              onClick={() => {
                                                setPlacementConfigs({
                                                  ...placementConfigs,
                                                  [id]: "qr-only"
                                                });
                                              }}
                                              data-testid={`placement-${id}-qr-only`}
                                            >
                                              QR Only
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Step 3: Custom Text (Optional) with Rich Styling */}
            {selectedProduct && (
              <Card>
                <CardHeader>
                  <CardTitle>3. Add Text (Optional)</CardTitle>
                  <CardDescription>Add stylized header or footer text around your QR code</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Top Text (Header) with Rich Controls */}
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="header-enabled" className="font-semibold">Top Text (Header)</Label>
                      <div className="flex items-center gap-2">
                        {priceQuote && priceQuote.breakdown.textAboveUpcharge > 0 && (
                          <Badge variant="outline" className="text-xs">+${priceQuote.breakdown.textAboveUpcharge.toFixed(2)}</Badge>
                        )}
                        <Switch
                          id="header-enabled"
                          checked={headerEnabled}
                          onCheckedChange={(checked) => {
                            setHeaderEnabled(checked);
                            if (!checked) setTextAbove("");
                          }}
                          data-testid="switch-header-text"
                        />
                      </div>
                    </div>
                    {headerEnabled && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Enter top text (max 20 chars)"
                          value={textAbove}
                          onChange={(e) => setTextAbove(e.target.value.slice(0, 20))}
                          maxLength={20}
                          className="qr-touch-48"
                          data-testid="input-text-above"
                        />
                        
                        {/* Font and Size */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Font</Label>
                            <FontPicker
                              value={headerFontFamily}
                              onChange={setHeaderFontFamily}
                              fonts={renderConfig?.fonts || FONT_FAMILIES}
                              previewText={textAbove || "QR Gear"}
                              data-testid="select-header-font"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Size</Label>
                            <select
                              className="w-full h-12 px-3 border rounded-md text-sm bg-background qr-touch-48"
                              value={headerFontSize}
                              onChange={(e) => setHeaderFontSize(e.target.value)}
                              data-testid="select-header-size"
                            >
                              {[72, 96, 120, 144, 168, 192, 216, 240, 280, 320].map((size) => (
                                <option key={size} value={String(size)}>{size}pt</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        {/* Color and Warp */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Color</Label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={headerColor}
                                onChange={(e) => setHeaderColor(e.target.value)}
                                className="w-12 h-12 border rounded-md cursor-pointer qr-touch-48"
                                data-testid="input-header-color"
                              />
                              <Input
                                value={headerColor}
                                onChange={(e) => setHeaderColor(e.target.value)}
                                className="flex-1 font-mono text-xs qr-touch-48"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Warp Style</Label>
                            <select
                              className="w-full h-12 px-3 border rounded-md text-sm bg-background qr-touch-48"
                              value={headerWarp}
                              onChange={(e) => setHeaderWarp(e.target.value)}
                              data-testid="select-header-warp"
                            >
                              {(renderConfig?.warpPresets || [
                                { value: 'straight', label: 'Straight' },
                                { value: 'arc-up', label: 'Arc Up' },
                                { value: 'arc-down', label: 'Arc Down' },
                              ]).map((preset) => (
                                <option key={preset.value} value={preset.value}>{preset.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        {/* Letter Spacing */}
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Letter Spacing: {headerLetterSpacing}px
                          </Label>
                          <input
                            type="range"
                            min="-10"
                            max="50"
                            value={headerLetterSpacing}
                            onChange={(e) => setHeaderLetterSpacing(Number(e.target.value))}
                            className="w-full h-6 accent-primary cursor-pointer qr-touch-48"
                            data-testid="slider-header-spacing"
                          />
                        </div>
                        
                        {/* Stroke/Outline */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Stroke Color</Label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={headerStrokeColor || "#ffffff"}
                                onChange={(e) => setHeaderStrokeColor(e.target.value)}
                                className="w-12 h-12 border rounded-md cursor-pointer qr-touch-48"
                                data-testid="input-header-stroke-color"
                              />
                              <Input
                                value={headerStrokeColor}
                                onChange={(e) => setHeaderStrokeColor(e.target.value)}
                                className="flex-1 font-mono text-xs qr-touch-48"
                                placeholder="None"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Stroke Width: {headerStrokeWidth}px</Label>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              value={headerStrokeWidth}
                              onChange={(e) => setHeaderStrokeWidth(Number(e.target.value))}
                              className="w-full h-6 accent-primary cursor-pointer mt-3 qr-touch-48"
                              data-testid="slider-header-stroke"
                            />
                          </div>
                        </div>
                        
                        {/* Preview */}
                        {textAbove && (
                          <div className="p-3 bg-background rounded-md border text-center overflow-hidden">
                            <div 
                              style={{ 
                                fontFamily: headerFontFamily, 
                                fontSize: `${Math.min(parseInt(headerFontSize) * 0.2, 36)}px`,
                                color: headerColor,
                                letterSpacing: `${headerLetterSpacing * 0.1}px`,
                                textShadow: headerStrokeColor && headerStrokeWidth > 0 
                                  ? `0 0 ${headerStrokeWidth}px ${headerStrokeColor}` 
                                  : undefined,
                                fontWeight: 'bold',
                              }}
                            >
                              {textAbove}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Warp: {renderConfig?.warpPresets?.find(p => p.value === headerWarp)?.label || headerWarp}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Bottom Text (Footer) with Rich Controls */}
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="footer-enabled" className="font-semibold">Bottom Text (Footer)</Label>
                      <div className="flex items-center gap-2">
                        {priceQuote && priceQuote.breakdown.textBelowUpcharge > 0 && (
                          <Badge variant="outline" className="text-xs">+${priceQuote.breakdown.textBelowUpcharge.toFixed(2)}</Badge>
                        )}
                        <Switch
                          id="footer-enabled"
                          checked={footerEnabled}
                          onCheckedChange={(checked) => {
                            setFooterEnabled(checked);
                            if (!checked) setTextBelow("");
                          }}
                          data-testid="switch-footer-text"
                        />
                      </div>
                    </div>
                    {footerEnabled && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Enter bottom text (max 30 chars)"
                          value={textBelow}
                          onChange={(e) => setTextBelow(e.target.value.slice(0, 30))}
                          maxLength={30}
                          className="qr-touch-48"
                          data-testid="input-text-below"
                        />
                        
                        {/* Font and Size */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Font</Label>
                            <FontPicker
                              value={footerFontFamily}
                              onChange={setFooterFontFamily}
                              fonts={renderConfig?.fonts || FONT_FAMILIES}
                              previewText={textBelow || "QR Gear"}
                              data-testid="select-footer-font"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Size</Label>
                            <select
                              className="w-full h-12 px-3 border rounded-md text-sm bg-background qr-touch-48"
                              value={footerFontSize}
                              onChange={(e) => setFooterFontSize(e.target.value)}
                              data-testid="select-footer-size"
                            >
                              {[72, 96, 120, 144, 168, 192, 216, 240, 280, 320].map((size) => (
                                <option key={size} value={String(size)}>{size}pt</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        {/* Color and Warp */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Color</Label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={footerColor}
                                onChange={(e) => setFooterColor(e.target.value)}
                                className="w-12 h-12 border rounded-md cursor-pointer qr-touch-48"
                                data-testid="input-footer-color"
                              />
                              <Input
                                value={footerColor}
                                onChange={(e) => setFooterColor(e.target.value)}
                                className="flex-1 font-mono text-xs qr-touch-48"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Warp Style</Label>
                            <select
                              className="w-full h-12 px-3 border rounded-md text-sm bg-background qr-touch-48"
                              value={footerWarp}
                              onChange={(e) => setFooterWarp(e.target.value)}
                              data-testid="select-footer-warp"
                            >
                              {(renderConfig?.warpPresets || [
                                { value: 'straight', label: 'Straight' },
                                { value: 'arc-up', label: 'Arc Up' },
                                { value: 'arc-down', label: 'Arc Down' },
                              ]).map((preset) => (
                                <option key={preset.value} value={preset.value}>{preset.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        {/* Letter Spacing */}
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Letter Spacing: {footerLetterSpacing}px
                          </Label>
                          <input
                            type="range"
                            min="-10"
                            max="50"
                            value={footerLetterSpacing}
                            onChange={(e) => setFooterLetterSpacing(Number(e.target.value))}
                            className="w-full h-6 accent-primary cursor-pointer qr-touch-48"
                            data-testid="slider-footer-spacing"
                          />
                        </div>
                        
                        {/* Stroke/Outline */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Stroke Color</Label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={footerStrokeColor || "#ffffff"}
                                onChange={(e) => setFooterStrokeColor(e.target.value)}
                                className="w-12 h-12 border rounded-md cursor-pointer qr-touch-48"
                                data-testid="input-footer-stroke-color"
                              />
                              <Input
                                value={footerStrokeColor}
                                onChange={(e) => setFooterStrokeColor(e.target.value)}
                                className="flex-1 font-mono text-xs qr-touch-48"
                                placeholder="None"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Stroke Width: {footerStrokeWidth}px</Label>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              value={footerStrokeWidth}
                              onChange={(e) => setFooterStrokeWidth(Number(e.target.value))}
                              className="w-full h-6 accent-primary cursor-pointer mt-3 qr-touch-48"
                              data-testid="slider-footer-stroke"
                            />
                          </div>
                        </div>
                        
                        {/* Preview */}
                        {textBelow && (
                          <div className="p-3 bg-background rounded-md border text-center overflow-hidden">
                            <div 
                              style={{ 
                                fontFamily: footerFontFamily, 
                                fontSize: `${Math.min(parseInt(footerFontSize) * 0.2, 36)}px`,
                                color: footerColor,
                                letterSpacing: `${footerLetterSpacing * 0.1}px`,
                                textShadow: footerStrokeColor && footerStrokeWidth > 0 
                                  ? `0 0 ${footerStrokeWidth}px ${footerStrokeColor}` 
                                  : undefined,
                                fontWeight: 'bold',
                              }}
                            >
                              {textBelow}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Warp: {renderConfig?.warpPresets?.find(p => p.value === footerWarp)?.label || footerWarp}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {priceQuote && (hasTextAbove || hasTextBelow) && (
                    <p className="text-xs text-muted-foreground">
                      Text adds +${(priceQuote.breakdown.textAboveUpcharge + priceQuote.breakdown.textBelowUpcharge).toFixed(2)} to your order
                    </p>
                  )}
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
