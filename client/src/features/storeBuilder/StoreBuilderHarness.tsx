import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { TemplatePickerSkin } from "@/features/shared/components/skins";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/lib/adminFetch";
import type { PartnerStore } from "@shared/schema";
import { getColorHex, type ProductPackage, type ProductConfiguration, type MockupJob, type StoreType } from "./store-builder-types";
import { StoreBuilderOverview } from "./StoreBuilderOverview";
import { StoreBuilderCatalog } from "./StoreBuilderCatalog";
import { StoreBuilderDestination } from "./StoreBuilderDestination";
import { executeCreateStore, executeCreateChannel, executeAssign } from "./store-builder-actions";

export function StoreBuilderHarness() {
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

  const fetchTemplates = useCallback(async (): Promise<Array<{ id: string; name: string; primaryImage?: string | null; secondaryImage?: string | null; productName?: string | null; packetId?: string | null; qrMode?: string | null; colorCount?: number; sizeCount?: number }>> => {
    const data = await adminFetch<any>("/templates");
    if (data.templates) {
      return data.templates.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        name: (t.name || t.productName || `Template ${String(t.id).slice(0, 6)}`) as string,
        primaryImage: (t.thumbnailUrl || t.artworkUrl || t.compositeUrl) as string | null,
        secondaryImage: t.qrOnlyUrl as string | null,
        productName: t.productName as string | null,
        packetId: t.packetId as string | null,
        qrMode: (t.qrMode || t.qrProductState) as string | null,
        colorCount: (t.colorCount || (t.colors as string[] | undefined)?.length) as number | undefined,
        sizeCount: (t.sizeCount || (t.sizes as string[] | undefined)?.length) as number | undefined,
      }));
    }
    return [];
  }, []);
  
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
    queryKey: ["/api/admin", "templates", productPackage?.templateId, "mockups"],
    queryFn: () => {
      if (!productPackage?.templateId) return { success: false, summary: { total: 0, completed: 0, pending: 0, processing: 0, failed: 0 }, mockups: [] };
      return adminFetch<any>(`/templates/${productPackage.templateId}/mockups`);
    },
    enabled: !!productPackage?.templateId,
    refetchInterval: 10000,
  });

  const mockups = mockupsData?.mockups || [];

  const { data: stores = [] } = useQuery<PartnerStore[]>({
    queryKey: ["/api/admin/partner-stores"],
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
      const packetDefaultColor = (productPackage as Record<string, unknown>).defaultColor as string | undefined;
      const resolvedDefaultColor = packetDefaultColor && colors.includes(packetDefaultColor) 
        ? packetDefaultColor 
        : colors[0] || "";
      
      const initialConfig = {
        enabledColors: new Set(colors),
        enabledSizes: new Set(sizes),
        selectedGraphicSize: ((productPackage as Record<string, unknown>).placementSizes as Record<string, string> | undefined)?.front || "medium",
        defaultColor: resolvedDefaultColor,
      };
      
      setConfiguration(initialConfig);
      
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
    
    if (urlStoreId) setSelectedStoreId(urlStoreId);
    if (urlChannel) setSelectedChannel(urlChannel);
    
    if (packetId) {
      setIsLoadingPacket(true);
      setOriginalPacketId(packetId);
      setIsEditMode(true);
      setOriginalConfiguration(null);
      adminFetch<any>(`/packets/${packetId}`)
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
              destinationRoleType: packet.roleType || null,
              destinationStoreId: packet.storeId || null,
              destinationStoreName: packet.storeName || null,
              destinationChannelId: packet.channelId || null,
              destinationChannelName: packet.channelName || null,
              assemblyId: packet.assemblyId || null,
            };
            setProductPackage(loadedPackage);
            
            if (!urlStoreId && packet.storeId) {
              setSelectedStoreId(packet.storeId);
              if (packet.roleType === "internal" || packet.roleType === "external") {
                setSelectedStoreType(packet.roleType as StoreType);
              }
            }
            if (!urlChannel && packet.channelName) {
              setSelectedChannel(packet.channelName);
            }
            
            if (packet.storeId && packet.channelName) {
              adminFetch<any>(`/stores/${packet.storeId}/channels/${packet.channelName}/collections`)
                .then(data => setExistingCollections(data.collections || []))
                .catch(() => setExistingCollections([]));
            }
            
            if (!packet.priorityMockupUrl && packet.blueprintId && packet.compositeUrl) {
              const placement = (packet.placements || ["front"])[0];
              const colorName = packet.defaultColor || (packet.colors?.[0]?.name) || "Black";
              const colorHex = packet.defaultColorHex || (packet.colors?.[0]?.hex) || "#000000";
              const qrSize = packet.placementSizes?.[placement] || "medium";
              
              adminFetch<any>("/mockup/priority", {
                method: "POST",
                json: {
                  blueprintId: packet.blueprintId,
                  printProviderId: packet.printProviderId || 99,
                  colorName,
                  colorHex,
                  placement: placement + "-center",
                  artworkUrl: packet.compositeUrl,
                  qrSize,
                },
              })
                .then(mockupData => {
                  if (mockupData.success && mockupData.mockupUrl) {
                    setProductPackage(prev => prev ? { ...prev, priorityMockupUrl: mockupData.mockupUrl } : prev);
                  }
                })
                .catch(() => {});
            }
          }
        })
        .catch(err => {
          console.error("Failed to load packet:", err);
          setSaveStatus({ type: "error", message: `Failed to load packet: ${(err as Error).message}` });
        })
        .finally(() => {
          setIsLoadingPacket(false);
        });
      return;
    }

    setProductPackage(null);
  }, [location]);

  const currentMockup = mockups.find(
    m => m.status === "completed" && m.mockupUrl && m.color === configuration.defaultColor
  );

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
      if (!newEnabledColors.has(color)) newEnabledColors.add(color);
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
      const result = await executeCreateStore(newStoreName, selectedStoreType);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      setNewStoreName("");
      setShowAddStore(false);
      if (result.id) {
        setSelectedStoreId(result.id);
        setSelectedChannel(null);
      }
    } catch (err: unknown) {
      setSaveStatus({ type: "error", message: (err as Error).message || "Failed to create store" });
    } finally {
      setIsCreatingStore(false);
    }
  };

  const handleCreateChannel = async () => {
    setIsCreatingChannel(true);
    try {
      const result = await executeCreateChannel(selectedStoreId!, newChannelName);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      setNewChannelName("");
      setShowAddChannel(false);
      if (result.name) setSelectedChannel(result.name);
    } catch (err: unknown) {
      setSaveStatus({ type: "error", message: (err as Error).message || "Failed to create channel" });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleAssign = async () => {
    if (!productPackage || !selectedStore || !selectedChannel) return;
    if (!productPackage.assemblyId) {
      setSaveStatus({ type: "error", message: "Packet is missing an assembly — complete the QRG → BLD → GRF chain in the Library before assigning to a store." });
      return;
    }
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const result = await executeAssign({
        productPackage, selectedStore, selectedChannel,
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
    } catch (error: unknown) {
      setSaveStatus({ type: "error", message: (error as Error).message || "Failed to assign to store" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateSelect = (packetId: string) => {
    navigate(`/admin/store-builder?packetId=${packetId}`);
  };

  const handleRefreshPacket = () => {
    const currentPacketId = productPackage?.packetId;
    if (currentPacketId) {
      setProductPackage(null);
      setTimeout(() => {
        navigate(`/admin/store-builder?packetId=${currentPacketId}`);
      }, 50);
    }
  };

  const handleClearAfterAssign = () => {
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
  };

  const handleViewInStore = () => {
    if (selectedStoreId && selectedChannel) {
      navigate(`/admin/store-library?storeId=${selectedStoreId}&channel=${encodeURIComponent(selectedChannel)}`);
    }
  };

  const handleChannelSelect = async (channel: string) => {
    setSelectedChannel(channel);
    setSelectedCollection("");
    setWantsToChangeDestination(false);
    try {
      const data = await adminFetch<any>(`/stores/${selectedStoreId}/channels/${channel}/collections`);
      setExistingCollections(data.collections || []);
    } catch {
      setExistingCollections([]);
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
      <StoreBuilderOverview
        productPackage={null}
        templatePickerOpen={templatePickerOpen}
        onTemplatePickerOpen={() => setTemplatePickerOpen(true)}
        onTemplatePickerClose={() => setTemplatePickerOpen(false)}
        onTemplateSelect={handleTemplateSelect}
        fetchTemplates={fetchTemplates}
        onRefreshPacket={handleRefreshPacket}
        onNavigateProducts={() => navigate("/admin/products")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <StoreBuilderOverview
        productPackage={productPackage}
        templatePickerOpen={templatePickerOpen}
        onTemplatePickerOpen={() => setTemplatePickerOpen(true)}
        onTemplatePickerClose={() => setTemplatePickerOpen(false)}
        onTemplateSelect={handleTemplateSelect}
        fetchTemplates={fetchTemplates}
        onRefreshPacket={handleRefreshPacket}
        onNavigateProducts={() => navigate("/admin/products")}
      />

      <StoreBuilderCatalog
        productPackage={productPackage}
        configuration={configuration}
        previewImageUrl={previewImageUrl}
        packetThumbnails={packetThumbnails}
        defaultColorHex={defaultColorHex}
        isEditMode={isEditMode}
        selectedStoreId={selectedStoreId}
        selectedChannel={selectedChannel}
        mockups={mockups}
        lightboxOpen={lightboxOpen}
        thumbnailLightbox={thumbnailLightbox}
        onLightboxOpen={() => setLightboxOpen(true)}
        onLightboxClose={() => setLightboxOpen(false)}
        onThumbnailClick={setThumbnailLightbox}
        onThumbnailClose={() => setThumbnailLightbox(null)}
        onGraphicSizeChange={setGraphicSize}
        onToggleSize={toggleSize}
        onToggleColor={toggleColor}
        onSelectColor={setDefaultColor}
        onSelectGraphicSize={setGraphicSize}
      />

      <StoreBuilderDestination
        productPackage={productPackage}
        configuration={configuration}
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
        saveStatus={saveStatus}
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
        onChannelSelect={handleChannelSelect}
        onClearAfterAssign={handleClearAfterAssign}
        onViewInStore={handleViewInStore}
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
