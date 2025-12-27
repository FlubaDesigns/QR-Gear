import { Link } from "wouter";
import { Shield } from "lucide-react";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Hero from "@/components/Hero";
import ActionCards, { QuickLinks } from "@/components/ActionCards";
import HowItWorks from "@/components/HowItWorks";
import MarketingMessage, { HistoryTeaser } from "@/components/MarketingMessage";
import FeaturedProducts from "@/components/FeaturedProducts";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";

function AdminQuickAccess() {
  const { isAdmin } = useAuth();
  
  if (!isAdmin) return null;
  
  return (
    <div className="admin-quick-bar">
      <Link href="/admin/dashboard" className="admin-quick-link" data-testid="link-admin-quick">
        <Shield className="w-4 h-4" />
        Admin Dashboard
      </Link>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="QR Gear - Custom QR Code Merchandise | Promotional Products"
        description="Create custom QR code merchandise with QR Gear. Apparel, hats, mugs, bags and more featuring your personalized QR codes. USA-made options available. Perfect for businesses, events, and leave-behind marketing."
        keywords="QR code merchandise, custom promotional products, QR code shirts, QR code hats, business marketing"
      />
      <Navbar />
      <BreadcrumbTrail />
      <AdminQuickAccess />
      <main className="flex-1">
        <Hero />
        <ActionCards />
        <MarketingMessage />
        <HistoryTeaser />
        <QuickLinks />
        <HowItWorks />
        <FeaturedProducts />
      </main>
      <Footer />
    </div>
  );
}
