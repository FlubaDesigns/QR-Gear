import { Play, CheckCircle, ArrowRight, Heart, Home, Clock, Briefcase } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload any video file",
  "Plays instantly when the QR is scanned",
  "Cloud-hosted for fast, reliable playback",
  "Perfect for personal messages and storytelling",
  "Optional header/footer text on the product",
];

const personalUses = [
  {
    icon: Heart,
    title: "Grandpa Lives On",
    description: "The hoodie has his photo.\nScan it, and there he is — telling his favorite fishing story.\nForever.",
    link: "/memorial-video-shirts",
    linkText: "Memorial Ideas",
  },
  {
    icon: Home,
    title: "Home in Their Pocket",
    description: "The whole family recorded messages.\nNow every time they miss you, they scan the shirt.\nInstant comfort.",
    link: "/family-video-messages",
    linkText: "Family Message Ideas",
  },
  {
    icon: Clock,
    title: "A Message for Tomorrow",
    description: "Record a video for your child, partner, or future self.\nYears later, one scan brings your voice back to life.",
    link: "/video-time-capsule",
    linkText: "Time Capsule Ideas",
  },
];

const businessUses = [
  {
    title: "Training That Travels",
    description: "New hire scans the uniform, gets the how-to video. No shadowing needed.",
  },
  {
    title: "The Handshake Before the Handshake",
    description: "Client scans your polo. Watches your company story. By the time you meet, they already trust you.",
  },
];

export default function QRVideoLanding() {
  return (
    <div className="vanity-page">
      <SEO 
        title="QR Play | Video QR Code Products | QR Gear"
        description="Create QR Play merchandise - upload your video that plays instantly when scanned. Perfect for personal messages, memories, and stories meant to be seen, heard, and felt. USA options available."
        keywords="QR Play, video QR code, video message shirt, memorial video gift, personal video QR, scannable video merchandise"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Play />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">State: Motion</p>
              <h1 className="vanity-title">QR Play</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Bring your QR to life with video.</p>
          <p className="vanity-description">
            Upload a video that plays instantly in your hosted QR Space when scanned. 
            QR Play is built for real moments — messages, memories, and stories meant to be seen, heard, and felt.
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
              {personalUses.map((use, i) => (
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

          <div className="glass-card vanity-items vanity-muted">
            <h2 className="vanity-items-title">
              <Briefcase />
              Also great for business:
            </h2>
            <div className="vanity-scenarios-grid">
              {businessUses.map((use, i) => (
                <div key={i} className="vanity-scenario">
                  <h3>{use.title}</h3>
                  <p>{use.description}</p>
                </div>
              ))}
            </div>
          </div>

          <Link href="/creator?line=video">
            <button className="vanity-cta" data-testid="button-create-video">
              Create Your QR Play
              <ArrowRight />
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
