import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ActionCards, { QuickLinks } from "@/components/ActionCards";
import HowItWorks from "@/components/HowItWorks";
import ImpactStats from "@/components/ImpactStats";
import FeaturedProducts from "@/components/FeaturedProducts";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="QR Gear - Custom QR Code Merchandise | USA-Made Promotional Products"
        description="Create custom QR code merchandise with QR Gear. USA-made apparel, hats, mugs, bags and more featuring your personalized QR codes. Perfect for businesses, events, and leave-behind marketing."
        keywords="QR code merchandise, custom promotional products, QR code shirts, QR code hats, USA made merchandise, business marketing"
      />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ActionCards />
        <QuickLinks />
        <HowItWorks />
        <ImpactStats />
        <FeaturedProducts />
      </main>
      <Footer />
    </div>
  );
}
