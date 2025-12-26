import { Users, CheckCircle, Handshake, Smartphone, Zap, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your vCard encoded directly in the QR",
  "Saves to their phone contacts instantly",
  "Name, email, phone, company, website - all in one scan",
  "No business cards to lose or forget",
  "Works at conferences, meetups, anywhere",
];

const scenarios = [
  {
    title: "Conference Mode",
    description: "Skip the business card shuffle. They scan, you're saved. Move on to the next connection.",
  },
  {
    title: "Networking Events",
    description: "You're in their phone before the handshake ends. Follow-up is already half done.",
  },
  {
    title: "Trade Shows",
    description: "Standing at your booth all day? Let them scan instead of collecting cards you'll never sort.",
  },
  {
    title: "Casual Encounters",
    description: "Met someone interesting at coffee? No need to fumble for a card. Just 'scan my shirt.'",
  },
];

export default function NetworkingQRShirts() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Networking QR Shirts | Skip the Business Card | QR Gear"
        description="Create shirts with QR codes that save your contact info directly to their phone. Skip the business card shuffle at conferences and networking events. USA options available."
        keywords="networking QR shirt, digital business card, vCard QR code, conference shirt, contact info QR, professional networking"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Users />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Basics</p>
              <h1 className="vanity-title">Networking QR Shirts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Networking on autopilot.</p>
          <p className="vanity-description">
            Skip the business card shuffle. They scan, your vCard saves. 
            You're in their phone before the handshake ends.
          </p>
          <p className="vanity-description vanity-italic">
            The business card you wear, not carry.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Zap />
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
            <h2 className="vanity-items-title">
              <Handshake />
              Perfect for:
            </h2>
            <div className="vanity-items-grid vanity-scenarios">
              {scenarios.map((scenario, i) => (
                <div key={i} className="vanity-scenario">
                  <h3>{scenario.title}</h3>
                  <p>{scenario.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Smartphone />
              </div>
              <div className="vanity-highlight-content">
                <h3>vCard magic</h3>
                <p>
                  When they scan, their phone asks to save your contact. One tap and you're in. 
                  Name, email, phone, company, website - all of it.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=static">
            <button className="vanity-cta" data-testid="button-create-networking">
              Create Your Networking Shirt
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Handshake />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/website-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Website QR Shirts</span>
                  <p>Link directly to your portfolio</p>
                </div>
              </Link>
              <Link href="/business-qr-plus">
                <div className="glass-card vanity-related-link">
                  <span>Business QR Plus</span>
                  <p>Add company branding text</p>
                </div>
              </Link>
              <Link href="/realtor-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Realtor QR Shirts</span>
                  <p>Dynamic content for real estate</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-static">
            <button className="vanity-back" data-testid="button-back-basics">
              ← Back to QR Basics
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
