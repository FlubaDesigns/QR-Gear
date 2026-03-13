import { authFetch } from "@/features/adminAuth/authFetch";
import type { ProductPackage, ProductConfiguration, StoreType } from "./store-builder-types";
import type { PartnerStore } from "@shared/schema";

export async function executeCreateStore(
  apiBase: string,
  getAuthHeaders: () => Promise<HeadersInit>,
  newStoreName: string,
  selectedStoreType: StoreType,
): Promise<{ id?: string; error?: string }> {
  if (!newStoreName.trim() || !selectedStoreType) return { error: "Missing store name or type" };
  const res = await authFetch(`${apiBase}/stores`, getAuthHeaders, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newStoreName.trim(), roleType: selectedStoreType }),
  });
  if (!res.ok) throw new Error(`Failed to create store: ${res.status}`);
  const newStore = await res.json();
  return { id: newStore?.id };
}

export async function executeCreateChannel(
  apiBase: string,
  getAuthHeaders: () => Promise<HeadersInit>,
  selectedStoreId: string,
  newChannelName: string,
): Promise<{ name?: string; error?: string }> {
  if (!newChannelName.trim() || !selectedStoreId) return { error: "Missing channel name or store" };
  const res = await authFetch(`${apiBase}/stores/${selectedStoreId}/channels`, getAuthHeaders, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newChannelName.trim() }),
  });
  if (!res.ok) throw new Error(`Failed to create channel: ${res.status}`);
  const newChannel = await res.json();
  return { name: newChannel?.name };
}

export function hasConfigurationChanges(
  configuration: ProductConfiguration,
  originalConfiguration: ProductConfiguration | null,
): boolean {
  if (!originalConfiguration) return true;
  const colorsChanged =
    configuration.enabledColors.size !== originalConfiguration.enabledColors.size ||
    !Array.from(configuration.enabledColors).every(c => originalConfiguration.enabledColors.has(c));
  const sizesChanged =
    configuration.enabledSizes.size !== originalConfiguration.enabledSizes.size ||
    !Array.from(configuration.enabledSizes).every(s => originalConfiguration.enabledSizes.has(s));
  const graphicSizeChanged = configuration.selectedGraphicSize !== originalConfiguration.selectedGraphicSize;
  const defaultColorChanged = configuration.defaultColor !== originalConfiguration.defaultColor;
  return colorsChanged || sizesChanged || graphicSizeChanged || defaultColorChanged;
}

export async function executeAssign(params: {
  apiBase: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  productPackage: ProductPackage;
  selectedStore: PartnerStore;
  selectedChannel: string;
  selectedCollection: string;
  configuration: ProductConfiguration;
  isEditMode: boolean;
  originalPacketId: string | null;
  originalConfiguration: ProductConfiguration | null;
}): Promise<{
  success: boolean;
  message: string;
  newPacketId?: string;
  newTemplateId?: string;
  wasForked?: boolean;
}> {
  const {
    apiBase, getAuthHeaders, productPackage, selectedStore, selectedChannel,
    selectedCollection, configuration, isEditMode, originalPacketId, originalConfiguration,
  } = params;

  if (!productPackage.packetId && !productPackage.templateId) {
    return { success: false, message: "Package missing IDs. Please use 'Create Graphics' in Products Builder first." };
  }

  let currentPacketId = productPackage.packetId;
  let templateId = productPackage.templateId;
  let wasForked = false;

  const shouldFork = isEditMode && originalPacketId && hasConfigurationChanges(configuration, originalConfiguration);

  if (shouldFork) {
    console.log("[StoreBuilder] Edit mode - creating new packet (fork from:", originalPacketId, ")");
    const packetResponse = await authFetch(`${apiBase}/packets`, getAuthHeaders, {
      method: "POST",
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
      templateId = undefined;
      wasForked = true;
    } else {
      const errorData = await packetResponse.json().catch(() => ({}));
      throw new Error(`Failed to create new version: ${errorData.error || 'Unknown error'}`);
    }
  }

  if (currentPacketId && !templateId) {
    const templateResponse = await authFetch(`${apiBase}/templates`, getAuthHeaders, {
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
    }
  }

  const response = await authFetch(`${apiBase}/store-product-links`, getAuthHeaders, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: selectedStore.id,
      storeName: selectedStore.name,
      channel: selectedChannel,
      collection: selectedCollection.trim() || null,
      packetId: currentPacketId,
      templateId: templateId,
      qrContent: productPackage.qrContent,
      productName: productPackage.productName,
      compositeUrl: productPackage.compositeUrl,
      qrOnlyUrl: productPackage.qrOnlyUrl,
      pricing: productPackage.pricing,
      enabledColors: Array.from(configuration.enabledColors),
      enabledSizes: Array.from(configuration.enabledSizes),
      selectedGraphicSize: configuration.selectedGraphicSize,
      defaultColor: configuration.defaultColor,
      qrProductState: productPackage.qrProductState || null,
      mockupUrl: productPackage.priorityMockupUrl || null,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to assign to store");
  }

  const collectionSuffix = selectedCollection.trim() ? ` [${selectedCollection.trim()}]` : "";
  const successMsg = wasForked
    ? `New version created and linked to ${selectedStore.name} / ${selectedChannel}${collectionSuffix}`
    : `Linked to ${selectedStore.name} / ${selectedChannel}${collectionSuffix}`;

  return {
    success: true,
    message: successMsg,
    newPacketId: wasForked ? currentPacketId || undefined : undefined,
    newTemplateId: templateId,
    wasForked,
  };
}
