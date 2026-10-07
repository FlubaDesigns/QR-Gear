import { useEffect, useState } from "react";
import { SinglePaneViewer } from "./viewers/SinglePaneViewer";
import { SkinHorizontalView } from "./views/SkinHorizontalView";
import type { SkinItem, SkinActions, CardSkinProps } from "./skins/types";

// VVS Viewer code: 1·2·1
// SinglePane + HorizontalScroll + Shape popup.
// Owns: selection by asset ID and prev/next navigation. Archive confirmation belongs to the shared GRF dialog.
// Does NOT own: popup UI, detail content — those belong to the Shape layer.

type CardSkinComponent = React.ComponentType<CardSkinProps>;

// Props that every Shape used with this viewer must accept.
export interface GalleryShapeProps {
  open: boolean;
  item: SkinItem | null;
  actions?: SkinActions;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  isActionPending?: boolean;
  itemIndex: number;
  totalItems: number;
}

type GalleryShapeComponent = React.ComponentType<GalleryShapeProps>;

export interface SkinHorizontalViewerProps {
  items: SkinItem[];
  CardSkin: CardSkinComponent;
  Shape: GalleryShapeComponent;
  actions: SkinActions;
  isActionPending?: boolean;
  cardWidth?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  /** Optional header rendered above the scroll strip (e.g. filter controls) */
  header?: React.ReactNode;
  className?: string;
}

export function SkinHorizontalViewer({
  items,
  CardSkin,
  Shape,
  actions,
  isActionPending = false,
  cardWidth = "160px",
  isLoading,
  emptyMessage,
  emptyIcon,
  header,
  className,
}: SkinHorizontalViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = items.findIndex(item => item.id === selectedId);
  const selectedItem = items[selectedIndex] ?? null;
  useEffect(() => {
    if (selectedId && !selectedItem) setSelectedId(null);
  }, [selectedId, selectedItem]);
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < items.length - 1;

  const handlePrev = () => { if (hasPrev) setSelectedId(items[selectedIndex - 1].id); };
  const handleNext = () => { if (hasNext) setSelectedId(items[selectedIndex + 1].id); };
  const handleClose = () => setSelectedId(null);

  return (
    <SinglePaneViewer className={className}>
      {header && <div className="mb-4">{header}</div>}

      <SkinHorizontalView
        items={items}
        CardSkin={CardSkin}
        onSelect={(item) => setSelectedId(item.id)}
        selectedId={selectedItem?.id ?? null}
        actions={actions}
        isActionPending={isActionPending}
        cardWidth={cardWidth}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        emptyIcon={emptyIcon}
      />

      {/* Shape owns the popup presentation entirely */}
      <Shape
        open={!!selectedItem}
        item={selectedItem}
        actions={actions}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isActionPending={isActionPending}
        itemIndex={Math.max(0, selectedIndex)}
        totalItems={items.length}
      />

    </SinglePaneViewer>
  );
}

export type { SkinItem, SkinActions, CardSkinProps };
