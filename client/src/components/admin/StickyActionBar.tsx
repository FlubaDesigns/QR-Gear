import type { ReactNode } from "react";

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
}

export default function StickyActionBar({ children, className = "" }: StickyActionBarProps) {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 ${className}`}
      data-testid="sticky-action-bar"
    >
      <div className="mx-auto max-w-[640px] flex items-center justify-end gap-3">
        {children}
      </div>
    </div>
  );
}
