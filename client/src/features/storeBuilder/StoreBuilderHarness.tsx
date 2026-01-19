import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Store, Building2, Globe, ChevronRight, ChevronDown, Loader2, Package, QrCode, Link as LinkIcon, Palette, Ruler, Maximize2, X, Check, ArrowLeft, Library, Smartphone } from "lucide-react";
import { ARPreviewModal } from "@/features/shared/components/ARPreviewModal";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import type { PartnerStore } from "@shared/schema";

const COLOR_HEX_MAP: Record<string, string> = {
  "White": "#FFFFFF", "Black": "#000000", "Navy": "#1F2937", "Navy Blue": "#1F2937",
  "Red": "#DC2626", "Blue": "#2563EB", "Royal Blue": "#1D4ED8", "Light Blue": "#93C5FD",
  "Green": "#16A34A", "Forest Green": "#166534", "Yellow": "#FBBF24", "Gold": "#F59E0B",
  "Orange": "#EA580C", "Pink": "#EC4899", "Purple": "#9333EA", "Gray": "#6B7280",
  "Grey": "#6B7280", "Charcoal": "#374151", "Brown": "#92400E", "Tan": "#D4A574",
  "Maroon": "#7F1D1D", "Burgundy": "#881337", "Teal": "#0D9488", "Aqua": "#22D3D1",
  "Heather Gray": "#9CA3AF", "Heather Grey": "#9CA3AF", "Sport Grey": "#9CA3AF",
  "Dark Heather": "#4B5563", "Ash": "#D1D5DB", "Natural": "#F5F5DC", "Cream": "#FFFDD0",
  "Sand": "#C2B280", "Olive": "#556B2F", "Kelly Green": "#22C55E", "Irish Green": "#22C55E",
  "Cardinal": "#B91C1C", "Safety Orange": "#FF6600", "Safety Green": "#84CC16",
};

function getColorHex(color: { name: string; hex?: string }): string {
  if (color.hex && color.hex.trim() !== "") return color.hex;
  const normalized = color.name.trim();
  if (COLOR_HEX_MAP[normalized]) return COLOR_HEX_MAP[normalized];
  const lowerName = normalized.toLowerCase();
  for (const [key, value] of Object.entries(COLOR_HEX_MAP)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  return "#CCCCCC";
}

interface ProductColor {
  hex: string;
  name: string;
}

interface ProductPackage {
  packetId?: string;
  templateId?: string;
  graphicsId?: string;
  productId?: string;
  qrContent?: string;
  productName?: string;
  productDescription?: string;
  productImageUrl?: string;
  compositeUrl?: string;
  qrOnlyUrl?: string;
  headerText?: string;
  footerText?: string;
  colors?: ProductColor[];
  sizes?: string[];
  qrSizes?: string[];
  availablePlacements?: string[];
  placements?: string[];
  basePrice?: string;
  customerPrice?: string;
  qrProductState?: string;
  blueprintId?: number;
  printProviderId?: number;
  manufacturer?: string;
  madeIn?: string;
  defaultColor?: string;
  defaultColorHex?: string;
  placementSizes?: Record<string, string>;
  priorityMockupUrl?: string | null;
  pricing?: {
    baseProductCost: number;
    placementCost: number;
    textUpcharge: number;
    hostingCost: number;
    subtotal: number;
    markupAmount: number;
    customerPrice: number;
    hostingTierCode?: string;
  };
}

interface ProductConfiguration {
  enabledColors: Set<string>;
  enabledSizes: Set<string>;
  selectedGraphicSize: string;
  defaultColor: string;
}

interface MockupJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  color?: string;
  size?: string;
  placement?: string;
  mockupUrl?: string | null;
  error?: string | null;
}

type StoreType = "internal" | "external" | null;

