import { MapPin, CheckCircle, Dumbbell, Backpack, Briefcase, Dog, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your contact info encoded in the QR",
  "Works on bags, gear, anything you might lose",
  "Good samaritans just scan and call",
  "No app needed - any phone camera works",
  "Permanent QR - never wears off",
];

const items = [
  {
    icon: Dumbbell,
    title: "Gym Bags",
    description: "Left at the gym? In the locker? Someone finds it, scans it, calls you.",
  },
  {
    icon: Backpack,
    title: "Backpacks & Luggage",
    description: "Travel gear that knows how to get home. Airport, hotel, Uber - covered.",
  },
  {
    icon: Briefcase,
    title: "Laptop Bags",
    description: "Your work bag with your work contact. IT will thank you.",
  },
  {
    icon: Dog,
    title: "Pet Gear",
    description: "Leashes, carriers, bowls - because Fido's stuff wanders too.",
  },
];

export default function LostFoundQR() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Lost & Found QR | Never Lose Your Gear Again | QR Gear"
        description="Add QR codes to your bags, luggage, and gear with your contact info. Good samaritans scan and call you. Perfect for gym bags, backpacks, and travel gear. USA options available."
        keywords="lost and found QR, luggage tag QR, gym bag tag, backpack QR code, contact info tag, gear identification"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
              <MapPin className="w-8 h-8 md:w-10 md:h-10 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Basics</p>
              <h1 className="text-2xl md:text-4xl font-bold">Lost & Found QR</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Lost & Found Hero.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Gym bag goes missing? Your contact info is baked right in. 
            Good samaritans just scan and call. No apps, no accounts, no friction.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Your stuff, permanently tagged and ready to come home.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-500" />
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
            <h2 className="font-semibold mb-6">Tag everything that travels:</h2>
            <div className="grid gap-4">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-green-500/5 border-green-500/20">
            <div className="flex items-start gap-4">
              <Backpack className="w-8 h-8 text-green-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Works on anything</h3>
                <p className="text-sm text-muted-foreground">
                  Stickers, tags, keychains, patches - whatever sticks to your gear. 
                  Order the format that works for your stuff.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=static">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-lost-found">
              Create Your Lost & Found Tag
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/medical-alert-qr">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Medical Alert QR</span>
                  <p className="text-sm text-muted-foreground">Emergency info when you need it</p>
                </div>
              </Link>
              <Link href="/personal-items-qr">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Personal Items QR</span>
                  <p className="text-sm text-muted-foreground">Label all your gear</p>
                </div>
              </Link>
              <Link href="/everyday-qr">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Everyday QR</span>
                  <p className="text-sm text-muted-foreground">Practical QR for daily life</p>
                </div>
              </Link>
            </div>
          </Card>

          <Link href="/qr-static">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-basics">
              ← Back to QR Basics
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
