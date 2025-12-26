import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ActionCards, { QuickLinks } from "@/components/ActionCards";
import HowItWorks from "@/components/HowItWorks";
import MarketingMessage, { HistoryTeaser } from "@/components/MarketingMessage";
import ImpactStats from "@/components/ImpactStats";
import FeaturedProducts from "@/components/FeaturedProducts";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="QR Gear - Custom QR Code Merchandise | Promotional Products"
        description="Create custom QR code merchandise with QR Gear. Apparel, hats, mugs, bags and more featuring your personalized QR codes. USA-made options available. Perfect for businesses, events, and leave-behind marketing."
        keywords="QR code merchandise, custom promotional products, QR code shirts, QR code hats, business marketing"
      />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ActionCards />
        <MarketingMessage />
        <HistoryTeaser />
        <QuickLinks />
        <HowItWorks />
        <ImpactStats />
        <FeaturedProducts />
      </main>
      <Footer />
    </div>
  );
}
