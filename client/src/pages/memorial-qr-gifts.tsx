import { Heart, CheckCircle, Star, Camera, Users, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload their favorite photo",
  "Scan anytime to see them again",
  "A comfort you can wear close",
  "Share the same design with family members",
  "Optional text: their name, dates, a meaningful phrase",
];

const uses = [
  {
    title: "Remembering a Loved One",
    description: "Their smile, their laugh, their face — right there when you need it. Scan and feel close again.",
  },
  {
    title: "Pet Memorials",
    description: "That goofy face. That perfect moment. Wear them with you, and see them whenever you want.",
  },
  {
    title: "Tribute Shirts",
    description: "For memorial services, anniversary remembrances, or just because you miss them.",
  },
  {
    title: "Comfort Gifts",
    description: "Give someone grieving a way to keep their person close. More meaningful than flowers.",
  },
];

export default function MemorialQRGifts() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Memorial QR Gifts | Remembrance Photo Shirts | QR Gear"
        description="Create memorial shirts with scannable QR codes that show a photo of your loved one. A meaningful way to keep memories close. Perfect for remembrance and tribute. USA options available."
        keywords="memorial shirts, remembrance gifts, in memory of shirts, tribute apparel, pet memorial, loved one shirts, grief gifts, memorial QR"
      />
      <Navbar />
<main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Heart />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Canvas</p>
              <h1 className="vanity-title">Memorial QR Gifts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Memories you can wear.</p>
          <p className="vanity-description">
            A favorite vacation. A loved one. A moment you don't want to lose. 
            Put their photo on a shirt, and scan anytime to see them again.
          </p>
          <p className="vanity-description vanity-italic">
            "Scan and relive it — instantly."
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
              Ways to remember:
            </h2>
            <div className="vanity-scenarios-grid">
              {uses.map((use, i) => (
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
                <Users />
              </div>
              <div className="vanity-highlight-content">
                <h3>For the whole family</h3>
                <p>
                  Order matching shirts for everyone who wants to carry that memory. 
                  Same photo, same QR — different sizes for each person.
                </p>
              </div>
            </div>
          </div>

          <Link href="/build?type=canvas">
            <button className="vanity-cta" data-testid="button-create-memorial">
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
              <Link href="/memorial-video-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Memorial Video Shirts</span>
                  <p>Scan to watch video memories</p>
                </div>
              </Link>
              <Link href="/family-video-messages">
                <div className="glass-card vanity-related-link">
                  <span>Family Video Messages</span>
                  <p>Recorded moments that last forever</p>
                </div>
              </Link>
              <Link href="/family-reunion-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Family Reunion Shirts</span>
                  <p>Group photo memories for everyone</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-canvas">
            <button className="vanity-back" data-testid="button-back-canvas">
              ← Back to QR Canvas
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
