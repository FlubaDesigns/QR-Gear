import { SingleView, type SingleViewProps } from "./views/SingleView";
import { ScrollGridView, type ScrollGridViewProps } from "./views/ScrollGridView";
import { ScrollVerticalView, type ScrollVerticalViewProps } from "./views/ScrollVerticalView";
import { ScrollHorizontalView, type ScrollHorizontalViewProps } from "./views/ScrollHorizontalView";
import type { ScrollViewItem } from "./views/index";
import { ProductSkin } from "./ProductSkin";

export type ViewMode = "scrollGrid" | "scrollVertical" | "scrollHorizontal" | "single" | "grid" | "scroll" | "content";

interface SharedViewerBaseProps {
  className?: string;
}

interface ScrollGridModeProps extends SharedViewerBaseProps {
  mode: "scrollGrid";
  gridProps: ScrollGridViewProps<ScrollViewItem>;
}

interface ScrollVerticalModeProps extends SharedViewerBaseProps {
  mode: "scrollVertical";
  verticalProps: ScrollVerticalViewProps<ScrollViewItem>;
}

interface ScrollHorizontalModeProps extends SharedViewerBaseProps {
  mode: "scrollHorizontal";
  horizontalProps: ScrollHorizontalViewProps<ScrollViewItem>;
}

interface SingleModeProps extends SharedViewerBaseProps {
  mode: "single";
  singleProps: SingleViewProps;
}

interface GridPassthroughProps extends SharedViewerBaseProps {
  mode: "grid";
  children?: React.ReactNode;
}

interface LegacyScrollProps {
  items: ScrollViewItem[];
  selectedId?: string | number | null;
  onSelect?: (item: ScrollViewItem) => void;
  aspectRatio?: "square" | "portrait" | "landscape";
  itemWidth?: string;
  maxItemWidth?: string;
  emptyMessage?: string;
  layout?: "horizontal" | "grid" | "single" | "vertical";
  gridHeight?: string;
  renderItem?: (item: ScrollViewItem, isSelected: boolean, onSelect: () => void) => React.ReactNode;
}

interface LegacyScrollModeProps extends SharedViewerBaseProps {
  mode: "scroll";
  scrollProps: LegacyScrollProps;
}

interface LegacyContentModeProps extends SharedViewerBaseProps {
  mode: "content";
  contentProps: SingleViewProps;
}

export type SharedViewerProps =
  | ScrollGridModeProps
  | ScrollVerticalModeProps
  | ScrollHorizontalModeProps
  | SingleModeProps
  | GridPassthroughProps
  | LegacyScrollModeProps
  | LegacyContentModeProps;