function CollapsibleSection({ 
  title, 
  icon, 
  defaultOpen = false, 
  children 
}: { 
  title: string; 
  icon?: React.ReactNode;
  defaultOpen?: boolean; 
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover-elevate"
        data-testid={`collapse-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="p-3 border-t">
          {children}
        </div>
      )}
    </div>
  );
}

function HeroImageLightbox({
  isOpen,
  onClose,
  productPackage,
  configuration,
  mockups,
  onSelectColor,
  onSelectGraphicSize,
}: {
  isOpen: boolean;
  onClose: () => void;
  productPackage: ProductPackage | null;
  configuration: ProductConfiguration;
  mockups: MockupJob[];
  onSelectColor: (color: string) => void;
  onSelectGraphicSize: (size: string) => void;
}) {
  if (!isOpen || !productPackage) return null;

  const availableColors = productPackage.colors || [];
  const graphicSizes = ["small", "medium", "large"];
  
  const currentMockup = mockups.find(
    m => m.status === "completed" && 
         m.mockupUrl && 
         m.color === configuration.defaultColor
  );

  const previewUrl = currentMockup?.mockupUrl || productPackage.productImageUrl || productPackage.compositeUrl;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-background rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Set Hero Image</h3>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-lightbox">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt="Hero preview" 
                className="w-full h-full object-contain"
                data-testid="img-hero-preview"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Mockup generating...</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-2">Default Color</p>
              <div className="flex flex-wrap gap-2">
                {availableColors.map(color => (
                  <button
                    key={color.name}
                    onClick={() => onSelectColor(color.name)}
                    className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                      configuration.defaultColor === color.name
                        ? "ring-2 ring-offset-2 ring-primary border-primary"
                        : "border-muted hover:border-primary/50"
                    }`}
                    style={{ backgroundColor: getColorHex(color) }}
                    title={color.name}
                    data-testid={`lightbox-color-${color.name}`}
                  >
                  </button>
                ))}
              </div>
              {configuration.defaultColor && (
                <p className="text-xs text-muted-foreground mt-1">Selected: {configuration.defaultColor}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Graphic Size</p>
              <div className="flex gap-2">
                {graphicSizes.map(size => (
                  <Button
                    key={size}
                    variant={configuration.selectedGraphicSize === size ? "default" : "outline"}
                    size="sm"
                    className="capitalize flex-1"
                    onClick={() => onSelectGraphicSize(size)}
                    data-testid={`lightbox-graphic-${size}`}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t">
          <Button className="w-full" onClick={onClose} data-testid="button-confirm-hero">
            <Check className="h-4 w-4 mr-2" />
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StoreBuilderHarness() {
  const { apiBase } = useAdminAuth();
  const [, navigate] = useLocation();
  const [productPackage, setProductPackage] = useState<ProductPackage | null>(null);
  const [originalPacketId, setOriginalPacketId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPacket, setIsLoadingPacket] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [arPreviewOpen, setArPreviewOpen] = useState(false);
  const [selectedStoreType, setSelectedStoreType] = useState<StoreType>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const [configuration, setConfiguration] = useState<ProductConfiguration>({
    enabledColors: new Set<string>(),
    enabledSizes: new Set<string>(),
    selectedGraphicSize: "medium",
    defaultColor: "",
  });

  const { data: mockupsData } = useQuery<{
    success: boolean;
    summary: { total: number; completed: number; pending: number; processing: number; failed: number };
    mockups: MockupJob[];
  }>({
    queryKey: ["/api/test/templates", productPackage?.templateId, "mockups"],
    queryFn: async () => {
      if (!productPackage?.templateId) return { success: false, summary: { total: 0, completed: 0, pending: 0, processing: 0, failed: 0 }, mockups: [] };
      const res = await fetch(`/api/test/templates/${productPackage.templateId}/mockups`);
      return res.json();
    },
    enabled: !!productPackage?.templateId,
    refetchInterval: 10000,
  });

  const mockups = mockupsData?.mockups || [];

  const { data: stores = [] } = useQuery<PartnerStore[]>({
    queryKey: [`${apiBase}/partner-stores`],
  });

  useEffect(() => {
    if (selectedStoreId && stores.length > 0 && !selectedStoreType) {
      const store = stores.find(s => s.id === selectedStoreId);
      if (store) {
        setSelectedStoreType(store.isInternal ? "internal" : "external");
      }
    }
  }, [selectedStoreId, stores, selectedStoreType]);

  useEffect(() => {
    if (productPackage) {
      const colors = productPackage.colors?.map(c => c.name) || [];
      const sizes = productPackage.sizes || [];
      const packetDefaultColor = (productPackage as any).defaultColor;
      const resolvedDefaultColor = packetDefaultColor && colors.includes(packetDefaultColor) 
        ? packetDefaultColor 
        : colors[0] || "";
      
      setConfiguration({
        enabledColors: new Set(colors),
        enabledSizes: new Set(sizes),
        selectedGraphicSize: (productPackage as any).placementSizes?.front || "medium",
        defaultColor: resolvedDefaultColor,
      });
    }
  }, [productPackage]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const packetId = urlParams.get("packetId");
    const urlStoreId = urlParams.get("storeId");
    const urlChannel = urlParams.get("channel");
    
    if (urlStoreId) {
      setSelectedStoreId(urlStoreId);
    }
    if (urlChannel) {
      setSelectedChannel(urlChannel);
    }
    
    if (packetId) {
      setIsLoadingPacket(true);
      setOriginalPacketId(packetId);
      setIsEditMode(true);
      fetch(`/api/test/packets/${packetId}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data.success && data.packet) {
            const packet = data.packet;
            const loadedPackage: ProductPackage = {
              packetId: packet.id,
              templateId: packet.templateId || null,
              qrContent: packet.qrContent,
              productName: packet.productName,
              productDescription: packet.productDescription,
              productImageUrl: packet.productImageUrl,
              compositeUrl: packet.compositeUrl,
              qrOnlyUrl: packet.qrOnlyUrl,
              headerText: packet.headerText,
              footerText: packet.footerText,
              colors: packet.colors || [],
              sizes: packet.sizes || [],
              qrSizes: packet.qrSizes || ["small", "medium", "large"],
              availablePlacements: packet.availablePlacements || [],
              placements: packet.placements || [],
              basePrice: packet.basePrice,
              customerPrice: packet.customerPrice,
              qrProductState: packet.qrProductState,
              blueprintId: packet.blueprintId,
              printProviderId: packet.printProviderId,
              pricing: packet.pricing,
              manufacturer: packet.manufacturer || "Printify",
              madeIn: packet.madeIn || "USA",
              defaultColor: packet.defaultColor,
              defaultColorHex: packet.defaultColorHex,
              placementSizes: packet.placementSizes,
              priorityMockupUrl: packet.priorityMockupUrl || null,
            };
            setProductPackage(loadedPackage);
            
            // Priority mockup should already be in the packet from Create Packet flow
            // Only generate if missing (legacy packets)
            if (!packet.priorityMockupUrl && packet.blueprintId && packet.compositeUrl) {
              console.log("[StoreBuilder] Priority mockup not in packet, generating...");
              const placement = (packet.placements || ["front"])[0];
              const colorName = packet.defaultColor || (packet.colors?.[0]?.name) || "Black";
              const colorHex = packet.defaultColorHex || (packet.colors?.[0]?.hex) || "#000000";
              const qrSize = packet.placementSizes?.[placement] || "medium";
              
              fetch("/api/test/mockup/priority", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  blueprintId: packet.blueprintId,
                  printProviderId: packet.printProviderId || 99,
                  colorName,
                  colorHex,
                  placement: placement + "-center",
                  artworkUrl: packet.compositeUrl,
                  qrSize,
                }),
              })
                .then(res => res.json())
                .then(mockupData => {
                  if (mockupData.success && mockupData.mockupUrl) {
                    setProductPackage(prev => prev ? { ...prev, priorityMockupUrl: mockupData.mockupUrl } : prev);
                  }
                })
                .catch(() => {});
            } else if (packet.priorityMockupUrl) {
              console.log("[StoreBuilder] Priority mockup loaded from packet:", packet.priorityMockupUrl);
            }
          }
        })
        .catch(err => {
          console.error("Failed to load packet:", err);
          setSaveStatus({ type: "error", message: `Failed to load packet: ${err.message}` });
        })
        .finally(() => {
          setIsLoadingPacket(false);
        });
      return;
    }

    const savedPackage = sessionStorage.getItem("productPackage");
    if (savedPackage) {
      try {
        const parsed = JSON.parse(savedPackage);
        if (!parsed.templateId && !parsed.graphicsId && !parsed.packetId) {
          sessionStorage.removeItem("productPackage");
          setProductPackage(null);
        } else {
          setProductPackage(parsed);
        }
      } catch (e) {
        console.error("Failed to parse product package:", e);
        sessionStorage.removeItem("productPackage");
      }
    }
  }, []);

  const currentMockup = mockups.find(
    m => m.status === "completed" && 
         m.mockupUrl && 
         m.color === configuration.defaultColor
  );

  // Priority: priority mockup > template mockup > product image > composite
  const previewImageUrl = productPackage?.priorityMockupUrl || currentMockup?.mockupUrl || productPackage?.productImageUrl || productPackage?.compositeUrl;

  const packetThumbnails = [
    productPackage?.compositeUrl,
    productPackage?.qrOnlyUrl,
    productPackage?.productImageUrl,
  ].filter(Boolean) as string[];

  const toggleColor = (colorName: string) => {
    const newColors = new Set(configuration.enabledColors);
    if (newColors.has(colorName)) {
      if (newColors.size > 1) newColors.delete(colorName);
    } else {
      newColors.add(colorName);
    }
    let newDefault = configuration.defaultColor;
    if (!newColors.has(newDefault)) {
      newDefault = Array.from(newColors)[0] || "";
    }
    setConfiguration(prev => ({ ...prev, enabledColors: newColors, defaultColor: newDefault }));
  };

  const toggleSize = (size: string) => {
    const newSizes = new Set(configuration.enabledSizes);
    if (newSizes.has(size)) {
      if (newSizes.size > 1) newSizes.delete(size);
    } else {
      newSizes.add(size);
    }
    setConfiguration(prev => ({ ...prev, enabledSizes: newSizes }));
  };

  const setDefaultColor = (color: string) => {
    setConfiguration(prev => {
      const newEnabledColors = new Set(prev.enabledColors);
      if (!newEnabledColors.has(color)) {
        newEnabledColors.add(color);
      }
      return { ...prev, defaultColor: color, enabledColors: newEnabledColors };
    });
  };

  const setGraphicSize = (size: string) => {
    setConfiguration(prev => ({ ...prev, selectedGraphicSize: size }));
  };

  const filteredStores = stores.filter((store) => {
    if (selectedStoreType === "internal") return store.isInternal === true;
    if (selectedStoreType === "external") return store.isInternal === false;
    return true;
  });

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const channels = selectedStore?.availableSegments || [];

  const handleAssign = async () => {
    if (!productPackage || !selectedStore || !selectedChannel) return;

    if (!productPackage.packetId && !productPackage.templateId && !productPackage.graphicsId) {
      setSaveStatus({
        type: "error",
        message: "Package missing IDs. Please use 'Create Graphics' in Products Builder first.",
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      let currentPacketId = productPackage.packetId;
      let templateId = productPackage.templateId;
      let wasForked = false; // Track if we forked for success message
      
      // Fork-on-edit: When editing an existing packet from library, create a NEW packet
      // This preserves the original and creates a new version
      if (isEditMode && originalPacketId) {
        console.log("[StoreBuilder] Edit mode - creating new packet (fork from:", originalPacketId, ")");
        
        const packetResponse = await fetch("/api/test/packets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrOnlyUrl: productPackage.qrOnlyUrl,
            compositeUrl: productPackage.compositeUrl,
            qrContent: productPackage.qrContent,
            headerText: productPackage.headerText,
            footerText: productPackage.footerText,
            pricing: productPackage.pricing,
            productName: productPackage.productName,
            productDescription: productPackage.productDescription,
            productImageUrl: productPackage.productImageUrl,
            blueprintId: productPackage.blueprintId,
            printProviderId: productPackage.printProviderId,
            manufacturer: productPackage.manufacturer,
            qrProductState: productPackage.qrProductState,
            placements: productPackage.placements,
            availablePlacements: productPackage.availablePlacements,
            sizes: productPackage.sizes,
            colors: productPackage.colors,
            basePrice: productPackage.basePrice,
            customerPrice: productPackage.customerPrice,
            forkedFrom: originalPacketId,
          }),
        });

        if (packetResponse.ok) {
          const packetData = await packetResponse.json();
          currentPacketId = packetData.packetId;
          templateId = undefined; // New packet needs new template
          console.log("[StoreBuilder] Created forked packet:", currentPacketId);
          
          // Update local state to use new packet ID and clear old template reference
          setProductPackage(prev => prev ? { 
            ...prev, 
            packetId: currentPacketId,
            templateId: undefined, // Clear old template - new one will be created below
          } : null);
          // Clear edit mode since we now have a fresh packet
          setIsEditMode(false);
          setOriginalPacketId(null);
          wasForked = true;
        } else {
          // Fork is mandatory - do NOT fall back to original packet
          const errorData = await packetResponse.json().catch(() => ({}));
          throw new Error(`Failed to create new version: ${errorData.error || 'Unknown error'}`);
        }
      }
      
      // Create template if needed
      if (currentPacketId && !templateId) {
        const templateResponse = await fetch("/api/test/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packetId: currentPacketId,
            name: productPackage.productName || `Template - ${new Date().toLocaleDateString()}`,
            productId: productPackage.productId,
            blueprintId: productPackage.blueprintId,
            printProviderId: productPackage.printProviderId,
            artworkUrl: productPackage.compositeUrl,
            thumbnailUrl: productPackage.compositeUrl,
            qrContent: productPackage.qrContent,
            pricing: productPackage.pricing,
            selectedSize: configuration.selectedGraphicSize,
            enabledColors: Array.from(configuration.enabledColors),
            enabledSizes: Array.from(configuration.enabledSizes),
            defaultColor: configuration.defaultColor,
            isActive: true,
          }),
        });

        if (templateResponse.ok) {
          const templateData = await templateResponse.json();
          templateId = templateData.templateId;
          console.log("[StoreBuilder] Created template:", templateId);
          // Update state with new templateId for mockup polling
          setProductPackage(prev => prev ? { ...prev, templateId } : null);
        } else {
          console.warn("[StoreBuilder] Template creation failed, continuing with store link");
        }
      }

      const response = await fetch("/api/test/store-product-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: selectedStore.id,
          storeName: selectedStore.name,
          channel: selectedChannel,
          packetId: currentPacketId,
          templateId: templateId,
          graphicsId: productPackage.graphicsId,
          qrContent: productPackage.qrContent,
          productName: productPackage.productName,
          compositeUrl: productPackage.compositeUrl,
          qrOnlyUrl: productPackage.qrOnlyUrl,
          pricing: productPackage.pricing,
          enabledColors: Array.from(configuration.enabledColors),
          enabledSizes: Array.from(configuration.enabledSizes),
          selectedGraphicSize: configuration.selectedGraphicSize,
          defaultColor: configuration.defaultColor,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign to store");
      }

      const successMsg = wasForked 
        ? `New version created and linked to ${selectedStore.name} / ${selectedChannel}`
        : `Linked to ${selectedStore.name} / ${selectedChannel}`;
      
      setSaveStatus({
        type: "success",
        message: successMsg,
      });
      
      sessionStorage.removeItem("productPackage");
      
      if (selectedStore?.id && selectedChannel) {
        setTimeout(() => {
          navigate(`/test-stores?storeId=${selectedStore.id}&channel=${encodeURIComponent(selectedChannel)}`);
        }, 1000);
      }
    } catch (error: any) {
      setSaveStatus({
        type: "error",
        message: error.message || "Failed to assign to store",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingPacket) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-3">Loading package...</span>
      </div>
    );
  }

  if (!productPackage) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Product Package Loaded</h3>
          <p className="text-muted-foreground">
            Save a product from the Products Builder first, then return here.
          </p>
        </div>
      </Card>
    );
  }

  const storeOptions = filteredStores.map(store => ({
    value: store.id,
    label: store.name,
    icon: <Store className="h-4 w-4 flex-shrink-0" />,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/test-products")}
          data-testid="button-back-builder"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/test-library?tab=graphics")}
            data-testid="link-graphics-library"
          >
            <QrCode className="h-4 w-4 mr-1" />
            Graphics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/test-library?tab=templates")}
            data-testid="link-templates-library"
          >
            <Library className="h-4 w-4 mr-1" />
            Templates
          </Button>
        </div>
      </div>

      {isEditMode && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200" data-testid="text-edit-mode-warning">
            <strong>Edit Mode:</strong> Saving will create a new version. Original will remain unchanged.
          </p>
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-3 p-3">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="w-full aspect-square bg-muted rounded-lg overflow-hidden hover-elevate relative group"
              data-testid="button-open-lightbox"
            >
              {previewImageUrl ? (
                <img 
                  src={previewImageUrl} 
                  alt="Product preview" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-sm font-medium">Tap to set hero</span>
              </div>
            </button>
            
            {packetThumbnails.length > 0 && (
              <div className="flex gap-1">
                {packetThumbnails.slice(0, 3).map((url, idx) => (
                  <div 
                    key={idx} 
                    className="flex-1 aspect-square bg-muted rounded overflow-hidden border"
                  >
                    <img 
                      src={url} 
                      alt="" 
                      className="w-full h-full object-contain"
                      data-testid={`thumb-${idx}`}
                    />
                  </div>
                ))}
              </div>
            )}
            
            {previewImageUrl && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setArPreviewOpen(true)}
                data-testid="button-ar-preview"
              >
                <Smartphone className="h-4 w-4 mr-2" />
                View in AR
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-base leading-tight" data-testid="text-product-name">
              {productPackage.productName || "Untitled Product"}
            </h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><span className="font-medium">Brand:</span> Plus</p>
              <p><span className="font-medium">Fulfillment:</span> Printify</p>
              <p><span className="font-medium">Made in:</span> {productPackage.madeIn || "USA"}</p>
            </div>
            {productPackage.qrProductState && (
              <Badge variant="secondary" className="text-xs">
                {productPackage.qrProductState.replace('qr_', '').toUpperCase()}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        {productPackage.qrContent && (
          <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/50 rounded-md">
            <LinkIcon className="h-4 w-4 flex-shrink-0 text-blue-600 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">URL</p>
              <p className="text-sm font-mono break-all" data-testid="text-url">
                {productPackage.qrContent}
              </p>
            </div>
          </div>
        )}
        
        {productPackage.headerText && (
          <div className="p-2 bg-muted/50 rounded-md">
            <p className="text-xs font-medium text-muted-foreground">Header</p>
            <p className="text-sm" data-testid="text-header">{productPackage.headerText}</p>
          </div>
        )}
        
        {productPackage.footerText && (
          <div className="p-2 bg-muted/50 rounded-md">
            <p className="text-xs font-medium text-muted-foreground">Footer</p>
            <p className="text-sm" data-testid="text-footer">{productPackage.footerText}</p>
          </div>
        )}
      </Card>

      {productPackage.pricing && (
        <Card className="p-3">
          <h3 className="font-medium text-sm mb-2">Pricing</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Base Price</span>
              <span>${productPackage.pricing.baseProductCost.toFixed(2)}</span>
            </div>
            {productPackage.pricing.placementCost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Placements</span>
                <span>+${productPackage.pricing.placementCost.toFixed(2)}</span>
              </div>
            )}
            {productPackage.pricing.textUpcharge > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Text</span>
                <span>+${productPackage.pricing.textUpcharge.toFixed(2)}</span>
              </div>
            )}
            {productPackage.pricing.hostingCost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Hosting</span>
                <span>+${productPackage.pricing.hostingCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1">
              <span>Subtotal</span>
              <span>${productPackage.pricing.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Markup</span>
              <span>+${productPackage.pricing.markupAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold text-green-700 dark:text-green-400">
              <span>Customer Price</span>
              <span>${productPackage.pricing.customerPrice.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      )}

      <CollapsibleSection
        title="Graphic Size"
        icon={<Maximize2 className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="flex gap-2">
          {["small", "medium", "large"].map(size => (
            <Button
              key={size}
              variant={configuration.selectedGraphicSize === size ? "default" : "outline"}
              size="sm"
              className="flex-1 capitalize"
              onClick={() => setGraphicSize(size)}
              data-testid={`graphic-size-${size}`}
            >
              {size}
            </Button>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Item Sizes"
        icon={<Ruler className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          {(productPackage.sizes || []).map(size => (
            <div 
              key={size}
              className="flex items-center justify-between p-2 rounded-md bg-muted/30"
            >
              <span className="font-medium text-sm">{size}</span>
              <Switch
                checked={configuration.enabledSizes.has(size)}
                onCheckedChange={() => toggleSize(size)}
                data-testid={`toggle-size-${size}`}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Colors"
        icon={<Palette className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          {(productPackage.colors || []).map(color => (
            <div 
              key={color.name}
              className="flex items-center justify-between p-2 rounded-md bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: getColorHex(color) }}
                />
                <span className="font-medium text-sm">{color.name}</span>
              </div>
              <Switch
                checked={configuration.enabledColors.has(color.name)}
                onCheckedChange={() => toggleColor(color.name)}
                data-testid={`toggle-color-${color.name}`}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Assign to Store"
        icon={<Store className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={selectedStoreType === "internal" ? "default" : "outline"}
              size="sm"
              className="h-auto py-3 flex-col gap-1"
              onClick={() => {
                setSelectedStoreType("internal");
                setSelectedStoreId(null);
                setSelectedChannel(null);
              }}
              data-testid="store-type-internal"
            >
              <Building2 className="h-5 w-5" />
              <span>Internal</span>
            </Button>
            <Button
              variant={selectedStoreType === "external" ? "default" : "outline"}
              size="sm"
              className="h-auto py-3 flex-col gap-1"
              onClick={() => {
                setSelectedStoreType("external");
                setSelectedStoreId(null);
                setSelectedChannel(null);
              }}
              data-testid="store-type-external"
            >
              <Globe className="h-5 w-5" />
              <span>External</span>
            </Button>
          </div>

          {selectedStoreType && (
            <CustomDropdown
              value={selectedStoreId || ""}
              onChange={(val) => {
                setSelectedStoreId(val);
                setSelectedChannel(null);
              }}
              options={storeOptions}
              placeholder="Select a store..."
              data-testid="store-select"
            />
          )}

          {selectedStore && channels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {channels.map((channel) => (
                <Badge
                  key={channel}
                  variant={selectedChannel === channel ? "default" : "outline"}
                  className={`cursor-pointer h-8 px-3 ${
                    selectedChannel === channel ? "" : "hover-elevate"
                  }`}
                  onClick={() => setSelectedChannel(channel)}
                  data-testid={`channel-${channel}`}
                >
                  {channel}
                </Badge>
              ))}
            </div>
          )}

          {selectedStore && selectedChannel && (
            <Button
              className="w-full"
              onClick={handleAssign}
              disabled={isSaving}
              data-testid="button-assign"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Assign to {selectedChannel}
                </>
              )}
            </Button>
          )}
        </div>
      </CollapsibleSection>

      {saveStatus && (
        <div
          className={`p-3 rounded-md border flex items-center gap-2 ${
            saveStatus.type === "success"
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
          }`}
          data-testid="store-save-status"
        >
          <span className="text-sm font-medium">{saveStatus.message}</span>
        </div>
      )}

      <HeroImageLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        productPackage={productPackage}
        configuration={configuration}
        mockups={mockups}
        onSelectColor={setDefaultColor}
        onSelectGraphicSize={setGraphicSize}
      />

      <ARPreviewModal
        isOpen={arPreviewOpen}
        onClose={() => setArPreviewOpen(false)}
        imageUrl={previewImageUrl || ""}
        productName={productPackage.productName}
      />
    </div>
  );
}

export default StoreBuilderHarness;
