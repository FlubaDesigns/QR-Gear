import { Store } from "lucide-react";
import { CollapsibleSection } from "./StoreBuilderComponents";
import { StoreBuilderAssignment } from "./StoreBuilderAssignment";
import type { ProductPackage, ProductConfiguration, StoreType } from "./store-builder-types";
import type { PartnerStore } from "@shared/schema";

interface StoreBuilderDestinationProps {
  productPackage: ProductPackage;
  configuration: ProductConfiguration;
  selectedStoreType: StoreType;
  selectedStoreId: string | null;
  selectedChannel: string | null;
  selectedCollection: string;
  existingCollections: string[];
  isSaving: boolean;
  wantsToChangeDestination: boolean;
  showAddStore: boolean;
  showAddChannel: boolean;
  newStoreName: string;
  newChannelName: string;
  isCreatingStore: boolean;
  isCreatingChannel: boolean;
  filteredStores: PartnerStore[];
  selectedStore: PartnerStore | undefined;
  channels: string[];
  saveStatus: { type: "success" | "error"; message: string } | null;
  onSetStoreType: (type: StoreType) => void;
  onSetStoreId: (id: string | null) => void;
  onSetChannel: (channel: string | null) => void;
  onSetCollection: (collection: string) => void;
  onSetWantsToChangeDestination: (v: boolean) => void;
  onSetShowAddStore: (v: boolean) => void;
  onSetShowAddChannel: (v: boolean) => void;
  onSetNewStoreName: (name: string) => void;
  onSetNewChannelName: (name: string) => void;
  onCreateStore: () => void;
  onCreateChannel: () => void;
  onAssign: () => void;
  onChannelSelect: (channel: string) => Promise<void>;
  onClearAfterAssign: () => void;
  onViewInStore: () => void;
}

export function StoreBuilderDestination({
  productPackage,
  configuration,
  selectedStoreType,
  selectedStoreId,
  selectedChannel,
  selectedCollection,
  existingCollections,
  isSaving,
  wantsToChangeDestination,
  showAddStore,
  showAddChannel,
  newStoreName,
  newChannelName,
  isCreatingStore,
  isCreatingChannel,
  filteredStores,
  selectedStore,
  channels,
  saveStatus,
  onSetStoreType,
  onSetStoreId,
  onSetChannel,
  onSetCollection,
  onSetWantsToChangeDestination,
  onSetShowAddStore,
  onSetShowAddChannel,
  onSetNewStoreName,
  onSetNewChannelName,
  onCreateStore,
  onCreateChannel,
  onAssign,
  onChannelSelect,
  onClearAfterAssign,
  onViewInStore,
}: StoreBuilderDestinationProps) {
  return (
    <>
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
          onSetStoreType={onSetStoreType}
          onSetStoreId={onSetStoreId}
          onSetChannel={onSetChannel}
          onSetCollection={onSetCollection}
          onSetWantsToChangeDestination={onSetWantsToChangeDestination}
          onSetShowAddStore={onSetShowAddStore}
          onSetShowAddChannel={onSetShowAddChannel}
          onSetNewStoreName={onSetNewStoreName}
          onSetNewChannelName={onSetNewChannelName}
          onCreateStore={onCreateStore}
          onCreateChannel={onCreateChannel}
          onAssign={onAssign}
          onChannelSelect={onChannelSelect}
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
                onClick={onClearAfterAssign}
                className="qr-btn qr-btn--outline qr-btn--xl qr-btn--full"
                data-testid="button-clear-after-assign"
              >
                Clear & New
              </button>
              <button
                onClick={onViewInStore}
                className="qr-btn qr-btn--primary qr-btn--xl qr-btn--full"
                data-testid="button-view-store"
              >
                View in Store
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
