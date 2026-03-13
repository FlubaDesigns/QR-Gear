import { useRef } from "react";
import { Store, Building2, Globe, ChevronRight, Loader2, Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import type { PartnerStore } from "@shared/schema";
import type { ProductPackage, StoreType } from "./store-builder-types";

interface StoreBuilderAssignmentProps {
  productPackage: ProductPackage;
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
  onChannelSelect: (channel: string) => void;
}

export function StoreBuilderAssignment({
  productPackage, selectedStoreType, selectedStoreId, selectedChannel,
  selectedCollection, existingCollections, isSaving, wantsToChangeDestination,
  showAddStore, showAddChannel, newStoreName, newChannelName,
  isCreatingStore, isCreatingChannel, filteredStores, selectedStore, channels,
  onSetStoreType, onSetStoreId, onSetChannel, onSetCollection,
  onSetWantsToChangeDestination, onSetShowAddStore, onSetShowAddChannel,
  onSetNewStoreName, onSetNewChannelName, onCreateStore, onCreateChannel,
  onAssign, onChannelSelect,
}: StoreBuilderAssignmentProps) {
  const storeSelectRef = useRef<HTMLDivElement>(null);
  const channelSelectRef = useRef<HTMLDivElement>(null);
  const assignButtonRef = useRef<HTMLButtonElement>(null);

  const storeOptions = filteredStores.map(store => ({
    value: store.id,
    label: store.name,
    icon: <Store className="h-4 w-4 flex-shrink-0" />,
  }));

  return (
    <div className="space-y-4">
      {selectedStore && selectedChannel && !wantsToChangeDestination ? (
        <>
          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-sm text-muted-foreground mb-1">Destination</p>
            <p className="text-lg font-medium" data-testid="text-destination">
              {selectedStore.name} / {selectedChannel}
            </p>
            <button
              onClick={() => onSetWantsToChangeDestination(true)}
              className="text-sm text-primary hover:underline mt-2"
              data-testid="button-change-destination"
            >
              Change destination
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-base font-medium">Collection (optional):</p>
            <p className="text-sm text-muted-foreground">
              Group products together for QR Dynamics rotation
            </p>
            {existingCollections.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {existingCollections.map((coll) => (
                  <button
                    key={coll}
                    onClick={() => onSetCollection(coll)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      selectedCollection === coll
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 border-muted-foreground/20 hover:bg-muted"
                    }`}
                    data-testid={`collection-tag-${coll}`}
                  >
                    {coll}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Enter collection name or create new..."
              value={selectedCollection}
              onChange={(e) => onSetCollection(e.target.value)}
              className="w-full h-14 px-4 rounded-md border bg-background text-base"
              data-testid="input-collection"
            />
          </div>

          <button
            ref={assignButtonRef}
            onClick={onAssign}
            disabled={isSaving}
            className="qr-btn qr-btn--primary qr-btn--xxl qr-btn--full disabled:opacity-50"
            data-testid="button-assign"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <ChevronRight className="h-6 w-6" />
                Assign to {selectedChannel}
                {selectedCollection.trim() && ` [${selectedCollection.trim()}]`}
              </>
            )}
          </button>
        </>
      ) : (
        <>
          {wantsToChangeDestination && (
            <button
              onClick={() => onSetWantsToChangeDestination(false)}
              className="text-sm text-primary hover:underline"
              data-testid="button-cancel-change"
            >
              Cancel change
            </button>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                onSetStoreType("internal");
                onSetStoreId(null);
                onSetChannel(null);
                setTimeout(() => storeSelectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
              }}
              className={`qr-btn qr-btn--touch qr-btn--full ${selectedStoreType === "internal" ? "qr-btn--primary" : "qr-btn--outline"}`}
              data-testid="store-type-internal"
            >
              <Building2 className="h-5 w-5" />
              Internal
            </button>
            <button
              onClick={() => {
                onSetStoreType("external");
                onSetStoreId(null);
                onSetChannel(null);
                setTimeout(() => storeSelectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
              }}
              className={`qr-btn qr-btn--touch qr-btn--full ${selectedStoreType === "external" ? "qr-btn--primary" : "qr-btn--outline"}`}
              data-testid="store-type-external"
            >
              <Globe className="h-5 w-5" />
              External
            </button>
          </div>

          {selectedStoreType && (
            <div ref={storeSelectRef} className="flex flex-col gap-3">
              <CustomDropdown
                value={selectedStoreId || ""}
                onChange={(val) => {
                  onSetStoreId(val);
                  onSetChannel(null);
                  setTimeout(() => channelSelectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
                }}
                options={storeOptions}
                placeholder="Select a store..."
                data-testid="store-select"
              />
              <button
                onClick={() => onSetShowAddStore(!showAddStore)}
                className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
                data-testid="button-add-store"
              >
                <Plus className="h-5 w-5" />
                {showAddStore ? "Cancel" : "Add New Store"}
              </button>
            </div>
          )}

          {showAddStore && selectedStoreType && (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <p className="text-base text-muted-foreground">
                Create new {selectedStoreType} store:
              </p>
              <input
                type="text"
                placeholder="Store name..."
                value={newStoreName}
                onChange={(e) => onSetNewStoreName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onCreateStore()}
                className="w-full h-14 px-4 rounded-md border bg-background text-base"
                data-testid="input-new-store"
              />
              <div className="flex flex-col gap-3">
                <button
                  onClick={onCreateStore}
                  disabled={!newStoreName.trim() || isCreatingStore}
                  className="qr-btn qr-btn--primary qr-btn--xl qr-btn--full disabled:opacity-50"
                  data-testid="button-save-store"
                >
                  {isCreatingStore ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Store"}
                </button>
                <button
                  onClick={() => { onSetShowAddStore(false); onSetNewStoreName(""); }}
                  className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
                  data-testid="button-cancel-store"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedStore && (
            <div ref={channelSelectRef} className="space-y-3">
              <p className="text-base font-medium">Select Channel:</p>
              <div className="flex flex-col gap-2">
                {channels.map((channel) => (
                  <button
                    key={channel}
                    onClick={() => {
                      onChannelSelect(channel);
                      setTimeout(() => assignButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
                    }}
                    className={`qr-btn qr-btn--touch qr-btn--full ${selectedChannel === channel ? "qr-btn--primary" : "qr-btn--outline"}`}
                    data-testid={`channel-${channel}`}
                  >
                    {channel}
                  </button>
                ))}
                <button
                  onClick={() => onSetShowAddChannel(!showAddChannel)}
                  className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
                  data-testid="button-add-channel"
                >
                  <Plus className="h-5 w-5" />
                  {showAddChannel ? "Cancel" : "Add New Channel"}
                </button>
              </div>

              {showAddChannel && (
                <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <p className="text-base text-muted-foreground">
                    Add channel to {selectedStore.name}:
                  </p>
                  <input
                    type="text"
                    placeholder="Channel name..."
                    value={newChannelName}
                    onChange={(e) => onSetNewChannelName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onCreateChannel()}
                    className="w-full h-14 px-4 rounded-md border bg-background text-base"
                    data-testid="input-new-channel"
                  />
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={onCreateChannel}
                      disabled={!newChannelName.trim() || isCreatingChannel}
                      className="qr-btn qr-btn--primary qr-btn--xl qr-btn--full disabled:opacity-50"
                      data-testid="button-save-channel"
                    >
                      {isCreatingChannel ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Channel"}
                    </button>
                    <button
                      onClick={() => { onSetShowAddChannel(false); onSetNewChannelName(""); }}
                      className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
                      data-testid="button-cancel-channel"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
