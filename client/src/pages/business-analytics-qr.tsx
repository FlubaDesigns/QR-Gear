import { TrendingUp, CheckCircle, Sparkles, BarChart3, RefreshCw, Target, Users, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Track every scan with detailed analytics",
  "See which rep, location, or campaign gets traction",
  "Update the destination mid-campaign",
  "No reprint required - ever",
  "A/B test different landing pages",
];

const capabilities = [
  {
    icon: BarChart3,
    title: "Scan Analytics",
    description: "How many scans? When? Where? Data that tells you what's working.",
  },
  {
    icon: RefreshCw,
    title: "Mid-Campaign Updates",
    description: "Promotion changing? New offer? Update the link without touching the shirt.",
  },
  {
    icon: Target,
    title: "Performance Tracking",
    description: "Issue different shirts to different reps. See who drives the most engagement.",
  },
  {
    icon: Users,
    title: "Team Insights",
    description: "Which team member's shirt gets scanned most? Which event had the best response?",
  },
];

export default function BusinessAnalyticsQR() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Business Analytics QR | The Shirt That Reports Back | QR Gear"
        description="Create business shirts with QR codes that track every scan. See what gets traction, update destinations mid-campaign, and optimize your marketing. No reprint required."
        keywords="business QR analytics, marketing QR shirt, trackable QR, campaign QR, sales analytics shirt, team performance QR"
      />
      <Navbar />
<main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <TrendingUp />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Dynamics™</p>
              <h1 className="vanity-title">Business Analytics QR</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">The shirt that reports back.</p>
          <p className="vanity-description">
            Track every scan. See which rep gets traction. 
            Update the destination mid-campaign without printing a thing.
          </p>
          <p className="vanity-description vanity-italic">
            Marketing that measures itself.
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
            <h2 className="vanity-items-title">Business intelligence built in:</h2>
            <div className="vanity-items-grid">
              {capabilities.map((cap, i) => (
                <div key={i} className="vanity-item">
                  <div className="vanity-item-icon">
                    <cap.icon />
                  </div>
                  <div className="vanity-item-content">
                    <h3>{cap.title}</h3>
                    <p>{cap.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Target />
              </div>
              <div className="vanity-highlight-content">
                <h3>Perfect for teams</h3>
                <p>
                  Each team member gets their own shirt, their own QR, their own analytics. 
                  Compare performance, optimize campaigns, reward top performers.
                </p>
              </div>
            </div>
          </div>

          <Link href="/build?type=compose">
            <button className="vanity-cta" data-testid="button-create-analytics">
              Create Your Analytics Shirt
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <BarChart3 />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/realtor-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Realtor QR Shirts</span>
                  <p>Updateable property listings</p>
                </div>
              </Link>
              <Link href="/business-qr-plus">
                <div className="glass-card vanity-related-link">
                  <span>Business QR Plus</span>
                  <p>Clear calls-to-action</p>
                </div>
              </Link>
              <Link href="/networking-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Networking Shirts</span>
                  <p>Digital business cards</p>
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
