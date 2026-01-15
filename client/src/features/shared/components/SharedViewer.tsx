import { ScrollView, type ScrollViewProps } from "./views/ScrollView";
import { ContentView, type ContentViewProps } from "./views/ContentView";

export type ViewMode = "scroll" | "content" | "grid";

interface SharedViewerBaseProps {
  className?: string;
}

interface ScrollModeProps extends SharedViewerBaseProps {
  mode: "scroll";
  scrollProps: ScrollViewProps;
}

interface ContentModeProps extends SharedViewerBaseProps {
  mode: "content";
  contentProps: ContentViewProps;
}

interface GridModeProps extends SharedViewerBaseProps {
  mode: "grid";
  children?: React.ReactNode;
}

export type SharedViewerProps = ScrollModeProps | ContentModeProps | GridModeProps;

export function SharedViewer(props: SharedViewerProps) {
  const { mode, className = "" } = props;

  switch (mode) {
    case "scroll":
      return (
        <div className={className} data-testid="shared-viewer-scroll">
          <ScrollView {...(props as ScrollModeProps).scrollProps} />
        </div>
      );

    case "content":
      return (
        <div className={className} data-testid="shared-viewer-content">
          <ContentView {...(props as ContentModeProps).contentProps} />
        </div>
      );

    case "grid":
      return (
        <div className={className} data-testid="shared-viewer-grid">
          {(props as GridModeProps).children}
        </div>
      );

    default:
      return null;
  }
}
