import { Heart, CheckCircle, Camera, Users, Star, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload a video of your loved one",
  "Their voice, their laugh, their stories - preserved",
  "Scan anytime to see them again",
  "Cloud-hosted for reliable playback",
  "Share the same design with family",
];

const ideas = [
  {
    title: "Their Favorite Story",
    description: "That fishing tale. The embarrassing wedding toast. The bedtime story. Forever on video.",
  },
  {
    title: "A Message They Left",
    description: "A birthday greeting. A word of advice. A simple 'I love you.' One scan brings them back.",
  },
  {
    title: "Clips That Capture Them",
    description: "Laughing. Cooking. Dancing in the kitchen. The little moments that meant everything.",
  },
  {
    title: "Family Remembrances",
    description: "Multiple family members share memories. A video tribute everyone can wear.",
  },
];

export default function MemorialVideoShirts() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Memorial Video Shirts | Keep Their Voice Alive | QR Gear"
        description="Create memorial shirts with QR codes that play video of your loved one. Their voice, their laugh, their stories - preserved forever. Scan anytime to see them again."
        keywords="memorial video shirt, remembrance video gift, loved one video QR, tribute shirt, memorial keepsake, grandpa memorial"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Heart />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Play</p>
              <h1 className="vanity-title">Memorial Video Shirts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Grandpa lives on.</p>
          <p className="vanity-description">
            The hoodie has his photo. Scan it, and there he is — telling his favorite fishing story. Forever.
          </p>
          <p className="vanity-description vanity-italic">
            Their voice. Their laugh. Their stories. Always with you.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Star />
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
              <Camera />
              Video ideas:
            </h2>
            <div className="vanity-scenarios-grid">
              {ideas.map((idea, i) => (
                <div key={i} className="vanity-scenario">
                  <h3>{idea.title}</h3>
                  <p>{idea.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Users />
              </div>
              <div className="vanity-highlight-content">
                <h3>For the whole family</h3>
                <p>
                  Order matching shirts for everyone who wants to carry that memory. 
                  Same video, same QR — different sizes for each person. Wear them together.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=video">
            <button className="vanity-cta" data-testid="button-create-memorial-video">
              Create Your Memorial Shirt
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Camera />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/memorial-qr-gifts">
                <div className="glass-card vanity-related-link">
                  <span>Memorial Photo Gifts</span>
                  <p>Photo-based remembrance shirts</p>
                </div>
              </Link>
              <Link href="/family-video-messages">
                <div className="glass-card vanity-related-link">
                  <span>Family Video Messages</span>
                  <p>Comfort for those far from home</p>
                </div>
              </Link>
              <Link href="/video-time-capsule">
                <div className="glass-card vanity-related-link">
                  <span>Video Time Capsule</span>
                  <p>Messages for the future</p>
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
