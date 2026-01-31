import { ScrollView, type ScrollViewProps } from "./views/ScrollView";
import { ContentView, type ContentViewProps } from "./views/ContentView";
import { GalleryView, type GalleryViewProps } from "./views/GalleryView";

export type ViewMode = "scroll" | "content" | "grid" | "gallery";

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

interface GalleryModeProps extends SharedViewerBaseProps {
  mode: "gallery";
  galleryProps: GalleryViewProps;
}

export type SharedViewerProps = ScrollModeProps | ContentModeProps | GridModeProps | GalleryModeProps;

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

    case "gallery":
      return (
        <GalleryView {...(props as GalleryModeProps).galleryProps} />
      );

    default:
      return null;
  }
}

export { GalleryView, type GalleryViewProps, type GalleryViewItem } from "./views/GalleryView";
