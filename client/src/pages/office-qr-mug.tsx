import { Coffee, CheckCircle, Tag, Smile, Building, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your name and contact info encoded in the QR",
  "Dishwasher safe, microwave safe",
  "High-quality ceramic that lasts",
  "Permanent QR - never wears off",
  "USA options available",
];

const scenarios = [
  {
    title: "The Chronic Borrower",
    description: "Karen takes your mug again. One scan tells her exactly whose it is. Name, desk, extension.",
  },
  {
    title: "The Conference Room Rescue",
    description: "Left your mug in meeting room C? Whoever finds it knows exactly where to return it.",
  },
  {
    title: "The Remote Worker",
    description: "Your mug goes to the coworking space with you. Now it has a permanent home address.",
  },
  {
    title: "The Personal Touch",
    description: "Add a fun message, your favorite quote, or a link to your Spotify playlist.",
  },
];

export default function OfficeQRMug() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Office QR Mug | The Mug That Finds Its Way Home | QR Gear"
        description="Create a personalized office mug with your contact info encoded in a QR code. Never lose your mug to the office borrower again. USA options available."
        keywords="office mug QR, personalized mug, contact info mug, office supplies QR, custom work mug, scannable mug"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Coffee />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Basics</p>
              <h1 className="vanity-title">Office QR Mug</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">The mug that finds its way home.</p>
          <p className="vanity-description">
            When Karen "borrows" your mug again, she'll know exactly whose it is. 
            Name, desk, extension - all encoded. One scan, zero confusion.
          </p>
          <p className="vanity-description vanity-italic">
            Finally, a mug that can speak for itself.
          </p>

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
            <h2 className="vanity-items-title">
              <Building />
              Office scenarios:
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
                <Smile />
              </div>
              <div className="vanity-highlight-content">
                <h3>Great team gift</h3>
                <p>
                  Order for the whole office. Each mug gets personalized with the person's info. 
                  No more mug mysteries in the break room.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=static">
            <button className="vanity-cta" data-testid="button-create-mug">
              Create Your Office Mug
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Building />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/networking-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Networking Shirts</span>
                  <p>Skip the business card shuffle</p>
                </div>
              </Link>
              <Link href="/website-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Website QR Shirts</span>
                  <p>Instant links to your site</p>
                </div>
              </Link>
              <Link href="/personal-items-qr">
                <div className="glass-card vanity-related-link">
                  <span>Personal Items QR</span>
                  <p>Claim your gear with style</p>
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
