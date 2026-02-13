import { Building2, CheckCircle, Sparkles, Home, MapPin, Calendar, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Update the listing link anytime",
  "Same polo - different property every week",
  "Track which listings get the most scans",
  "Open house? Update for the weekend",
  "No reprinting, no new shirts needed",
];

const scenarios = [
  {
    icon: Home,
    title: "Weekly Listings",
    description: "Monday it's the downtown condo. Friday it's the lakefront estate. Same shirt, different property.",
  },
  {
    icon: Calendar,
    title: "Open House Ready",
    description: "Update to the current listing before each open house. Visitors scan and get all the details.",
  },
  {
    icon: MapPin,
    title: "Neighborhood Tours",
    description: "Walking a new client around? Point to your shirt. They scan, they see the listing.",
  },
  {
    icon: Building2,
    title: "Portfolio Showcase",
    description: "Link to your full listings page. Or rotate through featured properties. You control it.",
  },
];

export default function RealtorQRShirts() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Realtor QR Shirts | One Polo, Infinite Listings | QR Gear"
        description="Create realtor shirts with QR codes you can update for every listing. Same polo, different property every week. Track scans and engagement. No reprinting needed."
        keywords="realtor QR shirt, real estate polo, listing QR code, open house shirt, agent merchandise, property QR"
      />
      <Navbar />
<main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Building2 />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Dynamics™</p>
              <h1 className="vanity-title">Realtor QR Shirts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">One polo, infinite listings.</p>
          <p className="vanity-description">
            Monday it's the downtown condo. Friday it's the lakefront estate. 
            Same shirt. Different property every week.
          </p>
          <p className="vanity-description vanity-italic">
            Your wardrobe stays simple. Your listings stay fresh.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Sparkles />
              What you get:
            </h2>
            <ul className="vanity-features-list">
              {features.map((feature, i) => (
                <li key={i} className="vanity-feature-item">
                  <CheckCircle />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card vanity-items">
            <h2 className="vanity-items-title">How realtors use it:</h2>
            <div className="vanity-items-grid">
              {scenarios.map((scenario, i) => (
                <div key={i} className="vanity-item">
                  <div className="vanity-item-icon">
                    <scenario.icon />
                  </div>
                  <div className="vanity-item-content">
                    <h3>{scenario.title}</h3>
                    <p>{scenario.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <MapPin />
              </div>
              <div className="vanity-highlight-content">
                <h3>Dress code friendly</h3>
                <p>
                  Polo shirts and professional apparel that look sharp at showings. 
                  The QR is subtle but scannable. Professional meets practical.
                </p>
              </div>
            </div>
          </div>

          <Link href="/build?type=compose">
            <button className="vanity-cta" data-testid="button-create-realtor">
              Create Your Realtor Shirt
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Building2 />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/business-qr-plus">
                <div className="glass-card vanity-related-link">
                  <span>Business QR Plus</span>
                  <p>Professional with text prompts</p>
                </div>
              </Link>
              <Link href="/networking-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Networking Shirts</span>
                  <p>Save contacts instantly</p>
                </div>
              </Link>
              <Link href="/business-analytics-qr">
                <div className="glass-card vanity-related-link">
                  <span>Business Analytics QR</span>
                  <p>Track engagement and performance</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-dynamics">
            <button className="vanity-back" data-testid="button-back-dynamics">
              ← Back to QR Dynamics™
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
