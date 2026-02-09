import { Lightbulb, CheckCircle, HelpCircle, BookOpen, Info, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Simple prompts that invite curiosity",
  "Header and footer text on the product",
  "Works for any link or content",
  "Small text, big clarity",
  "Permanent QR - always ready",
];

const exampleTexts = [
  "SCAN TO LEARN MORE",
  "SCAN FOR INSTRUCTIONS",
  "SCAN FOR THE STORY",
  "CURIOUS? SCAN ME",
  "SCAN FOR DETAILS",
];

const uses = [
  {
    icon: BookOpen,
    title: "The Story Behind It",
    description: "Handmade products. Art pieces. Vintage finds. 'SCAN FOR THE STORY' adds soul — and context — to any item.",
  },
  {
    icon: HelpCircle,
    title: "How-To Instructions",
    description: "'SCAN FOR INSTRUCTIONS' on anything that needs explaining. Assembly, care, recipes.",
  },
  {
    icon: Info,
    title: "Learn More",
    description: "Products, causes, hobbies. Give people a way to dig deeper when they're curious.",
  },
  {
    icon: Sparkles,
    title: "Hidden Extras",
    description: "'SCAN ME' with a wink. Easter eggs, bonus content, surprises for the observant.",
  },
];

export default function EverydayQR() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Everyday QR | Simple Prompts That Invite Curiosity | QR Gear"
        description="Create QR products with simple prompts like 'SCAN TO LEARN MORE' or 'SCAN FOR THE STORY'. Small text, big clarity. USA options available."
        keywords="everyday QR, scan to learn, simple QR code, curiosity QR, story QR, instructions QR"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Lightbulb />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Plus</p>
              <h1 className="vanity-title">Everyday QR</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Small text. Big clarity — every day.</p>
          <p className="vanity-description">
            Sometimes you just need a gentle prompt. "SCAN TO LEARN MORE" or "SCAN FOR THE STORY" — 
            simple words that invite curiosity without overselling, wherever your gear goes.
          </p>

          <div className="vanity-example-tags">
            {exampleTexts.map((text, i) => (
              <span key={i} className="vanity-example-tag">{text}</span>
            ))}
          </div>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Lightbulb />
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
            <h2 className="vanity-items-title">Works for:</h2>
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

          <Link href="/build?type=plus">
            <button className="vanity-cta" data-testid="button-create-everyday">
              Create Your Everyday QR
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Lightbulb />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/personal-items-qr">
                <div className="glass-card vanity-related-link">
                  <span>Personal Items QR</span>
                  <p>Label your belongings</p>
                </div>
              </Link>
              <Link href="/lost-found-qr">
                <div className="glass-card vanity-related-link">
                  <span>Lost & Found QR</span>
                  <p>Tag things that travel</p>
                </div>
              </Link>
              <Link href="/office-qr-mug">
                <div className="glass-card vanity-related-link">
                  <span>Office QR Mug</span>
                  <p>Stop the office mug thief</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-plus">
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
