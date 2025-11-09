import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import FeaturedProducts from "@/components/FeaturedProducts";
import AmericanMade from "@/components/AmericanMade";
import PreDesignedCollection from "@/components/PreDesignedCollection";
import SocialProof from "@/components/SocialProof";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <FeaturedProducts />
        <AmericanMade />
        <PreDesignedCollection />
        <SocialProof />
      </main>
      <Footer />
    </div>
  );
}
