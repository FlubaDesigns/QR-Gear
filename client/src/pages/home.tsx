import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import FeaturedProducts from "@/components/FeaturedProducts";
import AmericanMade from "@/components/AmericanMade";
import PreDesignedCollection from "@/components/PreDesignedCollection";
import SocialProof from "@/components/SocialProof";
import simplifiedIcon from "@assets/generated_images/simplified_qr_gear_icon.png";
import scannableQR from "@assets/qrgear_scannable_qr.png";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        {/* TEMP: Showing logos for review */}
        <div className="fixed top-20 left-4 z-50 bg-white p-4 rounded-lg shadow-xl border-4 border-cyan-500 max-w-md">
          <p className="text-black font-bold mb-2 text-center">Simplified Icon (for favicon):</p>
          <img src={simplifiedIcon} alt="Simplified QR Gear Icon" className="w-32 h-32 mx-auto mb-4" />
          
          <p className="text-black font-bold mb-2 text-center">Scannable QR (for full logo):</p>
          <img src={scannableQR} alt="Scannable QRGear.com QR Code" className="w-32 h-32 mx-auto mb-2" />
          <p className="text-black text-xs text-center">This scans to qrgear.com - add gear to bottom-right corner</p>
        </div>
        <Hero />
        <HowItWorks />
        <FeaturedProducts />
        <AmericanMade />
        <PreDesignedCollection />
        <SocialProof />
      </main>
    </div>
  );
}
