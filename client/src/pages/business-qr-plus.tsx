import { Briefcase, CheckCircle, UtensilsCrossed, HelpCircle, Phone, Store, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Clear call-to-action above your QR",
  "Business name or instructions as footer",
  "No confusion, no hesitation",
  "Professional look for staff and products",
  "Permanent QR - reliable and lasting",
];

const uses = [
  {
    icon: UtensilsCrossed,
    title: "Restaurants & Cafes",
    description: "'SCAN FOR MENU' on staff shirts, table tents, window stickers. No more passing greasy menus.",
  },
  {
    icon: Phone,
    title: "Service Businesses",
    description: "'NEED HELP? SCAN ME' for plumbers, electricians, contractors. Instant access to your booking page.",
  },
  {
    icon: Store,
    title: "Retail & Pop-ups",
    description: "'SCAN FOR DETAILS' next to products. Specs, reviews, or buy-now links without the hard sell.",
  },
  {
    icon: HelpCircle,
    title: "Customer Support",
    description: "'SCAN FOR HELP' on equipment, packaging, or staff badges. Self-service support, always available.",
  },
];

export default function BusinessQRPlus() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Business QR Plus | Clear Calls-to-Action for Your Brand | QR Gear"
        description="Create professional QR products with clear prompts like 'SCAN FOR MENU' or 'NEED HELP? SCAN ME'. No confusion, no hesitation. USA options available."
        keywords="business QR, menu QR code, restaurant QR, service business QR, professional QR shirts, customer service QR"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Briefcase />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Plus</p>
              <h1 className="vanity-title">Business QR Plus</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Make it obvious.</p>
          <p className="vanity-description">
            No confusion. No hesitation. When customers see "SCAN FOR MENU" or "NEED HELP? SCAN ME" - 
            they know exactly what to do.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Briefcase />
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
            <h2 className="vanity-items-title">Business applications:</h2>
            <div className="vanity-items-grid">
              {uses.map((use, i) => (
                <div key={i} className="vanity-item">
                  <div className="vanity-item-icon">
                    <use.icon />
                  </div>
                  <div className="vanity-item-content">
                    <h3>{use.title}</h3>
                    <p>{use.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Store />
              </div>
              <div className="vanity-highlight-content">
                <h3>Uniform-ready</h3>
                <p>
                  Order for your whole team. Same QR, same message, consistent brand experience. 
                  Polo shirts, aprons, name badges - whatever fits your business.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=static-plus">
            <button className="vanity-cta" data-testid="button-create-business">
              Create Your Business QR
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Store />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/networking-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Networking Shirts</span>
                  <p>Save contacts with vCard</p>
                </div>
              </Link>
              <Link href="/website-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Website QR Shirts</span>
                  <p>Link to your portfolio</p>
                </div>
              </Link>
              <Link href="/realtor-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Realtor QR Shirts</span>
                  <p>Updateable real estate links</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-static-plus">
            <button className="vanity-back" data-testid="button-back-plus">
              ← Back to QR Plus
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
