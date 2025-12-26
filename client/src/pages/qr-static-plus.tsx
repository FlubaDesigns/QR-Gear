import { Type, CheckCircle, ArrowRight, Store, Calendar, Gift, Megaphone } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Add custom header text above your QR",
  "Add footer text below for context",
  "Multiple font styles and sizes",
  "Perfect for calls-to-action",
];

const examples = [
  {
    icon: Store,
    title: "Retail Staff Shirts",
    text: "\"SCAN FOR HELP\" above the QR, store website below - customers know exactly what to do",
  },
  {
    icon: Calendar,
    title: "Event Crew Gear",
    text: "\"SCHEDULE\" header with \"#YourEvent2025\" footer - everyone finds the lineup fast",
  },
  {
    icon: Gift,
    title: "Giveaway Merch",
    text: "\"WIN BIG!\" up top, \"Enter Now\" below - turns any shirt into a contest entry point",
  },
  {
    icon: Megaphone,
    title: "Promo Campaigns",
    text: "\"20% OFF\" header with your promo code as footer - wearable discount billboard",
  },
];

export default function QRStaticPlusLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Plus | QR Code with Header & Footer Text | QR Gear"
        description="Create QR Plus merchandise with custom header and footer text printed on the product. Add context and calls-to-action around your QR codes. USA-made products."
        keywords="QR Plus, QR code with text, custom text QR, header footer QR, QR merchandise with text"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
              <Type className="w-8 h-8 md:w-10 md:h-10 text-accent" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold">QR Plus</h1>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Add a message above and below your QR</p>
          <p className="text-lg text-muted-foreground mb-8">
            Make your QR code stand out with custom header and footer text printed right on the product. 
            Add context, instructions, or a call-to-action that people see before they even scan.
          </p>

          <div className="bg-card rounded-xl p-6 mb-6 text-left">
            <h2 className="font-semibold mb-4">What you get:</h2>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card rounded-xl p-6 mb-8 text-left">
            <h2 className="font-semibold mb-4">Popular Uses:</h2>
            <div className="grid gap-4">
              {examples.map((example, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <example.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">{example.title}</h3>
                    <p className="text-sm text-muted-foreground">{example.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link href="/creator?line=static-plus">
            <Button size="lg" className="w-full min-h-14 text-lg bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-create-static-plus">
              Create Your QR Plus
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
