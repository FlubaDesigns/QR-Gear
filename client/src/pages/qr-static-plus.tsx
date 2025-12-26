import { Type, CheckCircle, ArrowRight, User, Calendar, Heart, Briefcase } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Custom header text above your QR",
  "Footer text below for clarity or instructions",
  "Multiple font styles and sizes",
  "Clean, readable layouts",
  "Permanent QR — never expires or changes",
  "USA options available",
];

const personalUses = [
  {
    icon: User,
    title: "Personal Items",
    examples: ["IF FOUND, PLEASE CALL", "THIS BELONGS TO JESS", "MEDICAL INFO – SCAN"],
    description: "Simple words make all the difference.",
    link: "/personal-items-qr",
    linkText: "Personal Item Ideas",
  },
  {
    icon: Calendar,
    title: "Events & Groups",
    examples: ["EVENT SCHEDULE", "JOIN THE GROUP", "PHOTOS FROM TODAY"],
    description: "People know what they're getting before they scan.",
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
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Plus | QR Code with Header & Footer Text | QR Gear"
        description="Create QR Plus merchandise with custom header and footer text printed on the product. Add context and calls-to-action around your QR codes. USA options available."
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
              <p className="text-sm text-muted-foreground font-medium">State: Permanent + Messaging</p>
              <h1 className="text-2xl md:text-4xl font-bold">QR Plus</h1>
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

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4">What you get:</h2>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 mb-8">
            <h2 className="font-semibold mb-6">Popular Uses:</h2>
            <div className="grid gap-6">
              {personalUses.map((use, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <use.icon className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{use.title}</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {use.examples.map((ex, j) => (
                        <span key={j} className="text-xs bg-muted px-2 py-1 rounded font-mono">{ex}</span>
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-3">{use.description}</p>
                    <Link href={use.link}>
                      <Button variant="outline" size="sm" className="min-h-12" data-testid={`button-use-${i}`}>
                        {use.linkText}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Link href="/creator?line=static-plus">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-static-plus">
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
