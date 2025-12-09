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
import UsaFlag from "@/components/UsaFlag";
import { Upload, ImageIcon, Loader2, Palette } from "lucide-react";
import ImageDesigner from "@/components/ImageDesigner";
import type { Product } from "@shared/schema";

const placements = [
  { value: "front-chest", label: "Front Chest" },
  { value: "front-pocket", label: "Front Pocket" },
  { value: "back", label: "Back" },
  { value: "left-shoulder", label: "Left Shoulder" },
  { value: "right-shoulder", label: "Right Shoulder" },
];

const TEXT_UPCHARGE = 2.00;
const IMAGE_HOSTING_UPCHARGE = 5.00;
const DESIGN_UPCHARGE = 8.00;

export default function Creator() {
  const { toast } = useToast();
  const [qrType, setQrType] = useState<"text" | "image" | "upload" | "design">("text");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track if we need to regenerate after current mutation completes
  const pendingRegenRef = useRef(false);
  const lastGeneratedRef = useRef({ content: "", type: "", color: "", bgColor: "" });

  const { data: products = [], isLoading: productsLoading, isError: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"],
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

    // For image, upload, and design types, validate URL before generating
    if ((qrType === "image" || qrType === "upload" || qrType === "design") && !isValidURL(qrContent)) {
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
      type: (qrType === "upload" || qrType === "design") ? "image" : qrType,
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
  const textUpchargeTotal = (hasTextAbove ? TEXT_UPCHARGE : 0) + (hasTextBelow ? TEXT_UPCHARGE : 0);
  const imageHostingUpcharge = qrType === "upload" && uploadedImage ? IMAGE_HOSTING_UPCHARGE : 0;
  const designUpcharge = qrType === "design" && uploadedImage ? DESIGN_UPCHARGE : 0;
  const totalPrice = selectedProduct ? (parseFloat(selectedProduct.basePrice) + textUpchargeTotal + imageHostingUpcharge + designUpcharge).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
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
                  setQrType(v as "text" | "image" | "upload" | "design");
                  if (v !== "upload" && v !== "design") {
                    setQrContent("");
                    setUploadedImage(null);
                  }
                }}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="text" data-testid="tab-qr-text">Text</TabsTrigger>
                    <TabsTrigger value="image" data-testid="tab-qr-image">URL</TabsTrigger>
                    <TabsTrigger value="upload" data-testid="tab-qr-upload" className="flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="design" data-testid="tab-qr-design" className="flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      Design
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
                          <Badge variant="outline" className="text-xs">+${IMAGE_HOSTING_UPCHARGE.toFixed(2)}</Badge>
                          <span className="text-sm">Image hosting included for 1 year</span>
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
                            }}
                            data-testid="button-remove-upload"
                          >
                            Remove
                          </Button>
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
                      <Badge variant="outline" className="text-xs">+${TEXT_UPCHARGE.toFixed(2)} each</Badge>
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
                    
                    {(hasTextAbove || hasTextBelow) && (
                      <p className="text-xs text-muted-foreground">
                        Text adds +${textUpchargeTotal.toFixed(2)} to your order
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
                disabled={!qrCodeImage || !selectedProduct}
                data-testid="button-add-to-cart"
              >
                Add to Cart - ${totalPrice}
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
          <div className="lg:sticky lg:top-24 h-fit">
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>See your design come to life</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                  {selectedProduct?.imageUrl && (
                    <img
                      src={selectedProduct.imageUrl}
                      alt="Product preview"
                      className="absolute inset-0 w-full h-full object-cover opacity-30"
                    />
                  )}
                  {qrCodeImage ? (
                    <div className="relative z-10 bg-white p-4 rounded-lg shadow-lg text-center">
                      {hasTextAbove && (
                        <p className="text-sm font-bold text-black mb-2 tracking-wide" data-testid="preview-text-above">
                          {textAbove}
                        </p>
                      )}
                      <img
                        src={qrCodeImage}
                        alt="QR Code Preview"
                        className="w-48 h-48 mx-auto"
                      />
                      {hasTextBelow && (
                        <p className="text-sm font-bold text-black mt-2 tracking-wide" data-testid="preview-text-below">
                          {textBelow}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {placement.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <p className="font-semibold mb-1">No QR Code Yet</p>
                      <p className="text-sm">Enter content to see preview</p>
                    </div>
                  )}
                </div>

                {selectedProduct && productColor && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-sm">
                      <span className="font-semibold">{selectedProduct.name}</span> in{" "}
                      <span className="font-semibold">{productColor}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      QR Code on {placement.replace("-", " ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
