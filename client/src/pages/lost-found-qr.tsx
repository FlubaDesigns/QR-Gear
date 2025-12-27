import { MapPin, CheckCircle, Dumbbell, Backpack, Briefcase, Dog, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your contact info encoded in the QR",
  "Works on bags, gear, anything you might lose",
  "Good samaritans just scan and call",
  "No app needed - any phone camera works",
  "Permanent QR - never wears off",
];

const items = [
  {
    icon: Dumbbell,
    title: "Gym Bags",
    description: "Left at the gym? In the locker? Someone finds it, scans it, calls you.",
  },
  {
    icon: Backpack,
    title: "Backpacks & Luggage",
    description: "Travel gear that knows how to get home. Airport, hotel, Uber - covered.",
  },
  {
    icon: Briefcase,
    title: "Laptop Bags",
    description: "Your work bag with your work contact. IT will thank you.",
  },
  {
    icon: Dog,
    title: "Pet Owner Gear",
    description: "Your dog-walking hoodie, your pet sitter bag. People know who to call.",
  },
];

export default function LostFoundQR() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Lost & Found QR | Never Lose Your Gear Again | QR Gear"
        description="Add QR codes to your bags, luggage, and gear with your contact info. Good samaritans scan and call you. Perfect for gym bags, backpacks, and travel gear. USA options available."
        keywords="lost and found QR, gym bag QR, backpack QR code, contact info QR, gear identification, custom bags"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <MapPin />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Basics</p>
              <h1 className="vanity-title">Lost & Found QR</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Lost & Found Hero.</p>
          <p className="vanity-description">
            Gym bag goes missing? Your contact info is baked right in. 
            Good samaritans just scan and call. No apps, no accounts, no friction.
          </p>
          <p className="vanity-description vanity-italic">
            Your stuff, permanently tagged and ready to come home.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <MapPin />
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
            <h2 className="vanity-items-title">Print on everything that travels:</h2>
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

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Backpack />
              </div>
              <div className="vanity-highlight-content">
                <h3>Printed on quality gear</h3>
                <p>
                  T-shirts, hoodies, bags, mugs - put your contact info on something you'll actually use and wear. 
                  When your stuff gets left behind, it knows how to come home.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=static">
            <button className="vanity-cta" data-testid="button-create-lost-found">
              Create Your Lost & Found Gear
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <MapPin />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/medical-alert-qr">
                <div className="glass-card vanity-related-link">
                  <span>Medical Alert QR</span>
                  <p>Emergency info when you need it</p>
                </div>
              </Link>
              <Link href="/personal-items-qr">
                <div className="glass-card vanity-related-link">
                  <span>Personal Items QR</span>
                  <p>Claim all your gear</p>
                </div>
              </Link>
              <Link href="/everyday-qr">
                <div className="glass-card vanity-related-link">
                  <span>Everyday QR</span>
                  <p>Practical QR for daily life</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-basics">
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
