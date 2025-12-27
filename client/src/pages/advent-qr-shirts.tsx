import { Calendar, CheckCircle, Sparkles, Gift, Star, Church, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Schedule different content for each day",
  "Set it once, it runs itself",
  "Perfect for countdowns and daily reveals",
  "Works with any content - verses, tips, surprises",
  "Includes scan analytics to see engagement",
];

const ideas = [
  {
    icon: Church,
    title: "Advent Devotionals",
    description: "Day 1: A new devotional. Day 2: A different verse. Day 12: The grand finale. Daily spiritual content, automated.",
  },
  {
    icon: Gift,
    title: "12 Days of Christmas",
    description: "Each day reveals a new surprise. Recipes, memories, song lyrics, family traditions.",
  },
  {
    icon: Star,
    title: "Birthday Countdowns",
    description: "7 days of birthday messages. Each day, they scan and get a new video, photo, or note from someone who loves them.",
  },
  {
    icon: Calendar,
    title: "Daily Tips & Wisdom",
    description: "30 days of fitness tips. A month of inspirational quotes. Daily recipes. Whatever sequence you want.",
  },
];

export default function AdventQRShirts() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Advent QR Shirts | 12 Days of Christmas, Automated | QR Gear"
        description="Create shirts with QR codes that reveal different content each day. Perfect for Advent devotionals, Christmas countdowns, and daily sequences. Set it once, it runs itself."
        keywords="advent calendar QR, 12 days christmas shirt, daily QR content, countdown shirt, devotional QR, scheduled QR"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Calendar />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Dynamics™</p>
              <h1 className="vanity-title">Advent QR Shirts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">12 Days of Christmas, automated.</p>
          <p className="vanity-description">
            Day 1: A new devotional. Day 2: A different verse. Day 12: The grand finale. 
            Set it once. It runs itself.
          </p>
          <p className="vanity-description vanity-italic">
            Daily reveals without daily work.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Sparkles />
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
            <h2 className="vanity-items-title">Sequence ideas:</h2>
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
                <h3>Great for groups</h3>
                <p>
                  Church groups, families, friend circles - everyone wears the same shirt. 
                  Each day brings a new conversation starter.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=dynamics">
            <button className="vanity-cta" data-testid="button-create-advent">
              Create Your Advent Shirt
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Gift />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/video-time-capsule">
                <div className="glass-card vanity-related-link">
                  <span>Video Time Capsule</span>
                  <p>Messages for the future</p>
                </div>
              </Link>
              <Link href="/band-dynamic-merch">
                <div className="glass-card vanity-related-link">
                  <span>Band Dynamic Merch</span>
                  <p>Updateable musician content</p>
                </div>
              </Link>
              <Link href="/event-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Event QR Shirts</span>
                  <p>Perfect for gatherings</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-dynamics">
            <button className="vanity-back" data-testid="button-back-dynamics">
              ← Back to QR Dynamics™
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
