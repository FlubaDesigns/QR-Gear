import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AdminImagesBrowser } from "@/features/shared/components/AdminImagesBrowser";

class ImagesBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ImagesTab] CRASH:", error.message, error.stack);
    console.error("[ImagesTab] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
          <h3 className="font-bold text-lg mb-2">Images Error</h3>
          <p className="text-sm mb-2">{this.state.error?.message}</p>
          <pre className="text-xs overflow-auto max-h-40 bg-black/20 p-2 rounded">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded"
            data-testid="button-retry-images"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// VVSS 1·1·1·1: SinglePaneViewer → ScrollGridView → AdminImageCardSkin → AdminImageShape.
export default function ImagesTab() {
  return <ImagesBoundary><AdminImagesBrowser /></ImagesBoundary>;
}
