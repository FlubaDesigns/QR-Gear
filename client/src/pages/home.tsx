import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import FeaturedProducts from "@/components/FeaturedProducts";
import AmericanMade from "@/components/AmericanMade";
import PreDesignedCollection from "@/components/PreDesignedCollection";
import SocialProof from "@/components/SocialProof";
import simplifiedIcon from "@assets/generated_images/simplified_qr_gear_icon.png";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        {/* TEMP: Showing simplified icon for review */}
        <div className="fixed top-20 left-4 z-50 bg-white p-4 rounded-lg shadow-xl border-4 border-cyan-500">
          <p className="text-black font-bold mb-2 text-center">Simplified Icon:</p>
          <img src={simplifiedIcon} alt="Simplified QR Gear Icon" className="w-48 h-48" />
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
