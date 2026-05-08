import type { ReactNode } from "react";

// VVS Viewer code: 2
// Two pane — side by side.
// Left pane: list/grid. Right pane: detail.
// Owns the structural container only.
// Does not control scrolling, item rendering, or popup behavior.

export interface TwoPaneViewerProps {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: string;
  className?: string;
}

export function TwoPaneViewer({
  left,
  right,
  leftWidth = "w-1/3",
  className,
}: TwoPaneViewerProps) {
  return (
    <div className={`flex h-full gap-4 ${className ?? ""}`}>
      <div className={`${leftWidth} flex-shrink-0 overflow-hidden`}>
        {left}
      </div>
      <div className="flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  );
}
