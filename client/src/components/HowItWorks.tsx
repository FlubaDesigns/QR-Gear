import { Card, CardContent } from "@/components/ui/card";
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
    <section className="features">
      <div className="container">
        <div className="center mb-8">
          <h2>How It Works</h2>
          <p>Three simple steps to your custom QR gear</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="glass-card border-0"
              data-testid={`feature-card-${index}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl icon-bg-ice flex items-center justify-center">
                    <feature.icon className="w-5 h-5 icon-color-ice" />
                  </div>
                  <h3 className="card__title">{feature.title}</h3>
                </div>
                <p>{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
