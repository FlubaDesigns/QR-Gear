import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import ImpactStats from "@/components/ImpactStats";
import FeaturedProducts from "@/components/FeaturedProducts";
import AmericanMade from "@/components/AmericanMade";
import PreDesignedCollection from "@/components/PreDesignedCollection";
import SocialProof from "@/components/SocialProof";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <ImpactStats />
        <FeaturedProducts />
        <PreDesignedCollection />
        <AmericanMade />
        <SocialProof />
      </main>
    </div>
  );
}
