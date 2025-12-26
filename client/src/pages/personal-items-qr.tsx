import { Tag, CheckCircle, User, Shirt, Baby, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Custom header text above your QR",
  "Footer text for instructions or contact",
  "Clear context before anyone scans",
  "Permanent QR - never expires",
  "USA options available",
];

const exampleTexts = [
  "IF FOUND, PLEASE CALL",
  "THIS BELONGS TO JESS",
  "MEDICAL INFO – SCAN",
  "PROPERTY OF THE SMITHS",
  "RETURN TO OWNER",
];

const items = [
  {
    icon: Shirt,
    title: "Jackets & Hoodies",
    description: "Left your hoodie at the gym? The finder knows exactly what to do. 'IF FOUND' plus your contact.",
  },
  {
    icon: Baby,
    title: "Kids' Clothes",
    description: "Hoodies, t-shirts, jackets. Because everything gets left somewhere.",
  },
  {
    icon: User,
    title: "Bags & Totes",
    description: "Gym bags, backpacks, totes. Your stuff, permanently claimed.",
  },
];

export default function PersonalItemsQR() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Personal Items QR | Label Your Stuff With Style | QR Gear"
        description="Create QR gear for personal items with 'IF FOUND' text and contact info. Perfect for hoodies, bags, and anything you don't want to lose. USA options available."
        keywords="personal items QR, if found QR, custom hoodies, gym bag QR, personal belongings QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-teal-500/10 flex items-center justify-center shrink-0">
              <Tag className="w-8 h-8 md:w-10 md:h-10 text-teal-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Plus</p>
              <h1 className="text-2xl md:text-4xl font-bold">Personal Items QR</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Simple words make all the difference.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Add a header like "IF FOUND, PLEASE CALL" so people know what to do before they even scan. 
            Context first, action second.
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            {exampleTexts.map((text, i) => (
              <span key={i} className="text-xs bg-muted px-3 py-1.5 rounded font-mono">{text}</span>
            ))}
          </div>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-teal-500" />
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
            <h2 className="font-semibold mb-6">Print on your gear:</h2>
            <div className="grid gap-4">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-teal-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Link href="/creator?line=static-plus">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-personal">
              Create Your Personal QR Gear
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/lost-found-qr">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Lost & Found QR</span>
                  <p className="text-sm text-muted-foreground">Tag bags and travel gear</p>
                </div>
              </Link>
              <Link href="/everyday-qr">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Everyday QR</span>
                  <p className="text-sm text-muted-foreground">Simple prompts for daily use</p>
                </div>
              </Link>
              <Link href="/office-qr-mug">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Office QR Mug</span>
                  <p className="text-sm text-muted-foreground">Claim your mug at work</p>
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
