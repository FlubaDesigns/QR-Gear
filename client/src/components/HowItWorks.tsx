import { MessageSquare, Shirt, Package } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    title: "Choose Your Message",
    description: "Create a custom text QR code or select from our pre-designed collection of patriotic and inspirational designs.",
  },
  {
    icon: Shirt,
    title: "Customize Your Product",
    description: "Select from t-shirts, hats, bags and more. Choose placement, colors, and American-made manufacturers.",
  },
  {
    icon: Package,
    title: "We Print & Ship",
    description: "Your custom QR gear is professionally printed and shipped directly to your door with care.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-7xl">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-16">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((step, index) => (
            <div key={index} className="text-center" data-testid={`step-${index}`}>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 mb-6">
                <step.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-heading text-xl font-semibold mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
