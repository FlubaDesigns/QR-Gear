import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";

export default function QRStaticPlusLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/creator?line=static-plus");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="QR + Text Products | QR Codes with Header & Footer Text"
        description="Create QR code merchandise with custom header and footer text. Add business name, phone, or message above and below your QR. USA-made products."
        keywords="QR with text, header footer QR, custom text QR code, QR business cards, QR merchandise with text"
      />
      <Navbar />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading QR + Text Creator...</p>
        </div>
      </div>
    </div>
  );
}
