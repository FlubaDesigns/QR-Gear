import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";

interface StorefrontLayoutProps {
  children: ReactNode;
}

export default function StorefrontLayout({ children }: StorefrontLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {children}
    </div>
  );
}
