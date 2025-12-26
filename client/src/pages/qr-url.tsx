import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";

export default function QRUrlLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/creator?line=url");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Gift Background QR Products | Pre-Designed QR Templates"
        description="Choose from beautiful pre-designed backgrounds for your QR code gifts. Religious, sports, business themes with perfect QR placement. USA-made merchandise."
        keywords="QR gift backgrounds, QR templates, pre-designed QR, gift QR products, themed QR merchandise"
      />
      <Navbar />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading Gift Background Creator...</p>
        </div>
      </div>
    </div>
  );
}
