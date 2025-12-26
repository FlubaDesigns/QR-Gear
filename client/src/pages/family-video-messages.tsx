import { Home, CheckCircle, Heart, Users, MessageCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Compile video messages from the whole family",
  "Scan anytime for instant comfort",
  "Perfect for someone living far away",
  "Cloud-hosted, plays on any phone",
  "A gift they'll treasure forever",
];

const scenarios = [
  {
    title: "Going to College",
    description: "The whole family records encouragement. When homesickness hits, they scan and hear everyone's voice.",
  },
  {
    title: "Moving Away",
    description: "New city, new life, but family is always close. One scan brings them all back.",
  },
  {
    title: "Military Deployment",
    description: "Mom, dad, siblings, the dog - everyone says 'we love you.' Home in their pocket, wherever they go.",
  },
  {
    title: "Long-Distance Grandparents",
    description: "Grandkids grow up fast. Give grandparents a shirt full of giggles and 'I love you's.",
  },
];

export default function FamilyVideoMessages() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Family Video Messages | Home in Their Pocket | QR Gear"
        description="Create shirts with QR codes that play video messages from the whole family. Perfect for college students, military deployment, or anyone far from home. Instant comfort."
        keywords="family video shirt, going away gift, college student gift, military gift, long distance family, video message shirt"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Home />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Play</p>
              <h1 className="vanity-title">Family Video Messages</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Home in their pocket.</p>
          <p className="vanity-description">
            The whole family recorded messages. Now every time they miss you, they scan the shirt. Instant comfort.
          </p>
          <p className="vanity-description vanity-italic">
            Distance disappears. One scan and everyone is there.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Heart />
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

          <div className="glass-card vanity-scenarios">
            <h2 className="vanity-scenarios-title">
              <Users />
              Perfect for:
            </h2>
            <div className="vanity-scenarios-grid">
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
                <MessageCircle />
              </div>
              <div className="vanity-highlight-content">
                <h3>Easy to make</h3>
                <p>
                  Have everyone record a short clip on their phone. Stitch them together with any free video editor. 
                  Upload, and you've got a gift that lasts forever.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=video">
            <button className="vanity-cta" data-testid="button-create-family-video">
              Create Your Family Message Shirt
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Users />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/memorial-video-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Memorial Video Shirts</span>
                  <p>Keep loved ones close</p>
                </div>
              </Link>
              <Link href="/video-time-capsule">
                <div className="glass-card vanity-related-link">
                  <span>Video Time Capsule</span>
                  <p>Messages for the future</p>
                </div>
              </Link>
              <Link href="/family-reunion-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Family Reunion Shirts</span>
                  <p>Photo memories for the family</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-play">
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
