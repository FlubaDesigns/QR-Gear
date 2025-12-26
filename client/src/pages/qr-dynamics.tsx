import { Sparkles, CheckCircle, ArrowRight, Calendar, Music, Building2, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your personal QR Space — hosted digital real estate",
  "Space Terms: 1 year, 3 year, or 5 year options",
  "Scheduled changes — set it and forget it",
  "Rotating content — cycle through multiple destinations",
  "Daily sequences — prayers, tips, countdowns, advent calendars",
  "User-controlled updates without reprinting",
  "Scan analytics and tracking",
  "Easy Space Renewal when your term ends",
];

const popularUses = [
  {
    icon: Calendar,
    title: "12 Days of Christmas, Automated",
    description: "Day 1: A new devotional.\nDay 2: A different verse.\nDay 12: The grand finale.\nSet it once. It runs itself.",
    link: "/advent-qr-shirts",
    linkText: "Advent Ideas",
  },
  {
    icon: Music,
    title: "Merch That Never Goes Stale",
    description: "Tour ends? Update to the new album.\nSingle drops? Link it.\nSame shirt — always current.",
    link: "/band-dynamic-merch",
    linkText: "Band Merch Ideas",
  },
  {
    icon: Building2,
    title: "One Polo, Infinite Listings",
    description: "Monday it's the downtown condo.\nFriday it's the lakefront estate.\nSame shirt. Different property every week.",
    link: "/realtor-qr-shirts",
    linkText: "Realtor Ideas",
  },
  {
    icon: TrendingUp,
    title: "The Shirt That Reports Back",
    description: "Track every scan.\nSee what gets traction.\nUpdate the destination mid-campaign — no reprint required.",
    link: "/business-analytics-qr",
    linkText: "Business Ideas",
  },
];

export default function QRDynamicsLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Dynamics™ | Living QR Codes You Can Update Anytime"
        description="Create QR Dynamics - living QR codes that link to pages you control. Update content, schedule changes, rotate destinations, track engagement. Premium subscription QR merchandise."
        keywords="QR Dynamics, dynamic QR code, living QR code, updateable QR, subscription QR, scheduled QR, analytics QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">State: Living</p>
              <h1 className="text-2xl md:text-4xl font-bold">QR Dynamics™</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Content that changes over time.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Your personal QR Space — digital real estate you control. 
            QR Dynamics™ is the only state where your QR evolves. Update content, schedule changes, 
            rotate destinations, and track engagement — all without reprinting a thing.
          </p>
          <p className="text-lg text-muted-foreground mb-8">
            Choose your Space Term (1 year / 3 year / 5 year) and manage content that lives, moves, and grows.
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
              {popularUses.map((use, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <use.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{use.title}</h3>
                    <p className="text-muted-foreground whitespace-pre-line mb-3">{use.description}</p>
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

          <Card className="p-6 mb-8 bg-primary/5 border-primary/20 text-center">
            <p className="text-lg font-medium mb-2">QR Dynamics™ isn't a link.</p>
            <p className="text-2xl font-bold text-primary">It's space.</p>
          </Card>

          <Link href="/creator?line=dynamics">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-dynamics">
              Create Your QR Dynamics
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
