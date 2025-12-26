import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";

export default function QRDynamicsLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/creator?line=dynamics");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="QR Dynamics™ | Living QR Codes You Can Update Anytime"
        description="Create QR Dynamics - living QR codes that link to pages you control. Update your content anytime without reprinting. Premium subscription QR merchandise."
        keywords="QR Dynamics, dynamic QR code, living QR code, updateable QR, subscription QR, premium QR merchandise"
      />
      <Navbar />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading QR Dynamics™ Creator...</p>
        </div>
      </div>
    </div>
  );
}
