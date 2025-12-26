import { QrCode, CheckCircle, Link2, Coffee, Dumbbell, Briefcase, Heart, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Encode any text, URL, or contact info",
  "Up to 2,000 characters - that's a LOT of info!",
  "Permanent QR - never expires or changes",
  "USA options available",
];

const examples = [
  {
    icon: Link2,
    title: "Instant Website Access",
    description: "\"Just scan my shirt.\" One tap lands them on your site, portfolio, or booking page. No typing, no searching.",
    link: "/website-qr-shirts",
    linkText: "Website Ideas",
  },
  {
    icon: Coffee,
    title: "The Mug That Finds Its Way Home",
    description: "When Karen \"borrows\" your mug again, she'll know exactly whose it is. Name, desk, extension - all encoded.",
    link: "/office-qr-mug",
    linkText: "Office Mug Ideas",
  },
  {
    icon: Dumbbell,
    title: "Lost & Found Hero",
    description: "Gym bag goes missing? Your contact info is baked right in. Good samaritans just scan and call.",
    link: "/lost-found-qr",
    linkText: "Lost & Found Ideas",
  },
  {
    icon: Briefcase,
    title: "Networking on Autopilot",
    description: "Skip the business card shuffle. They scan, your vCard saves. You're in their phone before the handshake ends.",
    link: "/networking-qr-shirts",
    linkText: "Networking Ideas",
  },
  {
    icon: Heart,
    title: "Silent Lifesaver",
    description: "Allergies. Blood type. Emergency contacts. Medications. When you can't speak, your shirt can.",
    link: "/medical-alert-qr",
    linkText: "Medical Alert Ideas",
  },
];

export default function QRStaticLanding() {
  return (
    <div className="vanity-page">
      <SEO 
        title="QR Basics | Text & URL QR Code Products | QR Gear"
        description="Create QR Basics merchandise - encode text, URLs, or contact info directly into a permanent QR code. Perfect for business cards, contact info, and direct links. USA options available."
        keywords="QR Basics, simple QR code, basic QR products, text QR code, URL QR code, QR merchandise"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <QrCode />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">State: Permanent</p>
              <h1 className="vanity-title">QR Basics</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">A clean, scannable QR code.</p>
          <p className="vanity-description">Permanent. No subscriptions. Just works.</p>
          
          <p className="vanity-description">
            Encode your text, URL, or contact info directly into a permanent QR code printed on quality merchandise.
            Need a simple link to your website? This is it.
          </p>
          <p className="vanity-description vanity-italic">
            Best for: websites, contact info, lost & found, emergency info
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">What you get:</h2>
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
            <h2 className="vanity-items-title">Popular Uses:</h2>
            <div className="vanity-use-cases-grid">
              {examples.map((example, i) => (
                <div key={i} className="vanity-use-case">
                  <div className="vanity-use-case-icon">
                    <example.icon />
                  </div>
                  <div className="vanity-use-case-content">
                    <h3>{example.title}</h3>
                    <p>{example.description}</p>
                    <Link href={example.link}>
                      <button className="vanity-btn-outline" data-testid={`button-use-${i}`}>
                        {example.linkText}
                        <ArrowRight />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link href="/creator?line=static">
            <button className="vanity-cta" data-testid="button-create-static">
              Create Your QR Basics
              <ArrowRight />
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
