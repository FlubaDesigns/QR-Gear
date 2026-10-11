import { Play, CheckCircle, ArrowRight, Heart, Home, Clock, Briefcase, Music } from "lucide-react";
import { Link } from "wouter";
import SEO from "@/components/SEO";
import IdeaLinks from "@/components/IdeaLinks";

const features = [
  "Upload a video or point to your favorite video URL",
  "Plays instantly when the QR is scanned",
  "Cloud-hosted for fast, reliable playback",
  "Perfect for personal messages and storytelling",
  "Optional header/footer text on the product",
];

const personalUses = [
  {
    icon: Music,
    title: "Music That Comes with the Merch",
    description: "Fans scan your shirt to watch a music video or live performance.",
    link: "/musician-merch",
    linkText: "Musician Merch Ideas",
  },
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
    <>
      <SEO 
        title="QR Play | Video QR Code Products | QR Gear"
        description="Create QR Play merchandise - upload your video that plays instantly when scanned. Perfect for personal messages, memories, and stories meant to be seen, heard, and felt. USA options available."
        keywords="QR Play, video QR code, video message shirt, memorial video gift, personal video QR, scannable video merchandise"
      />
      <div className="row py-6">

        <div className="row">
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
            Upload a video or point it at your favorite video URL — it plays instantly in your hosted QR Space when scanned. 
            QR Play is built for real moments — messages, memories, and stories meant to be seen, heard, and felt.
          </p>

          <div className="vanity-features">
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

          <div className="vanity-items">
            <h2 className="vanity-items-title">Popular Uses:</h2>
            <div className="layout__split-2">
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

          <div className="vanity-items vanity-muted">
            <h2 className="vanity-items-title">
              <Briefcase />
              Also great for business:
            </h2>
            <div className="layout__split-2">
              {businessUses.map((use, i) => (
                <div key={i} className="vanity-scenario">
                  <h3>{use.title}</h3>
                  <p>{use.description}</p>
                </div>
              ))}
            </div>
          </div>

          <section className="section row" aria-labelledby="more-ideas-title">
            <h2 id="more-ideas-title">More ideas &amp; occasions</h2>
            <IdeaLinks compact typeHref="/qr-play" exclude={personalUses.map(idea => idea.link)} />
          </section>

          <Link href="/build?type=play">
            <button className="vanity-cta" data-testid="button-create-video">
              Create Your QR Play
              <ArrowRight />
            </button>
          </Link>

        </div>
      </div>
    </>
  );
}
