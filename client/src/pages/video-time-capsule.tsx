import { Clock, CheckCircle, Baby, Heart, GraduationCap, Gift, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Record a message for the future",
  "Scan years later to hear your own voice",
  "Perfect for kids, partners, or yourself",
  "Cloud-hosted and preserved",
  "A gift that gains meaning with time",
];

const ideas = [
  {
    icon: Baby,
    title: "For Your Child",
    description: "Record a message when they're born. Give them the shirt on their 18th birthday. Watch them cry (happy tears).",
  },
  {
    icon: Heart,
    title: "For Your Partner",
    description: "Anniversary coming up? Record why you love them. Save it for a decade from now.",
  },
  {
    icon: GraduationCap,
    title: "For Your Future Self",
    description: "What would you tell yourself 10 years from now? Record it. Wear the reminder.",
  },
  {
    icon: Gift,
    title: "Milestone Moments",
    description: "Graduations, weddings, new jobs. Capture the feeling right now. Relive it whenever you scan.",
  },
];

export default function VideoTimeCapsule() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Video Time Capsule | A Message for Tomorrow | QR Gear"
        description="Record a video for your child, partner, or future self. Years later, one scan brings your voice back to life. The gift that gains meaning with time."
        keywords="video time capsule, future message, message for child, future self video, time capsule shirt, milestone gift"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Clock />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Play</p>
              <h1 className="vanity-title">Video Time Capsule</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">A message for tomorrow.</p>
          <p className="vanity-description">
            Record a video for your child, partner, or future self. 
            Years later, one scan brings your voice back to life.
          </p>
          <p className="vanity-description vanity-italic">
            The gift that gains meaning with time.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Clock />
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
            <h2 className="vanity-items-title">Time capsule ideas:</h2>
            <div className="vanity-items-grid">
              {ideas.map((idea, i) => (
                <div key={i} className="vanity-item">
                  <div className="vanity-item-icon">
                    <idea.icon />
                  </div>
                  <div className="vanity-item-content">
                    <h3>{idea.title}</h3>
                    <p>{idea.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Gift />
              </div>
              <div className="vanity-highlight-content">
                <h3>Save it for the right moment</h3>
                <p>
                  Create it now, give it later. Store the shirt in a memory box. 
                  When the time comes, it'll be the most meaningful gift they've ever received.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=video">
            <button className="vanity-cta" data-testid="button-create-time-capsule">
              Create Your Time Capsule
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Gift />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/family-video-messages">
                <div className="glass-card vanity-related-link">
                  <span>Family Video Messages</span>
                  <p>Home in their pocket</p>
                </div>
              </Link>
              <Link href="/memorial-video-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Memorial Video Shirts</span>
                  <p>Keep voices alive</p>
                </div>
              </Link>
              <Link href="/advent-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Advent QR Shirts</span>
                  <p>Daily reveals and countdowns</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-video">
            <button className="vanity-back" data-testid="button-back-play">
              ← Back to QR Play
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
