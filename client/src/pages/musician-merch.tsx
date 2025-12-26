import { Music, CheckCircle, Play, Disc, Users, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const canvasFeatures = [
  "Album art fills the screen when scanned",
  "High-res display, no cropping",
  "Add band name or song title as printed text",
  "Perfect for tour merch or online sales",
  "Each shirt is print-on-demand — no inventory",
];

const playFeatures = [
  "Upload a music video or live performance",
  "Fans scan and your video plays instantly",
  "No app needed — works in any phone browser",
  "Exclusive content your fans can wear",
];

const ideas = [
  {
    title: "Album Art Shirts",
    description: "Your cover art deserves better than a tiny square. Full screen, high res, every scan.",
  },
  {
    title: "Tour Merch",
    description: "Each city gets a shirt. Fans scan to see tour photos or exclusive behind-the-scenes.",
  },
  {
    title: "Music Video Shirts",
    description: "Upgrade to QR Play — fans scan and your video starts playing. Wearable media.",
  },
  {
    title: "Exclusive Drops",
    description: "Limited edition merch with unreleased content. Only people with the shirt can see it.",
  },
];

export default function MusicianMerch() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Musician Merch | Band Shirts with Scannable Media | QR Gear"
        description="Create band merch with scannable QR codes. Fans scan to see album art or watch music videos. Perfect for tours, album drops, and exclusive content. USA options available."
        keywords="band merch, musician shirts, album art shirts, tour merchandise, music video shirts, artist merch, band merchandise, QR music"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Music />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Canvas + QR Play</p>
              <h1 className="vanity-title">Musician Merch</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Merch that plays.</p>
          <p className="vanity-description">
            Your fans don't just wear your shirt — they interact with it. 
            Album art that fills their screen. Music videos that play on scan. 
            This is merch for the streaming era.
          </p>
          <p className="vanity-description vanity-italic">
            "Album art that plays when scanned."
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Disc />
              QR Canvas — Album Art:
            </h2>
            <ul className="vanity-features-list">
              {canvasFeatures.map((feature, i) => (
                <li key={i} className="vanity-feature-item">
                  <CheckCircle />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Play />
              QR Play — Video Content:
            </h2>
            <ul className="vanity-features-list">
              {playFeatures.map((feature, i) => (
                <li key={i} className="vanity-feature-item">
                  <CheckCircle />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card vanity-scenarios">
            <h2 className="vanity-scenarios-title">
              <Sparkles />
              Ideas for your drop:
            </h2>
            <div className="vanity-scenarios-grid">
              {ideas.map((idea, i) => (
                <div key={i} className="vanity-scenario">
                  <h3>{idea.title}</h3>
                  <p>{idea.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Users />
              </div>
              <div className="vanity-highlight-content">
                <h3>No minimums, no inventory</h3>
                <p>
                  Every shirt is made when ordered. Sell through your website, at shows, or wherever your fans find you. 
                  You focus on the music — we handle the printing.
                </p>
              </div>
            </div>
          </div>

          <div className="vanity-cta-group">
            <Link href="/creator?line=url">
              <button className="vanity-cta" data-testid="button-create-album-art">
                Create Album Art Merch (QR Canvas)
                <ArrowRight />
              </button>
            </Link>
            <Link href="/creator?line=video">
              <button className="vanity-cta-secondary" data-testid="button-create-video-merch">
                Create Video Merch (QR Play)
                <ArrowRight />
              </button>
            </Link>
          </div>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Sparkles />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/artist-qr-apparel">
                <div className="glass-card vanity-related-link">
                  <span>Artist Portfolio Shirts</span>
                  <p>Wearable gallery for visual artists</p>
                </div>
              </Link>
              <Link href="/band-dynamic-merch">
                <div className="glass-card vanity-related-link">
                  <span>Band Dynamic Merch</span>
                  <p>Updateable tour dates and setlists</p>
                </div>
              </Link>
              <Link href="/event-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Event QR Shirts</span>
                  <p>Perfect for concerts and festivals</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="vanity-back-group">
            <Link href="/qr-canvas">
              <button className="vanity-back" data-testid="button-back-canvas">
                ← Back to QR Canvas
              </button>
            </Link>
            <Link href="/qr-play">
              <button className="vanity-back" data-testid="button-see-play">
                See QR Play →
              </button>
            </Link>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
