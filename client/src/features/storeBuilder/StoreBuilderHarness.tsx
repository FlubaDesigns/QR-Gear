import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Store, Loader2, Package, Layers, RefreshCw } from "lucide-react";
import { ImageModalView } from "@/features/shared/components/views/ModalView";
import { TemplatePickerSkin } from "@/features/shared/components/skins";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { authFetch } from "@/features/adminAuth/authFetch";
import { Card } from "@/components/ui/card";
import type { PartnerStore } from "@shared/schema";
import { getColorHex, type ProductPackage, type ProductConfiguration, type MockupJob, type StoreType } from "./store-builder-types";
import { CollapsibleSection, HeroImageLightbox } from "./StoreBuilderComponents";
import { StoreBuilderProductDetail } from "./StoreBuilderProductDetail";
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

      <StoreBuilderProductDetail
        productPackage={productPackage}
        configuration={configuration}
        previewImageUrl={previewImageUrl}
        packetThumbnails={packetThumbnails}
        defaultColorHex={defaultColorHex}
        isEditMode={isEditMode}
        selectedStoreId={selectedStoreId}
        selectedChannel={selectedChannel}
        onLightboxOpen={() => setLightboxOpen(true)}
        onThumbnailClick={setThumbnailLightbox}
        onGraphicSizeChange={setGraphicSize}
        onToggleSize={toggleSize}
        onToggleColor={toggleColor}
      />

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
