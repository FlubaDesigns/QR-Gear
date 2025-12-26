import { Sparkles, CheckCircle, ArrowRight, Building2, CalendarDays, Music, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Scheduled changes - set it and forget it",
  "Rotating content - cycle through multiple destinations",
  "Daily sequences - prayers, tips, countdowns, advent calendars",
  "User-controlled updates without reprinting",
  "Scan analytics and tracking",
  "Premium subscription service",
];

const examples = [
  {
    icon: Building2,
    title: "Real Estate Agents",
    text: "Same polo for every listing - just update the QR to point to your current property",
  },
  {
    icon: CalendarDays,
    title: "Event Organizers",
    text: "Reuse crew shirts season after season - update to this year's schedule before each event",
  },
  {
    icon: Music,
    title: "Musicians & DJs",
    text: "Merch that stays current - link to your latest album, tour dates, or streaming profile",
  },
  {
    icon: TrendingUp,
    title: "Sales Teams",
    text: "Track which reps get the most scans - update destinations for seasonal campaigns",
  },
];

export default function QRDynamicsLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Dynamics™ | Living QR Codes You Can Update Anytime"
        description="Create QR Dynamics - living QR codes that link to pages you control. Update your content anytime without reprinting. Premium subscription QR merchandise."
        keywords="QR Dynamics, dynamic QR code, living QR code, updateable QR, subscription QR, premium QR merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold">QR Dynamics™</h1>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Content that changes over time</p>
          <p className="text-lg text-muted-foreground mb-8">
            The only QR tier with scheduled changes, rotating content, and daily sequences. 
            Update where your QR points without reprinting - perfect for 12 Days of Christmas, daily prayers, 
            rotating promotions, or any content that evolves. Includes scan analytics and tracking.
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

          <Link href="/creator?line=dynamics">
            <Button size="lg" className="w-full min-h-14 text-lg bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-create-dynamics">
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
