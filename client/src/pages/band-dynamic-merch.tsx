import { Music, CheckCircle, Sparkles, Disc, Radio, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Update the destination anytime",
  "Tour ends? Switch to the new album",
  "Single drops? Link it instantly",
  "Same shirt - always current",
  "Track scans to see what fans engage with",
];

const scenarios = [
  {
    icon: Disc,
    title: "Album Releases",
    description: "Shirt linked to the old album? One click and it's pointing to the new one. No reprint.",
  },
  {
    icon: Radio,
    title: "Single Drops",
    description: "New single out Friday? Update the link Thursday night. Fans scan and hear it first.",
  },
  {
    icon: TrendingUp,
    title: "Tour Updates",
    description: "City to city, update the link to local show info, setlists, or exclusive content.",
  },
  {
    icon: Music,
    title: "Exclusive Content",
    description: "Rotate between behind-the-scenes, unreleased tracks, and fan Q&As. Keep them coming back.",
  },
];

export default function BandDynamicMerch() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Band Dynamic Merch | Merch That Never Goes Stale | QR Gear"
        description="Create band merch with QR codes you can update anytime. Tour ends? New album? Just update the link. Same shirt, always current. Track fan engagement."
        keywords="band merch QR, dynamic band shirt, updateable merch, tour merchandise, musician QR, album merch"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Music />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Dynamics™</p>
              <h1 className="vanity-title">Band Dynamic Merch</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Merch that never goes stale.</p>
          <p className="vanity-description">
            Tour ends? Update to the new album. Single drops? Link it. 
            Same shirt — always current.
          </p>
          <p className="vanity-description vanity-italic">
            Your music evolves. So should your merch.
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
            <h2 className="vanity-items-title">Keep it current:</h2>
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
                <TrendingUp />
              </div>
              <div className="vanity-highlight-content">
                <h3>See what works</h3>
                <p>
                  Track every scan. Know which cities, which days, which content gets traction. 
                  Data that helps you connect with fans.
                </p>
              </div>
            </div>
          </div>

          <Link href="/build?type=compose">
            <button className="vanity-cta" data-testid="button-create-band-dynamic">
              Create Your Dynamic Merch
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Disc />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/musician-merch">
                <div className="glass-card vanity-related-link">
                  <span>Musician Merch</span>
                  <p>Album art and video shirts</p>
                </div>
              </Link>
              <Link href="/artist-qr-apparel">
                <div className="glass-card vanity-related-link">
                  <span>Artist Portfolio Shirts</span>
                  <p>Wearable gallery for creatives</p>
                </div>
              </Link>
              <Link href="/advent-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Advent QR Shirts</span>
                  <p>Scheduled daily content</p>
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
