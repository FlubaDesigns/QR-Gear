import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";

export default function QRVideoLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/creator?line=video");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Video QR Products | Upload Video for Scannable Merchandise"
        description="Upload your video and create scannable QR merchandise. Perfect for video messages, tutorials, and multimedia content. USA-made products."
        keywords="video QR code, video QR products, scannable video, multimedia QR, video merchandise"
      />
      <Navbar />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading Video QR Creator...</p>
        </div>
      </div>
    </div>
  );
}
