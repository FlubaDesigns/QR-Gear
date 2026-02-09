import { Heart, CheckCircle, AlertTriangle, Pill, Phone, Shield, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Allergies (penicillin, peanuts, latex, etc.)",
  "Blood type and medical conditions",
  "Current medications, dosages, schedules",
  "Emergency contacts with phone numbers",
  "Up to 2,000 characters - room for everything",
  "Permanent QR - critical info that lasts",
];

const infoTypes = [
  {
    icon: AlertTriangle,
    title: "Allergies",
    description: "Penicillin. Peanuts. Latex. When you can't speak, your shirt can.",
  },
  {
    icon: Pill,
    title: "Medications",
    description: "Current prescriptions, dosages, and schedules. First responders need this.",
  },
  {
    icon: Phone,
    title: "Emergency Contacts",
    description: "Mom. Spouse. Doctor. The people who need to know, instantly reachable.",
  },
  {
    icon: Heart,
    title: "Medical Conditions",
    description: "Diabetes. Epilepsy. Heart conditions. Critical context for critical moments.",
  },
];

export default function MedicalAlertQR() {
  return (
    <div className="vanity-page">
      <SEO 
        title="Medical Alert QR | Emergency Info You Wear | QR Gear"
        description="Create wearable medical alert QR codes with allergies, medications, blood type, and emergency contacts. When you can't speak, your shirt can. USA options available."
        keywords="medical alert QR, emergency info shirt, allergy alert, medical ID QR, emergency contacts wearable, health info QR"
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
              <p className="vanity-category">QR Basics</p>
              <h1 className="vanity-title">Medical Alert QR</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">Silent lifesaver.</p>
          <p className="vanity-description">
            Allergies. Blood type. Emergency contacts. Medications. 
            When you can't speak, your shirt can.
          </p>
          <p className="vanity-description vanity-italic">
            Critical info, always on you, always accessible.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Shield />
              What you can encode:
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
            <h2 className="vanity-items-title">Life-saving information:</h2>
            <div className="vanity-items-grid">
              {infoTypes.map((info, i) => (
                <div key={i} className="vanity-item">
                  <div className="vanity-item-icon">
                    <info.icon />
                  </div>
                  <div className="vanity-item-content">
                    <h3>{info.title}</h3>
                    <p>{info.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <AlertTriangle />
              </div>
              <div className="vanity-highlight-content">
                <h3>For anyone with health concerns</h3>
                <p>
                  Runners, hikers, seniors, kids with allergies, anyone who wants peace of mind. 
                  First responders know to look for medical IDs. Make yours scannable.
                </p>
              </div>
            </div>
          </div>

          <Link href="/build?type=basic">
            <button className="vanity-cta" data-testid="button-create-medical">
              Create Your Medical Alert
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Shield />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/lost-found-qr">
                <div className="glass-card vanity-related-link">
                  <span>Lost & Found QR</span>
                  <p>QR on your bags and gear</p>
                </div>
              </Link>
              <Link href="/personal-items-qr">
                <div className="glass-card vanity-related-link">
                  <span>Personal Items QR</span>
                  <p>Label anything important</p>
                </div>
              </Link>
              <Link href="/everyday-qr">
                <div className="glass-card vanity-related-link">
                  <span>Everyday QR</span>
                  <p>Practical QR for daily use</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-basics">
            <button className="vanity-back" data-testid="button-back-basics">
              ← Back to QR Basics
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
