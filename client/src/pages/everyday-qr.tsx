import { Lightbulb, CheckCircle, HelpCircle, BookOpen, Info, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Simple prompts that invite curiosity",
  "Header and footer text on the product",
  "Works for any link or content",
  "Small text, big clarity",
  "Permanent QR - always ready",
];

const exampleTexts = [
  "SCAN TO LEARN MORE",
  "SCAN FOR INSTRUCTIONS",
  "SCAN FOR THE STORY",
  "CURIOUS? SCAN ME",
  "SCAN FOR DETAILS",
];

const uses = [
  {
    icon: BookOpen,
    title: "The Story Behind It",
    description: "Handmade products. Art pieces. Vintage finds. 'SCAN FOR THE STORY' adds soul to any item.",
  },
  {
    icon: HelpCircle,
    title: "How-To Instructions",
    description: "'SCAN FOR INSTRUCTIONS' on anything that needs explaining. Assembly, care, recipes.",
  },
  {
    icon: Info,
    title: "Learn More",
    description: "Products, causes, hobbies. Give people a way to dig deeper when they're curious.",
  },
  {
    icon: Sparkles,
    title: "Hidden Extras",
    description: "'SCAN ME' with a wink. Easter eggs, bonus content, surprises for the observant.",
  },
];

export default function EverydayQR() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Everyday QR | Simple Prompts That Invite Curiosity | QR Gear"
        description="Create QR products with simple prompts like 'SCAN TO LEARN MORE' or 'SCAN FOR THE STORY'. Small text, big clarity. USA options available."
        keywords="everyday QR, scan to learn, simple QR code, curiosity QR, story QR, instructions QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-yellow-500/10 flex items-center justify-center shrink-0">
              <Lightbulb className="w-8 h-8 md:w-10 md:h-10 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Plus</p>
              <h1 className="text-2xl md:text-4xl font-bold">Everyday QR</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Small text. Big clarity.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Sometimes you just need a gentle prompt. "SCAN TO LEARN MORE" or "SCAN FOR THE STORY" - 
            simple words that invite curiosity without overselling.
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            {exampleTexts.map((text, i) => (
              <span key={i} className="text-xs bg-muted px-3 py-1.5 rounded font-mono">{text}</span>
            ))}
          </div>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              What you get:
            </h2>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-6">Works for:</h2>
            <div className="grid gap-4">
              {uses.map((use, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                    <use.icon className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{use.title}</h3>
                    <p className="text-sm text-muted-foreground">{use.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Link href="/creator?line=static-plus">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-everyday">
              Create Your Everyday QR
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/personal-items-qr">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Personal Items QR</span>
                  <p className="text-sm text-muted-foreground">Label your belongings</p>
                </div>
              </Link>
              <Link href="/lost-found-qr">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Lost & Found QR</span>
                  <p className="text-sm text-muted-foreground">Tag things that travel</p>
                </div>
              </Link>
              <Link href="/office-qr-mug">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Office QR Mug</span>
                  <p className="text-sm text-muted-foreground">Stop the office mug thief</p>
                </div>
              </Link>
            </div>
          </Card>

          <Link href="/qr-static-plus">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-plus">
              ← Back to QR Plus
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
