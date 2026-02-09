import { Type, CheckCircle, ArrowRight, User, Calendar, Heart, Briefcase } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Custom header text above your QR",
  "Footer text below for clarity or instructions",
  "Multiple font styles and sizes",
  "Clean, readable layouts",
  "Permanent QR code (no expiration)",
  "USA options available",
];

const personalUses = [
  {
    icon: User,
    title: "Personal Items",
    examples: ["IF FOUND, PLEASE CALL", "THIS BELONGS TO JESS", "MEDICAL INFO – SCAN"],
    description: "Simple words make all the difference when it matters.",
    link: "/personal-items-qr",
    linkText: "Personal Item Ideas",
  },
  {
    icon: Calendar,
    title: "Events & Groups",
    examples: ["EVENT SCHEDULE", "JOIN THE GROUP", "PHOTOS FROM TODAY"],
    description: "People know exactly what they're getting before they scan.",
    link: "/event-qr-shirts",
    linkText: "Event Ideas",
  },
  {
    icon: Heart,
    title: "Everyday Prompts",
    examples: ["SCAN TO LEARN MORE", "SCAN FOR INSTRUCTIONS", "SCAN FOR THE STORY"],
    description: "Small text. Big clarity.",
    link: "/everyday-qr",
    linkText: "Everyday Ideas",
  },
  {
    icon: Briefcase,
    title: "Business Uses",
    examples: ["SCAN FOR MENU", "SCAN FOR CONTACT INFO", "NEED HELP? SCAN ME"],
    description: "No confusion. No hesitation.",
    link: "/business-qr-plus",
    linkText: "Business Ideas",
  },
];

export default function QRStaticPlusLanding() {
  return (
    <div className="vanity-page">
      <SEO 
        title="QR Plus | QR Code with Header & Footer Text | QR Gear"
        description="Create QR Plus merchandise with custom header and footer text printed on the product. Add context and calls-to-action around your QR codes. USA options available."
        keywords="QR Plus, QR code with text, custom text QR, header footer QR, QR merchandise with text"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Type />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">State: Permanent + Messaging</p>
              <h1 className="vanity-title">QR Plus</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Add a short message above and below your QR code.</p>
          <p className="vanity-description">
            QR Plus lets you print simple header and footer text directly on the product, 
            giving people context before they scan. Clear instructions. Friendly prompts. No guessing.
          </p>
          <p className="vanity-description vanity-italic">
            Perfect when you want people to know why they should scan.
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
                    <div className="vanity-use-case-examples">
                      {use.examples.map((ex, j) => (
                        <span key={j} className="vanity-example-tag">{ex}</span>
                      ))}
                    </div>
                    <p>{use.description}</p>
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

          <Link href="/build?type=plus">
            <button className="vanity-cta" data-testid="button-create-static-plus">
              Create Your QR Plus
              <ArrowRight />
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
