import { Link2, CheckCircle, Globe, Smartphone, Zap, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your URL encoded directly in the QR",
  "One tap lands them on your site",
  "No typing, no searching, no mistakes",
  "Works with any website, portfolio, or booking page",
  "Permanent QR - never expires",
];

const useCases = [
  {
    title: "Portfolio Access",
    description: "Artists, designers, photographers - wear your work. They scan, your portfolio opens.",
  },
  {
    title: "Booking Pages",
    description: "Consultants, coaches, service providers - skip the 'how do I book you?' Just scan.",
  },
  {
    title: "Social Profiles",
    description: "Link to your Instagram, TikTok, YouTube, or LinkTree. One scan, all your links.",
  },
  {
    title: "Event Registration",
    description: "Running an event? Wear the registration link. Instant sign-ups wherever you go.",
  },
];

export default function WebsiteQRShirts() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Website QR Shirts | Wearable Links to Your Site | QR Gear"
        description="Create shirts with QR codes that link directly to your website, portfolio, or booking page. One scan lands them on your site. No typing required. USA options available."
        keywords="website QR shirt, portfolio QR code, wearable link, booking page QR, URL QR shirt, scannable website shirt"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Link2 />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Basics</p>
              <h1 className="vanity-title">Website QR Shirts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Instant website access.</p>
          <p className="vanity-description">
            "Just scan my shirt." One tap lands them on your site, portfolio, or booking page. 
            No typing, no searching. Your URL, encoded and ready to go.
          </p>
          <p className="vanity-description vanity-italic">
            The easiest business card you'll ever hand out.
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
              <Globe />
              Perfect for:
            </h2>
            <div className="vanity-items-grid vanity-scenarios">
              {useCases.map((use, i) => (
                <div key={i} className="vanity-scenario">
                  <h3>{use.title}</h3>
                  <p>{use.description}</p>
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
                <h3>Works on any phone</h3>
                <p>
                  iPhone, Android, any camera app. Point, scan, done. No special apps needed.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=static">
            <button className="vanity-cta" data-testid="button-create-website">
              Create Your Website Shirt
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Globe />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/networking-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Networking Shirts</span>
                  <p>Save contacts instantly with vCard</p>
                </div>
              </Link>
              <Link href="/business-qr-plus">
                <div className="glass-card vanity-related-link">
                  <span>Business QR Plus</span>
                  <p>Add your tagline to the shirt</p>
                </div>
              </Link>
              <Link href="/realtor-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Realtor QR Shirts</span>
                  <p>Updateable listings and open houses</p>
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
