import { ImageModalView } from "@/features/shared/components/views/ModalView";
import { HeroImageLightbox } from "./StoreBuilderComponents";
import { StoreBuilderProductDetail } from "./StoreBuilderProductDetail";
import type { ProductPackage, ProductConfiguration, MockupJob } from "./store-builder-types";

interface StoreBuilderCatalogProps {
  productPackage: ProductPackage;
  configuration: ProductConfiguration;
  previewImageUrl: string | undefined;
  packetThumbnails: Array<{ url: string; useColorBg: boolean }>;
  defaultColorHex: string;
  isEditMode: boolean;
  selectedStoreId: string | null;
  selectedChannel: string | null;
  mockups: MockupJob[];
  lightboxOpen: boolean;
  thumbnailLightbox: string | null;
  onLightboxOpen: () => void;
  onLightboxClose: () => void;
  onThumbnailClick: (url: string) => void;
  onThumbnailClose: () => void;
  onGraphicSizeChange: (size: string) => void;
  onToggleSize: (size: string) => void;
  onToggleColor: (colorName: string) => void;
  onSelectColor: (color: string) => void;
  onSelectGraphicSize: (size: string) => void;
}

export function StoreBuilderCatalog({
  productPackage,
  configuration,
  previewImageUrl,
  packetThumbnails,
  defaultColorHex,
  isEditMode,
  selectedStoreId,
  selectedChannel,
  mockups,
  lightboxOpen,
  thumbnailLightbox,
  onLightboxOpen,
  onLightboxClose,
  onThumbnailClick,
  onThumbnailClose,
  onGraphicSizeChange,
  onToggleSize,
  onToggleColor,
  onSelectColor,
  onSelectGraphicSize,
}: StoreBuilderCatalogProps) {
  return (
    <>
      <StoreBuilderProductDetail
        productPackage={productPackage}
        configuration={configuration}
        previewImageUrl={previewImageUrl}
        packetThumbnails={packetThumbnails}
        defaultColorHex={defaultColorHex}
        isEditMode={isEditMode}
        selectedStoreId={selectedStoreId}
        selectedChannel={selectedChannel}
        onLightboxOpen={onLightboxOpen}
        onThumbnailClick={onThumbnailClick}
        onGraphicSizeChange={onGraphicSizeChange}
        onToggleSize={onToggleSize}
        onToggleColor={onToggleColor}
      />

      <HeroImageLightbox
        isOpen={lightboxOpen}
        onClose={onLightboxClose}
        productPackage={productPackage}
        configuration={configuration}
        mockups={mockups}
        onSelectColor={onSelectColor}
        onSelectGraphicSize={onSelectGraphicSize}
      />

      <ImageModalView
        imageUrl={thumbnailLightbox}
        onClose={onThumbnailClose}
      />
    </>
  );
}
