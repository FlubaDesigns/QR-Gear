import { Sparkles, CheckCircle, ArrowRight, Calendar, Music, Building2, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your personal QR Space — hosted digital real estate",
  "Space Terms: 1 year, 3 year, or 5 year options",
  "Scheduled changes — set it and forget it",
  "Rotating content — cycle through multiple destinations",
  "Daily sequences — prayers, tips, countdowns, advent calendars",
  "User-controlled updates without reprinting",
  "Scan analytics and tracking",
  "Easy Space Renewal when your term ends",
];

const popularUses = [
  {
    icon: Calendar,
    title: "12 Days of Christmas, Automated",
    description: "Day 1: A new devotional.\nDay 2: A different verse.\nDay 12: The grand finale.\nSet it once. It runs itself.",
    link: "/advent-qr-shirts",
    linkText: "Advent Ideas",
  },
  {
    icon: Music,
    title: "Merch That Never Goes Stale",
    description: "Tour ends? Update to the new album.\nSingle drops? Link it.\nSame shirt — always current.",
    link: "/band-dynamic-merch",
    linkText: "Band Merch Ideas",
  },
  {
    icon: Building2,
    title: "One Polo, Infinite Listings",
    description: "Monday it's the downtown condo.\nFriday it's the lakefront estate.\nSame shirt. Different property every week.",
    link: "/realtor-qr-shirts",
    linkText: "Realtor Ideas",
  },
  {
    icon: TrendingUp,
    title: "The Shirt That Reports Back",
    description: "Track every scan.\nSee what gets traction.\nUpdate the destination mid-campaign — no reprint required.",
    link: "/business-analytics-qr",
    linkText: "Business Ideas",
  },
];

export default function QRDynamicsLanding() {
  return (
    <div className="vanity-page">
      <SEO 
        title="QR Dynamics™ | Living QR Codes You Can Update Anytime"
        description="Create QR Dynamics - living QR codes that link to pages you control. Update content, schedule changes, rotate destinations, track engagement. Premium subscription QR merchandise."
        keywords="QR Dynamics, dynamic QR code, living QR code, updateable QR, subscription QR, scheduled QR, analytics QR"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Sparkles />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">State: Living</p>
              <h1 className="vanity-title">QR Dynamics™</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Content that changes over time.</p>
          <p className="vanity-description">
            Your personal QR Space — digital real estate you control. 
            QR Dynamics™ is the only state where your QR evolves. Update content, schedule changes, 
            rotate destinations, and track engagement — all without reprinting a thing.
          </p>
          <p className="vanity-description">
            Choose your Space Term (1 year / 3 year / 5 year) and manage content that lives, moves, and grows.
          </p>

          <div className="glass-card premium vanity-features">
            <h2 className="vanity-features-title">What you get:</h2>
            <ul className="vanity-features-list">
              {features.map((feature, i) => (
                <li key={i} className="vanity-feature-item">
                  <CheckCircle />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card premium vanity-items">
            <h2 className="vanity-items-title">Popular Uses:</h2>
            <div className="vanity-use-cases-grid">
              {popularUses.map((use, i) => (
                <div key={i} className="vanity-use-case">
                  <div className="vanity-use-case-icon">
                    <use.icon />
                  </div>
                  <div className="vanity-use-case-content">
                    <h3>{use.title}</h3>
                    <p className="vanity-use-case-multiline">{use.description}</p>
                    <Link href={use.link}>
                      <button className="vanity-btn-outline" data-testid={`button-use-${i}`}>
                        {use.linkText}
                        <ArrowRight />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight vanity-centered">
            <p className="vanity-tagline">QR Dynamics™ isn't a link.</p>
            <p className="vanity-title-accent">It's space.</p>
          </div>

          <Link href="/creator?line=dynamics">
            <button className="vanity-cta" data-testid="button-create-dynamics">
              Create Your QR Dynamics
              <ArrowRight />
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
