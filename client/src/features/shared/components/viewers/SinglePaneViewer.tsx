import type { ReactNode } from "react";

// VVSS Viewer: SinglePaneViewer (digit 1, code 1)
// Single pane — one full-width panel.
// Owns the structural container only.
// Does not control scrolling, item rendering, or popup behavior.

export interface SinglePaneViewerProps {
  children: ReactNode;
  className?: string;
}

export function SinglePaneViewer({ children, className }: SinglePaneViewerProps) {
  return (
    <div className={`w-full ${className ?? ""}`}>
      {children}
    </div>
  );
}
