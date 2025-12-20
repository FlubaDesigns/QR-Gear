import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ActionCards, { QuickLinks } from "@/components/ActionCards";
import HowItWorks from "@/components/HowItWorks";
import ImpactStats from "@/components/ImpactStats";
import FeaturedProducts from "@/components/FeaturedProducts";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
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
