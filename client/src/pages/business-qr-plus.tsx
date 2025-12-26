import { Briefcase, CheckCircle, UtensilsCrossed, HelpCircle, Phone, Store, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Clear call-to-action above your QR",
  "Business name or instructions as footer",
  "No confusion, no hesitation",
  "Professional look for staff and products",
  "Permanent QR - reliable and lasting",
];

const exampleTexts = [
  "SCAN FOR MENU",
  "SCAN FOR CONTACT INFO",
  "NEED HELP? SCAN ME",
  "SCAN TO ORDER",
  "SCAN FOR SERVICES",
];

const uses = [
  {
    icon: UtensilsCrossed,
    title: "Restaurants & Cafes",
    description: "'SCAN FOR MENU' on staff shirts, table tents, window stickers. No more passing greasy menus.",
  },
  {
    icon: Phone,
    title: "Service Businesses",
    description: "'NEED HELP? SCAN ME' for plumbers, electricians, contractors. Instant access to your booking page.",
  },
  {
    icon: Store,
    title: "Retail & Pop-ups",
    description: "'SCAN FOR DETAILS' next to products. Specs, reviews, or buy-now links without the hard sell.",
  },
  {
    icon: HelpCircle,
    title: "Customer Support",
    description: "'SCAN FOR HELP' on equipment, packaging, or staff badges. Self-service support, always available.",
  },
];

export default function BusinessQRPlus() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Business QR Plus | Clear Calls-to-Action for Your Brand | QR Gear"
        description="Create professional QR products with clear prompts like 'SCAN FOR MENU' or 'NEED HELP? SCAN ME'. No confusion, no hesitation. USA options available."
        keywords="business QR, menu QR code, restaurant QR, service business QR, professional QR shirts, customer service QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-500/10 flex items-center justify-center shrink-0">
              <Briefcase className="w-8 h-8 md:w-10 md:h-10 text-slate-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Plus</p>
              <h1 className="text-2xl md:text-4xl font-bold">Business QR Plus</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Make it obvious.</p>
          <p className="text-lg text-muted-foreground mb-4">
            No confusion. No hesitation. When customers see "SCAN FOR MENU" or "NEED HELP? SCAN ME" - 
            they know exactly what to do.
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            {exampleTexts.map((text, i) => (
              <span key={i} className="text-xs bg-muted px-3 py-1.5 rounded font-mono">{text}</span>
            ))}
          </div>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-slate-500" />
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
            <h2 className="font-semibold mb-6">Business applications:</h2>
            <div className="grid gap-4">
              {uses.map((use, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
                    <use.icon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{use.title}</h3>
                    <p className="text-sm text-muted-foreground">{use.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-slate-500/5 border-slate-500/20">
            <div className="flex items-start gap-4">
              <Store className="w-8 h-8 text-slate-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Uniform-ready</h3>
                <p className="text-sm text-muted-foreground">
                  Order for your whole team. Same QR, same message, consistent brand experience. 
                  Polo shirts, aprons, name badges - whatever fits your business.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=static-plus">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-business">
              Create Your Business QR
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/networking-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Networking Shirts</span>
                  <p className="text-sm text-muted-foreground">Save contacts with vCard</p>
                </div>
              </Link>
              <Link href="/website-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Website QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Link to your portfolio</p>
                </div>
              </Link>
              <Link href="/realtor-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Realtor QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Updateable real estate links</p>
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
