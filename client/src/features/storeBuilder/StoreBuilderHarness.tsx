import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Store, Building2, Globe, ChevronRight, ChevronDown, Loader2, Package, QrCode, Link as LinkIcon, Palette, Ruler, Maximize2, Check, Library, FolderOpen, Layers, RefreshCw, Plus } from "lucide-react";
import { ImageModalView } from "@/features/shared/components/views/ModalView";
import { TemplatePickerSkin } from "@/features/shared/components/skins";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { authFetch } from "@/features/adminAuth/authFetch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import type { PartnerStore } from "@shared/schema";
import { getColorHex, type ProductPackage, type ProductConfiguration, type MockupJob, type StoreType } from "./store-builder-types";
import { CollapsibleSection, HeroImageLightbox } from "./StoreBuilderComponents";
import { StoreBuilderAssignment } from "./StoreBuilderAssignment";
import { executeCreateStore, executeCreateChannel, executeAssign } from "./store-builder-actions";

export function StoreBuilderHarness() {
  const { apiBase, getAuthHeaders } = useAdminAuth();
  const [location, navigate] = useLocation();
  const [productPackage, setProductPackage] = useState<ProductPackage | null>(null);
  const [originalPacketId, setOriginalPacketId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPacket, setIsLoadingPacket] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [thumbnailLightbox, setThumbnailLightbox] = useState<string | null>(null);
  const [selectedStoreType, setSelectedStoreType] = useState<StoreType>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [existingCollections, setExistingCollections] = useState<string[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [originalConfiguration, setOriginalConfiguration] = useState<ProductConfiguration | null>(null);
  const [showAddStore, setShowAddStore] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [wantsToChangeDestination, setWantsToChangeDestination] = useState(false);
  
  const queryClient = useQueryClient();

  const fetchTemplates = useCallback(async () => {
    const res = await authFetch(`${apiBase}/templates`, getAuthHeaders);
    const data = await res.json();
    if (data.templates) {
      return data.templates.map((t: any) => ({
        id: t.id,
        name: t.name || t.productName || `Template ${t.id.slice(0, 6)}`,
        primaryImage: t.thumbnailUrl || t.artworkUrl || t.compositeUrl,
        secondaryImage: t.qrOnlyUrl,
        productName: t.productName,
        packetId: t.packetId,
        qrMode: t.qrMode || t.qrProductState,
        colorCount: t.colorCount || t.colors?.length,
        sizeCount: t.sizeCount || t.sizes?.length,
      }));
    }
    return [];
  }, [apiBase]);
  
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
    queryKey: [apiBase, "templates", productPackage?.templateId, "mockups"],
    queryFn: async () => {
      if (!productPackage?.templateId) return { success: false, summary: { total: 0, completed: 0, pending: 0, processing: 0, failed: 0 }, mockups: [] };
      const res = await authFetch(`${apiBase}/templates/${productPackage.templateId}/mockups`, getAuthHeaders);
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
      
      const initialConfig = {
        enabledColors: new Set(colors),
        enabledSizes: new Set(sizes),
        selectedGraphicSize: (productPackage as any).placementSizes?.front || "medium",
        defaultColor: resolvedDefaultColor,
      };
      
      setConfiguration(initialConfig);
      
      // Store original config only on first load (when originalConfiguration is null)
      if (isEditMode && !originalConfiguration) {
        setOriginalConfiguration(initialConfig);
      }
    }
  }, [productPackage, isEditMode, originalConfiguration]);

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
      setOriginalConfiguration(null); // Reset so new packet records its own baseline
      authFetch(`${apiBase}/packets/${packetId}`, getAuthHeaders)
        .then(res => res.json())
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
              // Destination from Products Builder
              destinationRoleType: packet.roleType || null,
              destinationStoreId: packet.storeId || null,
              destinationStoreName: packet.storeName || null,
              destinationChannelId: packet.channelId || null,
              destinationChannelName: packet.channelName || null,
            };
            setProductPackage(loadedPackage);
            
            // Pre-select store/channel from packet's destination if not already set via URL
            if (!urlStoreId && packet.storeId) {
              setSelectedStoreId(packet.storeId);
              // Set store type based on packet's roleType (internal/external/member)
              if (packet.roleType === "internal" || packet.roleType === "external") {
                setSelectedStoreType(packet.roleType as StoreType);
              }
            }
            if (!urlChannel && packet.channelName) {
              setSelectedChannel(packet.channelName);
            }
            
            // Auto-fetch collections when destination is pre-set
            if (packet.storeId && packet.channelName) {
              authFetch(`${apiBase}/stores/${packet.storeId}/channels/${packet.channelName}/collections`, getAuthHeaders)
                .then(res => res.json())
                .then(data => setExistingCollections(data.collections || []))
                .catch(() => setExistingCollections([]));
            }
            
            console.log("[StoreBuilder] Loaded destination from packet:", {
              roleType: packet.roleType,
              storeId: packet.storeId,
              storeName: packet.storeName,
              channelName: packet.channelName,
            });
            
            // Priority mockup should already be in the packet from Create Packet flow
            // Only generate if missing from packet
            if (!packet.priorityMockupUrl && packet.blueprintId && packet.compositeUrl) {
              console.log("[StoreBuilder] Priority mockup not in packet, generating...");
              const placement = (packet.placements || ["front"])[0];
              const colorName = packet.defaultColor || (packet.colors?.[0]?.name) || "Black";
              const colorHex = packet.defaultColorHex || (packet.colors?.[0]?.hex) || "#000000";
              const qrSize = packet.placementSizes?.[placement] || "medium";
              
              authFetch(`${apiBase}/mockup/priority`, getAuthHeaders, {
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

    // No packetId in URL - user should go to Products Builder first
    setProductPackage(null);
  }, [location, apiBase]);

  const currentMockup = mockups.find(
    m => m.status === "completed" && 
         m.mockupUrl && 
         m.color === configuration.defaultColor
  );

  // Priority: priority mockup > template mockup > product image > composite
  const previewImageUrl = productPackage?.priorityMockupUrl || currentMockup?.mockupUrl || productPackage?.productImageUrl || productPackage?.compositeUrl;

  const packetThumbnails = [
    { url: productPackage?.compositeUrl, useColorBg: true },
    { url: productPackage?.qrOnlyUrl, useColorBg: false },
    { url: productPackage?.productImageUrl, useColorBg: false },
  ].filter(t => t.url) as { url: string; useColorBg: boolean }[];
  
  const defaultColorHex = productPackage?.colors?.find(c => c.name === configuration.defaultColor)?.hex || 
    (productPackage?.defaultColorHex) ||
    getColorHex({ name: configuration.defaultColor || "White" });

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

  const handleCreateStore = async () => {
    setIsCreatingStore(true);
    try {
      const result = await executeCreateStore(apiBase, getAuthHeaders, newStoreName, selectedStoreType);
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/partner-stores`] });
      setNewStoreName("");
      setShowAddStore(false);
      if (result.id) {
        setSelectedStoreId(result.id);
        setSelectedChannel(null);
      }
    } catch (err: any) {
      setSaveStatus({ type: "error", message: err.message || "Failed to create store" });
    } finally {
      setIsCreatingStore(false);
    }
  };

  const handleCreateChannel = async () => {
    setIsCreatingChannel(true);
    try {
      const result = await executeCreateChannel(apiBase, getAuthHeaders, selectedStoreId!, newChannelName);
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/partner-stores`] });
      setNewChannelName("");
      setShowAddChannel(false);
      if (result.name) setSelectedChannel(result.name);
    } catch (err: any) {
      setSaveStatus({ type: "error", message: err.message || "Failed to create channel" });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleAssign = async () => {
    if (!productPackage || !selectedStore || !selectedChannel) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const result = await executeAssign({
        apiBase, getAuthHeaders, productPackage, selectedStore, selectedChannel,
        selectedCollection, configuration, isEditMode, originalPacketId, originalConfiguration,
      });
      if (!result.success) {
        setSaveStatus({ type: "error", message: result.message });
        return;
      }
      if (result.wasForked && result.newPacketId) {
        setProductPackage(prev => prev ? { ...prev, packetId: result.newPacketId, templateId: result.newTemplateId } : null);
        setIsEditMode(false);
        setOriginalPacketId(null);
      }
      if (result.newTemplateId) {
        setProductPackage(prev => prev ? { ...prev, templateId: result.newTemplateId } : null);
      }
      setSaveStatus({ type: "success", message: result.message });
    } catch (error: any) {
      setSaveStatus({ type: "error", message: error.message || "Failed to assign to store" });
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

  const handleTemplateSelect = (packetId: string) => {
    navigate(`/admin/store-builder?packetId=${packetId}`);
  };

  if (!productPackage) {
    return (
      <>
        <Card className="p-4">
          <div className="text-center py-6">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-base font-semibold mb-2">No Product Package Loaded</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Load from your library or create a new product.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setTemplatePickerOpen(true)}
                className="qr-btn qr-btn--primary qr-btn--xl qr-btn--full"
                data-testid="button-load-templates"
              >
                <Layers className="h-5 w-5" />
                Load Template
              </button>
              <button
                onClick={() => navigate("/admin/products")}
                className="qr-btn qr-btn--outline qr-btn--xl qr-btn--full"
                data-testid="button-go-products"
              >
                <Package className="h-5 w-5" />
                Create New in Products
              </button>
            </div>
          </div>
        </Card>
        <TemplatePickerSkin
          isOpen={templatePickerOpen}
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={handleTemplateSelect}
          fetchTemplates={fetchTemplates}
        />
      </>
    );
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        {productPackage?.packetId && (
          <button
            onClick={() => {
              const currentPacketId = productPackage.packetId;
              if (currentPacketId) {
                setProductPackage(null);
                setTimeout(() => {
                  navigate(`/admin/store-builder?packetId=${currentPacketId}`);
                }, 50);
              }
            }}
            className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
            data-testid="button-refresh-packet"
          >
            <RefreshCw className="h-5 w-5" />
            Refresh Packet
          </button>
        )}
        <button
          onClick={() => setTemplatePickerOpen(true)}
          className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full"
          data-testid="button-load-templates"
        >
          <Layers className="h-5 w-5" />
          Load Template
        </button>
      </div>

      {isEditMode && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200" data-testid="text-edit-mode-warning">
            <strong>Edit Mode:</strong> Saving will create a new version. Original will remain unchanged.
          </p>
        </div>
      )}

      {productPackage.destinationStoreName && productPackage.destinationChannelName && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-800 dark:text-blue-200" data-testid="text-built-for">
            <Store className="h-4 w-4 inline mr-1" />
            <strong>Built for:</strong> {productPackage.destinationStoreName} / {productPackage.destinationChannelName}
            {selectedStoreId === productPackage.destinationStoreId && 
             selectedChannel === productPackage.destinationChannelName && (
              <Badge variant="secondary" className="ml-2 text-xs">
                <Check className="h-3 w-3 mr-1" />
                Ready to assign
              </Badge>
            )}
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
                {packetThumbnails.slice(0, 3).map((thumb, idx) => (
                  <button
                    type="button" 
                    key={idx} 
                    className="flex-1 aspect-square rounded overflow-hidden border hover-elevate cursor-pointer"
                    style={{ backgroundColor: thumb.useColorBg ? defaultColorHex : '#f5f5f5' }}
                    onClick={() => setThumbnailLightbox(thumb.url)}
                    data-testid={`thumb-${idx}`}
                  >
                    <img 
                      src={thumb.url} 
                      alt="" 
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-base leading-tight" data-testid="text-product-name">
              {productPackage.productName || "Untitled Product"}
            </h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><span className="font-medium">Brand:</span> {productPackage.manufacturer || "Unknown"}</p>
              <p><span className="font-medium">Fulfillment:</span> {productPackage.printProviderId ? "Printify" : "TBD"}</p>
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
            <div className="flex justify-between font-semibold">
              <span>Provider Cost</span>
              <span className="text-base">${productPackage.pricing.baseProductCost.toFixed(2)}</span>
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
              <span className="font-medium">${productPackage.pricing.subtotal.toFixed(2)}</span>
            </div>
            <div className="bg-muted/50 rounded px-2 py-1 -mx-1 space-y-1">
              <div className="flex justify-between">
                <span>Your Markup</span>
                <span className="font-bold">{productPackage.pricing.markupPercent || 0}%</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Calculated</span>
                <span>+${productPackage.pricing.markupAmount.toFixed(2)}</span>
              </div>
              {(productPackage.pricing.markupFixed || 0) > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fixed markup</span>
                  <span>+${productPackage.pricing.markupFixed.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between border-t pt-1 font-bold text-base">
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
        <StoreBuilderAssignment
          productPackage={productPackage}
          selectedStoreType={selectedStoreType}
          selectedStoreId={selectedStoreId}
          selectedChannel={selectedChannel}
          selectedCollection={selectedCollection}
          existingCollections={existingCollections}
          isSaving={isSaving}
          wantsToChangeDestination={wantsToChangeDestination}
          showAddStore={showAddStore}
          showAddChannel={showAddChannel}
          newStoreName={newStoreName}
          newChannelName={newChannelName}
          isCreatingStore={isCreatingStore}
          isCreatingChannel={isCreatingChannel}
          filteredStores={filteredStores}
          selectedStore={selectedStore}
          channels={channels}
          onSetStoreType={setSelectedStoreType}
          onSetStoreId={setSelectedStoreId}
          onSetChannel={setSelectedChannel}
          onSetCollection={setSelectedCollection}
          onSetWantsToChangeDestination={setWantsToChangeDestination}
          onSetShowAddStore={setShowAddStore}
          onSetShowAddChannel={setShowAddChannel}
          onSetNewStoreName={setNewStoreName}
          onSetNewChannelName={setNewChannelName}
          onCreateStore={handleCreateStore}
          onCreateChannel={handleCreateChannel}
          onAssign={handleAssign}
          onChannelSelect={async (channel) => {
            setSelectedChannel(channel);
            setSelectedCollection("");
            setWantsToChangeDestination(false);
            try {
              const res = await authFetch(`${apiBase}/stores/${selectedStoreId}/channels/${channel}/collections`, getAuthHeaders);
              const data = await res.json();
              setExistingCollections(data.collections || []);
            } catch (e) {
              setExistingCollections([]);
            }
          }}
        />
      </CollapsibleSection>

      {saveStatus && (
        <div
          className={`p-4 rounded-md border ${
            saveStatus.type === "success"
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
          }`}
          data-testid="store-save-status"
        >
          <span className="text-base font-medium block mb-3">{saveStatus.message}</span>
          {saveStatus.type === "success" && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setSaveStatus(null);
                  setProductPackage(null);
                  setSelectedStoreId(null);
                  setSelectedChannel(null);
                  setIsEditMode(false);
                  setOriginalPacketId(null);
                  setOriginalConfiguration(null);
                  setConfiguration({
                    enabledColors: new Set<string>(),
                    enabledSizes: new Set<string>(),
                    selectedGraphicSize: "medium",
                    defaultColor: "",
                  });
                  navigate("/admin/store-builder");
                }}
                className="qr-btn qr-btn--outline qr-btn--xl qr-btn--full"
                data-testid="button-clear-after-assign"
              >
                Clear & New
              </button>
              <button
                onClick={() => {
                  if (selectedStoreId && selectedChannel) {
                    navigate(`/admin/store-library?storeId=${selectedStoreId}&channel=${encodeURIComponent(selectedChannel)}`);
                  }
                }}
                className="qr-btn qr-btn--primary qr-btn--xl qr-btn--full"
                data-testid="button-view-store"
              >
                View in Store
              </button>
            </div>
          )}
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

      <ImageModalView
        imageUrl={thumbnailLightbox}
        onClose={() => setThumbnailLightbox(null)}
      />

      <TemplatePickerSkin
        isOpen={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleTemplateSelect}
        fetchTemplates={fetchTemplates}
      />
    </div>
  );
}

export default StoreBuilderHarness;
