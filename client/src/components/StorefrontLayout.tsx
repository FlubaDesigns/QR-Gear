import type { ReactNode } from "react";

/** Storefront content inherits the single application PageSkeleton. */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
