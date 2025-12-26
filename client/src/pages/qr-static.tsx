import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";

export default function QRStaticLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/creator?line=static");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Simple QR Code Products | Basic Text & URL QR Gear"
        description="Create simple QR code merchandise with basic text or URL encoding. Perfect for business cards, contact info, and direct links. USA-made products."
        keywords="simple QR code, basic QR products, text QR code, URL QR code, QR merchandise"
      />
      <Navbar />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading Simple QR Creator...</p>
        </div>
      </div>
    </div>
  );
}
