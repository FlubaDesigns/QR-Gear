import { Tag, CheckCircle, User, Shirt, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Custom header text above your QR",
  "Footer text for instructions or contact",
  "Clear context before anyone scans",
  "Permanent QR code (no expiration)",
  "USA options available",
];

const exampleTexts = [
  "IF FOUND, PLEASE CALL",
  "THIS BELONGS TO JESS",
  "MEDICAL INFO – SCAN",
  "PROPERTY OF THE SMITHS",
  "RETURN TO OWNER",
];

const items = [
  {
    icon: Shirt,
    title: "Jackets & Hoodies",
    description: "Left your hoodie at the gym? The finder knows exactly what to do. 'IF FOUND' plus your contact.",
  },
  {
    icon: User,
    title: "Bags & Totes",
    description: "Gym bags, backpacks, totes. Your stuff, permanently claimed.",
  },
];

export default function PersonalItemsQR() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Personal Items QR | Label Your Stuff With Style | QR Gear"
        description="Create QR gear for personal items with 'IF FOUND' text and contact info. Perfect for hoodies, bags, and anything you don't want to lose. USA options available."
        keywords="personal QR code, lost and found QR, emergency contact QR, QR for personal items, QR labels for belongings"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Tag />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Plus</p>
              <h1 className="vanity-title">Personal Items QR</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Simple words make all the difference when it matters.</p>
          <p className="vanity-description">
            Add a header like "If Found, Please Call" so people know exactly what to do before they scan. 
            Context first. Action second.
          </p>

          <div className="vanity-example-tags">
            {exampleTexts.map((text, i) => (
              <span key={i} className="vanity-example-tag">{text}</span>
            ))}
          </div>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Tag />
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
            <h2 className="vanity-items-title">Print on your gear:</h2>
            <div className="vanity-items-grid">
              {items.map((item, i) => (
                <div key={i} className="vanity-item">
                  <div className="vanity-item-icon">
                    <item.icon />
                  </div>
                  <div className="vanity-item-content">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link href="/creator?line=static-plus">
            <button className="vanity-cta" data-testid="button-create-personal">
              Create Your Personal QR Gear
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Tag />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/lost-found-qr">
                <div className="glass-card vanity-related-link">
                  <span>Lost & Found QR</span>
                  <p>Tag bags and travel gear</p>
                </div>
              </Link>
              <Link href="/everyday-qr">
                <div className="glass-card vanity-related-link">
                  <span>Everyday QR</span>
                  <p>Simple prompts for daily use</p>
                </div>
              </Link>
              <Link href="/office-qr-mug">
                <div className="glass-card vanity-related-link">
                  <span>Office QR Mug</span>
                  <p>Claim your mug at work</p>
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
