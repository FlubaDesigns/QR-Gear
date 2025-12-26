import { Users, CheckCircle, Heart, Camera, Gift, Home, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload the family photo everyone loves",
  "Each family member gets their own shirt",
  "Grandparents, cousins, everyone can scan and see the memory",
  "Perfect for reunions, holidays, or 'just because'",
  "Optional text: family name, reunion year, inside joke",
];

const occasions = [
  {
    title: "The Annual Reunion",
    description: "This year's group photo becomes next year's shirt. Start a tradition.",
  },
  {
    title: "Grandparent Gift",
    description: "Grandma scans the hoodie. Her screen fills with all her grandkids. Tears guaranteed.",
  },
  {
    title: "Holiday Gatherings",
    description: "Thanksgiving, Christmas, Hanukkah — capture the chaos and wear it proudly.",
  },
  {
    title: "Milestone Birthdays",
    description: "80th birthday? 50th anniversary? Put the celebration photo on something they'll actually use.",
  },
];

export default function FamilyReunionShirts() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Family Reunion Shirts | Custom Photo QR Apparel | QR Gear"
        description="Create family reunion shirts with scannable QR codes. Everyone scans to see the family photo. Perfect for reunions, holidays, and gifts for grandparents. USA options available."
        keywords="family reunion shirts, custom family shirts, grandparent gifts, family photo shirts, reunion apparel, family gathering shirts, personalized family gifts"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon vanity-icon-blue">
              <Users />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Canvas</p>
              <h1 className="vanity-title">Family Reunion Shirts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">The gift that keeps giving.</p>
          <p className="vanity-description">
            Family photos deserve more than a spot on the mantle. Put them on shirts everyone actually wears — 
            and when they scan the QR, the whole family appears on their screen.
          </p>
          <p className="vanity-description vanity-italic">
            "Grandma scans the hoodie. Her screen fills with the family reunion photo. Tears guaranteed."
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Heart />
              What makes it special:
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
              <Home />
              Perfect for:
            </h2>
            <div className="vanity-scenarios-grid">
              {occasions.map((occasion, i) => (
                <div key={i} className="vanity-scenario vanity-scenario-blue">
                  <h3>{occasion.title}</h3>
                  <p>{occasion.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight vanity-highlight-blue">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Gift />
              </div>
              <div className="vanity-highlight-content">
                <h3>Ordering for the whole family?</h3>
                <p>
                  Mix sizes, mix styles. Everyone gets the same QR that opens the same photo. 
                  Uncle Bob's 3XL hoodie and little Timmy's youth tee — same memory, different fit.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=url">
            <button className="vanity-cta" data-testid="button-create-family">
              Create Your Family Shirts
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Camera />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/wedding-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Wedding Photo Shirts</span>
                  <p>Wearable favors for your big day</p>
                </div>
              </Link>
              <Link href="/memorial-qr-gifts">
                <div className="glass-card vanity-related-link">
                  <span>Memorial Photo Gifts</span>
                  <p>Honor loved ones with lasting tributes</p>
                </div>
              </Link>
              <Link href="/event-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Event QR Shirts</span>
                  <p>Perfect for any gathering</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-url">
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
