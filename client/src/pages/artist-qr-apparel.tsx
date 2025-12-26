import { Palette, CheckCircle, Brush, Image, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your artwork fills their entire screen when scanned",
  "No cropping, no compression — full resolution display",
  "Mobile-optimized 9:16 vertical format",
  "Works for paintings, photos, digital art, designs",
  "Add your signature, title, or website as printed text",
];

const artistTypes = [
  {
    title: "Painters & Illustrators",
    description: "Your canvas work, full screen. Every scan is a mini gallery showing.",
  },
  {
    title: "Photographers",
    description: "That shot you're most proud of. Not a thumbnail — the whole thing, high-res.",
  },
  {
    title: "Digital Artists & Designers",
    description: "Your portfolio piece becomes wearable. Clients scan and see your work instantly.",
  },
  {
    title: "Tattoo Artists",
    description: "Flash sheets or finished pieces. Walking advertisement that people actually want to look at.",
  },
];

export default function ArtistQRApparel() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Artist QR Apparel | Wearable Portfolio Shirts | QR Gear"
        description="Turn your artwork into wearable merch. When people scan, your art fills their screen. Perfect for painters, photographers, designers, and digital artists. USA options available."
        keywords="artist merch, custom artist shirts, photographer apparel, wearable portfolio, art QR shirts, designer merchandise, creative apparel"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Palette />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Canvas</p>
              <h1 className="vanity-title">Artist QR Apparel</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Your art, full screen.</p>
          <p className="vanity-description">
            Painters, photographers, designers — your work becomes the destination. 
            When someone scans your shirt, your art fills their entire screen. No app. No gallery visit. Just your work, front and center.
          </p>
          <p className="vanity-description vanity-italic">
            "A portable gallery on every shirt."
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Sparkles />
              Why artists love this:
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

          <div className="glass-card vanity-scenarios">
            <h2 className="vanity-scenarios-title">
              <Brush />
              Made for creatives:
            </h2>
            <div className="vanity-scenarios-grid">
              {artistTypes.map((type, i) => (
                <div key={i} className="vanity-scenario">
                  <h3>{type.title}</h3>
                  <p>{type.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Image />
              </div>
              <div className="vanity-highlight-content">
                <h3>Sell your merch</h3>
                <p>
                  Create once, sell forever. Your fans wear your art and become walking galleries. 
                  Each shirt is print-on-demand — no inventory, no minimums.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=url">
            <button className="vanity-cta" data-testid="button-create-artist">
              Create Your Artist Merch
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Brush />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/musician-merch">
                <div className="glass-card vanity-related-link">
                  <span>Musician Merch</span>
                  <p>Album art and video shirts for bands</p>
                </div>
              </Link>
              <Link href="/band-dynamic-merch">
                <div className="glass-card vanity-related-link">
                  <span>Band Dynamic Merch</span>
                  <p>Updateable tour dates and content</p>
                </div>
              </Link>
              <Link href="/wedding-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Wedding Photo Shirts</span>
                  <p>Event photography on apparel</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-canvas">
            <button className="vanity-back" data-testid="button-back-canvas">
              ← Back to QR Canvas
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
