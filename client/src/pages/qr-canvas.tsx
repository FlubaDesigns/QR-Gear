import { Palette, CheckCircle, Heart, Camera, Users, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload your own background image",
  "Or choose from pre-designed templates",
  "Easy crop tool to frame it just right",
  "Mobile-optimized 9:16 display",
  "Optional header/footer text on the product",
];

const popularUses = [
  {
    icon: Heart,
    title: "The Gift That Keeps Giving",
    description: "Grandma scans the hoodie.\nHer screen fills with the family reunion photo.\nTears guaranteed.",
    link: "/family-reunion-shirts",
    linkText: "Family & Gift Ideas",
  },
  {
    icon: Sparkles,
    title: "Wearable Wedding Favors",
    description: "Guests take home shirts.\nYears later, they scan and see the couple's first dance photo.\nTimeless.",
    link: "/wedding-qr-shirts",
    linkText: "Wedding Ideas",
  },
  {
    icon: Camera,
    title: "Your Art, Full Screen",
    description: "Painters, photographers, designers —\nyour work becomes the destination.\nA portable gallery on every shirt.",
    link: "/artist-qr-apparel",
    linkText: "Artist Ideas",
  },
  {
    icon: Users,
    title: "Memories You Can Wear",
    description: "A favorite vacation.\nA loved one.\nA moment you don't want to lose.\nScan and relive it — instantly.",
    link: "/memorial-qr-gifts",
    linkText: "Memory Ideas",
  },
];

export default function QRUrlLanding() {
  return (
    <div className="vanity-page">
      <SEO 
        title="QR Canvas | Custom Background QR Products | QR Gear"
        description="Create QR Canvas merchandise - upload your own image that appears when people scan your QR. Perfect for weddings, family gifts, artists, and treasured memories. USA options available."
        keywords="QR Canvas, custom QR background, wedding QR shirts, family photo gifts, artist QR apparel, memorial QR gifts"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Palette />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">State: Visual</p>
              <h1 className="vanity-title">QR Canvas</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Design a custom image your QR opens to.</p>
          <p className="vanity-description">
            Your creative canvas for the scan experience. When someone scans your QR, they land on your hosted QR Space 
            showing a custom background image — a photo, artwork, memory, or moment. Upload your own or choose from templates.
            Optional header and footer text can be printed on the product.
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
              {popularUses.map((use, i) => (
                <div key={i} className="vanity-use-case">
                  <div className="vanity-use-case-icon">
                    <use.icon />
                  </div>
                  <div className="vanity-use-case-content">
                    <h3>{use.title}</h3>
                    <p className="vanity-use-case-multiline">{use.description}</p>
                    <Link href={use.link}>
                      <button className="vanity-btn-outline" data-testid={`button-use-${i}`}>
                        {use.linkText}
                        <ArrowRight />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link href="/creator?line=url">
            <button className="vanity-cta" data-testid="button-create-canvas">
              Create Your QR Canvas
              <ArrowRight />
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
