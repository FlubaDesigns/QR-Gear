import { Type, CheckCircle, ArrowRight, User, Calendar, Heart, Briefcase } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Custom header text above your QR",
  "Footer text below for clarity or instructions",
  "Multiple font styles and sizes",
  "Clean, readable layouts",
  "Permanent QR — never expires or changes",
  "USA-made apparel and accessories",
];

const personalUses = [
  {
    icon: User,
    title: "Personal Items",
    examples: ["IF FOUND, PLEASE CALL", "THIS BELONGS TO JESS", "MEDICAL INFO – SCAN"],
    text: "Simple words make all the difference.",
  },
  {
    icon: Calendar,
    title: "Events & Groups",
    examples: ["EVENT SCHEDULE", "JOIN THE GROUP", "PHOTOS FROM TODAY"],
    text: "People know what they're getting before they scan.",
  },
  {
    icon: Heart,
    title: "Everyday Prompts",
    examples: ["SCAN TO LEARN MORE", "SCAN FOR INSTRUCTIONS", "SCAN FOR THE STORY"],
    text: "Small text. Big clarity.",
  },
];

const businessUses = [
  {
    icon: Briefcase,
    title: "Make It Obvious",
    examples: ["SCAN FOR MENU", "SCAN FOR CONTACT INFO", "NEED HELP? SCAN ME"],
    text: "No confusion. No hesitation.",
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
            <div>
              <h1 className="text-2xl md:text-4xl font-bold">QR Plus</h1>
              <span className="text-sm text-muted-foreground/70 uppercase tracking-wide">Permanent + Messaging</span>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-1">Add a short message above and below your QR code.</p>
          <p className="text-lg text-muted-foreground mb-6">
            QR Plus lets you print simple header and footer text directly on the product, 
            giving people context before they scan. Clear instructions. Friendly prompts. No guessing.
          </p>
          <p className="text-sm text-muted-foreground/80 italic mb-8">
            Perfect when you want people to know why they should scan.
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

          <div className="bg-card rounded-xl p-6 mb-6 text-left">
            <h2 className="font-semibold mb-4">Popular Uses:</h2>
            <div className="grid gap-5">
              {personalUses.map((use, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <use.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{use.title}</h3>
                    <div className="flex flex-wrap gap-2 mb-1">
                      {use.examples.map((ex, j) => (
                        <span key={j} className="text-xs bg-muted px-2 py-1 rounded font-mono">{ex}</span>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{use.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 mb-8 text-left">
            <h2 className="font-semibold mb-4">For Business:</h2>
            <div className="grid gap-5">
              {businessUses.map((use, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <use.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{use.title}</h3>
                    <div className="flex flex-wrap gap-2 mb-1">
                      {use.examples.map((ex, j) => (
                        <span key={j} className="text-xs bg-muted px-2 py-1 rounded font-mono">{ex}</span>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{use.text}</p>
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
