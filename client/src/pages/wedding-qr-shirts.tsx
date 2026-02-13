import { Heart, CheckCircle, Sparkles, Camera, Users, Gift, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload your favorite wedding photo",
  "Each guest gets a unique, personal keepsake",
  "Scan years later - memories come flooding back",
  "Perfect for rehearsal dinners, bachelorette parties, or the big day",
  "Optional text printed on the shirt (names, date, hashtag)",
];

const ideas = [
  {
    title: "First Dance Photo",
    description: "Capture that magical moment. Every time someone scans, they see you two dancing.",
  },
  {
    title: "Engagement Shoot",
    description: "Those gorgeous photos deserve more than a frame. Put them on shirts your guests will actually wear.",
  },
  {
    title: "The Whole Crew",
    description: "Wedding party shirts with the group photo. Bridesmaids and groomsmen will love it.",
  },
  {
    title: "Save the Date Shirts",
    description: "Pre-wedding hype. Guests scan to see details, photos, or your wedding website.",
  },
];

export default function WeddingQRShirts() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Wedding QR Shirts | Custom Photo Favors Your Guests Will Keep | QR Gear"
        description="Create unique wedding favor shirts with scannable QR codes. Guests scan to see your wedding photos. Personal, memorable, and they'll actually wear them. USA options available."
        keywords="wedding favors, wedding shirts, custom wedding gifts, QR wedding favors, photo wedding shirts, unique wedding ideas, personalized wedding gifts"
      />
      <Navbar />
<main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Heart />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Canvas</p>
              <h1 className="vanity-title">Wedding QR Shirts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Wearable wedding favors that actually mean something.</p>
          <p className="vanity-description">
            Forget the koozies nobody keeps. Give your guests something unique and personal — 
            a shirt they'll wear for years. And when they scan the QR? Your wedding photo fills their screen.
          </p>
          <p className="vanity-description vanity-italic">
            "Years later, they scan and see the couple's first dance photo. Timeless."
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Sparkles />
              Why couples love this:
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
            <h2 className="vanity-items-title">
              <Camera />
              Photo Ideas:
            </h2>
            <div className="vanity-items-grid vanity-scenarios">
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
                <Gift />
              </div>
              <div className="vanity-highlight-content">
                <h3>Bulk orders? We've got you.</h3>
                <p>
                  Planning for 50+ guests? Reach out for volume pricing. Every shirt is made-to-order with your custom QR.
                </p>
              </div>
            </div>
          </div>

          <Link href="/build?type=canvas">
            <button className="vanity-cta" data-testid="button-create-wedding">
              Create Your Wedding Shirts
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Users />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/family-reunion-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Family Reunion Shirts</span>
                  <p>Photo memories for the whole family</p>
                </div>
              </Link>
              <Link href="/memorial-qr-gifts">
                <div className="glass-card vanity-related-link">
                  <span>Memorial Photo Gifts</span>
                  <p>Honor loved ones with lasting tributes</p>
                </div>
              </Link>
              <Link href="/artist-qr-apparel">
                <div className="glass-card vanity-related-link">
                  <span>Artist Portfolio Shirts</span>
                  <p>Turn your artwork into wearables</p>
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