function DefaultScrollItemRenderer({
  item,
  isSelected,
  onSelect,
  aspectRatio,
}: {
  item: ScrollViewItem;
  isSelected: boolean;
  onSelect: () => void;
  aspectRatio?: string;
}) {
  const aspectClass =
    aspectRatio === "portrait"
      ? "aspect-[9/16]"
      : aspectRatio === "landscape"
      ? "aspect-[16/9]"
      : "aspect-square";

  return (
    <div
      className={`cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
        isSelected
          ? "border-primary ring-2 ring-primary ring-offset-2"
          : "border-border hover:border-primary/50"
      }`}
      onClick={onSelect}
      data-testid={`scroll-item-${item.id}`}
    >
      <div className={`${aspectClass} relative bg-muted`}>
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="p-2 space-y-1">
        <span className="text-xs font-medium truncate block text-center">
          {item.title}
        </span>
        {item.subtitle && (
          <span className="text-xs text-muted-foreground truncate block text-center">
            {item.subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

function renderLegacyScroll(scrollProps: LegacyScrollProps) {
  const {
    items,
    selectedId,
    onSelect,
    aspectRatio = "portrait",
    itemWidth,
    maxItemWidth,
    emptyMessage = "No items available",
    layout = "horizontal",
    gridHeight = "400px",
    renderItem: customRenderItem,
  } = scrollProps;

  const makeItemRenderer = (item: ScrollViewItem) => {
    const isSelected = selectedId === item.id;
    const selectFn = () => onSelect?.(item);

    if (customRenderItem) {
      return customRenderItem(item, isSelected, selectFn);
    }
    return (
      <DefaultScrollItemRenderer
        item={item}
        isSelected={isSelected}
        onSelect={selectFn}
        aspectRatio={aspectRatio}
      />
    );
  };

  if (layout === "grid") {
    return (
      <ScrollGridView
        items={items}
        renderItem={(item) => makeItemRenderer(item)}
        height={gridHeight}
        emptyMessage={emptyMessage}
        footer={
          <p className="text-xs text-muted-foreground text-center mt-2">
            {items.length} items - Scroll for more
          </p>
        }
      />
    );
  }

  if (layout === "vertical") {
    return (
      <ScrollVerticalView
        items={items}
        height={gridHeight}
        emptyMessage={emptyMessage}
        renderItem={(item) => {
          const isSelected = selectedId === item.id;
          const selectFn = () => onSelect?.(item);

          if (customRenderItem) {
            return customRenderItem(item, isSelected, selectFn);
          }

          const priceRange = item.minPrice && item.maxPrice
            ? { min: parseFloat(item.minPrice), max: parseFloat(item.maxPrice) }
            : item.minPrice
              ? { min: parseFloat(item.minPrice), max: parseFloat(item.minPrice) }
              : undefined;

          return (
            <ProductSkin
              id={item.id}
              title={item.title}
              brand={item.subtitle}
              image={item.imageUrl}
              priceRange={priceRange}
              madeInUSA={item.madeInUSA}
              colors={item.colorCount}
              sizes={item.sizes}
              description={item.description}
              onClick={selectFn}
              className={isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
            />
          );
        }}
        footer={
          <p className="text-sm text-muted-foreground text-center mt-3 font-medium">
            {items.length} products available
          </p>
        }
      />
    );
  }

  if (layout === "single") {
    return (
      <ScrollHorizontalView
        items={items}
        snap={true}
        emptyMessage={emptyMessage}
        renderItem={(item) => makeItemRenderer(item)}
        footer={
          <p className="text-xs text-muted-foreground text-center mt-2">
            {items.length} items - Swipe for more
          </p>
        }
      />
    );
  }

  return (
    <ScrollHorizontalView
      items={items}
      itemWidth={itemWidth}
      maxItemWidth={maxItemWidth}
      emptyMessage={emptyMessage}
      renderItem={(item) => makeItemRenderer(item)}
      footer={
        <p className="text-xs text-muted-foreground text-center mt-2">
          Tap to select - Scroll for more
        </p>
      }
    />
  );
}

export function SharedViewer(props: SharedViewerProps) {
  const { mode, className = "" } = props;

  switch (mode) {
    case "scrollGrid":
      return (
        <div className={className} data-testid="shared-viewer-scroll-grid">
          <ScrollGridView {...(props as ScrollGridModeProps).gridProps} />
        </div>
      );

    case "scrollVertical":
      return (
        <div className={className} data-testid="shared-viewer-scroll-vertical">
          <ScrollVerticalView {...(props as ScrollVerticalModeProps).verticalProps} />
        </div>
      );

    case "scrollHorizontal":
      return (
        <div className={className} data-testid="shared-viewer-scroll-horizontal">
          <ScrollHorizontalView {...(props as ScrollHorizontalModeProps).horizontalProps} />
        </div>
      );

    case "single":
      return (
        <div className={className} data-testid="shared-viewer-single">
          <SingleView {...(props as SingleModeProps).singleProps} />
        </div>
      );

    case "content":
      return (
        <div className={className} data-testid="shared-viewer-single">
          <SingleView {...(props as LegacyContentModeProps).contentProps} />
        </div>
      );

    case "grid":
      return (
        <div className={className} data-testid="shared-viewer-grid">
          {(props as GridPassthroughProps).children}
        </div>
      );

    case "scroll":
      return (
        <div className={className} data-testid="shared-viewer-scroll">
          {renderLegacyScroll((props as LegacyScrollModeProps).scrollProps)}
        </div>
      );

    default:
      return null;
  }
}
