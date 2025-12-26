import { Smartphone, RefreshCw, Globe } from "lucide-react";

const features = [
  {
    icon: Smartphone,
    title: "Instant Scan",
    description: "Scan with any phone. No app. No friction.",
  },
  {
    icon: RefreshCw,
    title: "Customize & Update",
    description: "Change destinations anytime without reprinting.",
  },
  {
    icon: Globe,
    title: "Connect & Track",
    description: "Perfect for brands, creators, events, and outreach.",
  },
];

export default function HowItWorks() {
  return (
    <section className="home-section">
      <div className="container">
        <div className="section-header">
          <h2>How It Works</h2>
          <p>Three simple steps to your custom QR gear</p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="glass-card feature-card"
              data-testid={`feature-card-${index}`}
            >
              <div className="feature-card-header">
                <div className="feature-card-icon icon-bg-ice">
                  <feature.icon className="icon-color-ice" />
                </div>
                <h3>{feature.title}</h3>
              </div>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
