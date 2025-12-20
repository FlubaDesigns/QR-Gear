import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    number: "1",
    title: "Browse",
    description: "Choose from our collection of pre-designed QR codes or create your own custom design with any text, link, or image.",
  },
  {
    number: "2",
    title: "Customize",
    description: "Select your product — t-shirts, hats, bags, and more. Pick colors, placement, and see your design come to life.",
  },
  {
    number: "3",
    title: "We Print & Ship",
    description: "Your custom QR gear is professionally printed on quality products and shipped directly to your door.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-5xl">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-4">
          How QR Gear Works
        </h2>
        <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
          Creating custom QR code merchandise is easy as 1-2-3
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <Card 
              key={index} 
              className="glass-card border-0 text-center hover-elevate transition-all duration-200"
              data-testid={`step-${index}`}
            >
              <CardContent className="p-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2ABED5] to-[#2ABED5]/70 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#2ABED5]/30">
                  <span className="text-2xl font-bold text-white">{step.number}</span>
                </div>
                <h3 className="font-heading text-xl font-semibold mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
