import { SingleView, type SingleViewProps } from "./views/SingleView";
import { ScrollGridView, type ScrollGridViewProps } from "./views/ScrollGridView";
import { ScrollVerticalView, type ScrollVerticalViewProps } from "./views/ScrollVerticalView";
import { ScrollHorizontalView, type ScrollHorizontalViewProps } from "./views/ScrollHorizontalView";

export type ViewMode = "scrollGrid" | "scrollVertical" | "scrollHorizontal" | "single";

interface SharedViewerBaseProps {
  className?: string;
}

interface ScrollGridModeProps extends SharedViewerBaseProps {
  mode: "scrollGrid";
  gridProps: ScrollGridViewProps<any>;
}

interface ScrollVerticalModeProps extends SharedViewerBaseProps {
  mode: "scrollVertical";
  verticalProps: ScrollVerticalViewProps<any>;
}

interface ScrollHorizontalModeProps extends SharedViewerBaseProps {
  mode: "scrollHorizontal";
  horizontalProps: ScrollHorizontalViewProps<any>;
}

interface SingleModeProps extends SharedViewerBaseProps {
  mode: "single";
  singleProps: SingleViewProps;
}

export type SharedViewerProps =
  | ScrollGridModeProps
  | ScrollVerticalModeProps
  | ScrollHorizontalModeProps
  | SingleModeProps;

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

    default:
      return null;
  }
}
