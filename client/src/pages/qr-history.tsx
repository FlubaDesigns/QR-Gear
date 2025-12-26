import { Link } from "wouter";
import { QRButton } from "@/components/QRButton";
import { ArrowLeft, Calendar, Car, Smartphone, ShoppingBag, Sparkles } from "lucide-react";

const timeline = [
  {
    year: "1994",
    title: "Born in Japan",
    description: "Denso Wave, a Toyota subsidiary, invented QR codes to track automotive parts during manufacturing. The 'QR' stands for 'Quick Response' - they needed something faster than traditional barcodes.",
    icon: Car,
  },
  {
    year: "2000",
    title: "ISO Standard",
    description: "QR codes became an international standard (ISO/IEC 18004), opening the door for global adoption beyond the automotive industry.",
    icon: Calendar,
  },
  {
    year: "2010s",
    title: "Mobile Revolution",
    description: "Smartphones with built-in cameras transformed QR codes from industrial tools to everyday conveniences. No special app needed - just point and scan.",
    icon: Smartphone,
  },
  {
    year: "2020+",
    title: "Everywhere You Look",
    description: "The pandemic accelerated QR adoption for contactless menus, payments, and check-ins. Today, QR codes connect the physical and digital worlds seamlessly.",
    icon: ShoppingBag,
  },
  {
    year: "Now",
    title: "QR Gear Era",
    description: "We're taking QR technology to the next level - wearable, customizable, and dynamic. Your message, your style, your way.",
    icon: Sparkles,
  },
];

const funFacts = [
  "A single QR code can store up to 4,296 characters - enough for a short story",
  "QR codes can still be scanned even when 30% damaged, thanks to error correction",
  "The fastest QR code scan recorded took just 0.03 seconds",
  "Over 10 million QR codes are scanned daily in the United States alone",
  "The original QR code patent was released for free public use",
];

export default function QRHistory() {
  return (
    <div className="page-container">
      <section className="hero-section">
        <div className="container">
          <Link href="/">
            <QRButton variant="ghost" size="small" className="back-link">
              <ArrowLeft /> Back to Home
            </QRButton>
          </Link>
          
          <div className="hero-content">
            <h1 className="hero-title">The Story Behind the Square</h1>
            <p className="hero-subtitle">
              From factory floors to fashion statements - how a simple pattern became the bridge between physical and digital worlds
            </p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <div className="section-header">
            <h2>A Brief History of QR Codes</h2>
            <p>30 years of connecting people to information</p>
          </div>

          <div className="timeline-container">
            {timeline.map((item, index) => (
              <div key={index} className="glass-card timeline-card" data-testid={`timeline-${index}`}>
                <div className="timeline-year">{item.year}</div>
                <div className="timeline-content">
                  <div className="timeline-icon icon-bg-ice">
                    <item.icon className="icon-color-ice" />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section-muted">
        <div className="container">
          <div className="section-header">
            <h2>Fun Facts</h2>
            <p>Things you probably didn't know about QR codes</p>
          </div>

          <div className="facts-grid">
            {funFacts.map((fact, index) => (
              <div key={index} className="glass-card fact-card" data-testid={`fact-${index}`}>
                <span className="fact-number">{index + 1}</span>
                <p>{fact}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <div className="glass-card cta-card premium">
            <h2>Ready to Make History?</h2>
            <p>Join the next chapter of QR technology. Create custom gear that tells your story.</p>
            <Link href="/creator">
              <QRButton variant="accent" size="default" data-testid="button-start-creating">
                Start Creating
              </QRButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
